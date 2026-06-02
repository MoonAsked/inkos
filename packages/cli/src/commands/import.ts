import { Command } from "commander";
import { PipelineRunner, StateManager, splitChapters, groupChaptersByVolume, deriveBookIdFromTitle, normalizePlatformOrOther, type BookConfig } from "@actalk/inkos-core";
import { readFile, readdir, stat, mkdir } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { join, resolve } from "node:path";
import { loadConfig, buildPipelineConfig, findProjectRoot, resolveBookId, log, logError } from "../utils.js";
import {
  formatImportCanonComplete,
  formatImportCanonStart,
  formatImportChaptersComplete,
  formatImportChaptersDiscovery,
  formatImportChaptersResume,
  resolveCliLanguage,
} from "../localization.js";

export const importCommand = new Command("import")
  .description("Import external data into a book");

importCommand
  .command("canon")
  .description("Import parent book's canon for spinoff writing")
  .argument("[target-book-id]", "Target book ID (auto-detected if only one book)")
  .requiredOption("--from <parent-book-id>", "Parent book ID to import canon from")
  .option("--json", "Output JSON")
  .action(async (targetBookIdArg: string | undefined, opts) => {
    try {
      const root = findProjectRoot();
      const targetBookId = await resolveBookId(targetBookIdArg, root);
      const config = await loadConfig();
      const state = new StateManager(root);
      const targetBook = await state.loadBookConfig(targetBookId);
      const language = resolveCliLanguage(targetBook.language);

      const pipeline = new PipelineRunner(buildPipelineConfig(config, root));

      if (!opts.json) log(formatImportCanonStart(language, opts.from, targetBookId));

      await pipeline.importCanon(targetBookId, opts.from);

      if (opts.json) {
        log(JSON.stringify({
          targetBookId,
          parentBookId: opts.from,
          output: "story/parent_canon.md",
        }, null, 2));
      } else {
        for (const line of formatImportCanonComplete(language)) {
          log(line);
        }
      }
    } catch (e) {
      if (opts.json) {
        log(JSON.stringify({ error: String(e) }));
      } else {
        logError(`Canon import failed: ${e}`);
      }
      process.exit(1);
    }
  });

importCommand
  .command("chapters")
  .description("Import existing chapters for continuation writing. Reverse-engineers all truth files.")
  .argument("[book-id]", "Target book ID (auto-detected if only one book)")
  .requiredOption("--from <path>", "Path to a text file (auto-split) or directory of .md/.txt files")
  .option("--split <regex>", "Custom regex for chapter splitting (single-file mode)")
  .option("--resume-from <n>", "Resume from chapter N (for interrupted imports)", parseInt)
  .option("--series", "Treat as a new series (shared universe, independent story) instead of direct continuation")
  .option("--foundation-interval <n>", "Regenerate foundation (story_frame, roles, book_rules) every N chapters during import. 0 = never (step 1 only). Default: 1 (every chapter)", parseInt)
  .option("--json", "Output JSON")
  .action(async (bookIdArg: string | undefined, opts) => {
    let pipelineConfig: ReturnType<typeof buildPipelineConfig> | undefined;
    let logStream: ReturnType<typeof createWriteStream> | undefined;
    try {
      const root = findProjectRoot();
      const config = await loadConfig();
      const state = new StateManager(root);

      let bookId: string;
      try {
        bookId = await resolveBookId(bookIdArg, root);
      } catch (e) {
        // Auto-create book when importing a new novel
        if (bookIdArg && e instanceof Error && e.message.includes("not found")) {
          bookId = deriveBookIdFromTitle(bookIdArg) || `book-${Date.now().toString(36)}`;
          const now = new Date().toISOString();
          const book: BookConfig = {
            id: bookId,
            title: bookIdArg,
            platform: normalizePlatformOrOther(undefined),
            genre: "other",
            status: "outlining",
            targetChapters: 200,
            chapterWordCount: 3000,
            language: config.language,
            createdAt: now,
            updatedAt: now,
          };
          await state.saveBookConfig(bookId, book);
          log(`Book "${bookIdArg}" not found. Auto-created book "${bookId}" for import.`);
        } else {
          throw e;
        }
      }

      const book = await state.loadBookConfig(bookId);
      const language = resolveCliLanguage(book.language);
      const existingChapterCount = (await state.getNextChapterNumber(bookId)) - 1;
      if (existingChapterCount > 0) {
        if (!opts.resumeFrom) {
          // Auto-detect progress: resume from the last imported chapter to ensure
          // its steps are fully completed (e.g. truth files, snapshots)
          opts.resumeFrom = existingChapterCount;
          log(`Book "${bookId}" already has ${existingChapterCount} chapter(s). Auto-resuming from chapter ${opts.resumeFrom} to ensure completion.`);
        } else if (opts.resumeFrom <= existingChapterCount) {
          // Warn that existing chapters will be overwritten
          const overwriteCount = existingChapterCount - opts.resumeFrom + 1;
          log(`Warning: --resume-from ${opts.resumeFrom} will re-analyze and overwrite ${overwriteCount} existing chapter(s) (${opts.resumeFrom}-${existingChapterCount}), then continue with new chapters.`);
        }
      }

      const foundationInterval = opts.foundationInterval !== undefined ? opts.foundationInterval : 1;

      // When foundation-interval > 0, we don't need to force-resume — the
      // per-chapter foundation regeneration will overwrite existing foundation
      // files regardless. Only set resumeFrom if there are existing chapters.
      if (!opts.resumeFrom && existingChapterCount > 0) {
        opts.resumeFrom = existingChapterCount;
        log(`Book "${bookId}" already has ${existingChapterCount} chapter(s). Auto-resuming from chapter ${opts.resumeFrom} to ensure completion.`);
      }

      const fromPath = resolve(opts.from);
      const fromStat = await stat(fromPath);

      let chapters: Array<{ title: string; content: string }>;

      if (fromStat.isDirectory()) {
        // Directory mode: read each .md/.txt file in sorted order
        const entries = await readdir(fromPath);
        const textFiles = entries
          .filter((f) => f.endsWith(".md") || f.endsWith(".txt"))
          .sort();

        if (textFiles.length === 0) {
          throw new Error(`No .md or .txt files found in ${fromPath}`);
        }

        chapters = await Promise.all(
          textFiles.map(async (f) => {
            const content = await readFile(join(fromPath, f), "utf-8");
            const title = f.replace(/\.(md|txt)$/, "").replace(/^\d+[_\-\\s]*/, "");
            return { title, content };
          }),
        );
      } else {
        // Single file mode: split by chapter pattern
        const text = await readFile(fromPath, "utf-8");
        chapters = [...splitChapters(text, opts.split)];

        if (chapters.length === 0) {
          throw new Error(
            `No chapters found in ${fromPath}. ` +
            `Default pattern matches "第X章", "第X节", and "Chapter X". Use --split to provide a custom regex.`,
          );
        }
      }

      if (!opts.json) {
        log(formatImportChaptersDiscovery(language, chapters.length, bookId));
        if (opts.resumeFrom) {
          log(formatImportChaptersResume(language, opts.resumeFrom));
        }
        // Detect and display volume structure
        const volumes = groupChaptersByVolume(chapters);
        if (volumes.length > 1) {
          log(language === "en" ? "  Volume structure detected:" : "  检测到分卷结构：");
          for (const v of volumes) {
            const range = v.chapterStart === v.chapterEnd
              ? `Ch.${v.chapterStart + 1}`
              : `Ch.${v.chapterStart + 1}-${v.chapterEnd + 1}`;
            log(`    ${v.label}${v.title ? ` ${v.title}` : ""}: ${range} (${v.chapterCount}章)`);
          }
        }
      }

      // Chapter import — always save pipeline logs to project root
      const logDir = resolve(root, "logs");
      await mkdir(logDir, { recursive: true });
      const now = new Date();
      const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
      const logPath = join(logDir, `import-${bookId}-${ts}.jsonl`);
      log(`日志保存至: ${logPath}`);
      const logStream_ = createWriteStream(logPath, { flags: "a" });
      logStream = logStream_;
      pipelineConfig = buildPipelineConfig(config, root, {
        logFile: logStream_,
      });
      const pipeline = new PipelineRunner(pipelineConfig);

      const result = await pipeline.importChapters({
        bookId,
        chapters,
        resumeFrom: opts.resumeFrom,
        importMode: opts.series ? "series" : "continuation",
        foundationInterval,
      });

      if (opts.json) {
        log(JSON.stringify(result, null, 2));
      } else {
        for (const line of formatImportChaptersComplete(language, {
          importedCount: result.importedCount,
          totalWords: result.totalWords,
          nextChapter: result.nextChapter,
          continueBookId: bookId,
        })) {
          log(line);
        }
      }
    } catch (e) {
      // Write error to JSONL log file via logger so the log captures the failure reason
      if (pipelineConfig?.logger) {
        pipelineConfig.logger.error(`Chapter import failed: ${e}`);
      }
      if (opts.json) {
        log(JSON.stringify({ error: String(e) }));
      } else {
        logError(`Chapter import failed: ${e}`);
      }
      // Ensure the JSONL log stream is flushed before exiting.
      // logStream.end() is async — we must wait for the "finish" event
      // before calling process.exit(), otherwise the last log entry may be lost.
      if (logStream) {
        try {
          await new Promise<void>((resolve) => {
            logStream!.on("finish", resolve);
            logStream!.end();
          });
        } catch {}
      }
      process.exit(1);
    }
  });
