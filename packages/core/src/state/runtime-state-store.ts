import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  ChapterSummariesStateSchema,
  CurrentStateStateSchema,
  HooksStateSchema,
  StateManifestSchema,
  type RuntimeStateDelta,
} from "../models/runtime-state.js";
import type { Fact, StoredHook, StoredSummary } from "./memory-db.js";
import { bootstrapStructuredStateFromMarkdown, parseCurrentStateFacts } from "./state-bootstrap.js";
import { renderChapterSummariesProjection, renderCurrentStateProjection, renderHooksProjection } from "./state-projections.js";
import { applyRuntimeStateDelta, type RuntimeStateSnapshot } from "./state-reducer.js";
import { validateRuntimeState } from "./state-validator.js";
import { arbitrateRuntimeStateDeltaHooks } from "../utils/hook-arbiter.js";

export interface RuntimeStateArtifacts {
  readonly snapshot: RuntimeStateSnapshot;
  readonly resolvedDelta: RuntimeStateDelta;
  readonly currentStateMarkdown: string;
  readonly hooksMarkdown: string;
  readonly chapterSummariesMarkdown: string;
}

export interface NarrativeMemorySeed {
  readonly summaries: ReadonlyArray<StoredSummary>;
  readonly hooks: ReadonlyArray<StoredHook>;
}

export async function loadRuntimeStateSnapshot(bookDir: string): Promise<RuntimeStateSnapshot> {
  await bootstrapStructuredStateFromMarkdown({ bookDir });
  const stateDir = join(bookDir, "story", "state");

  const [manifest, currentState, hooks, chapterSummaries] = await Promise.all([
    readJson(join(stateDir, "manifest.json"), StateManifestSchema),
    readJson(join(stateDir, "current_state.json"), CurrentStateStateSchema),
    readJson(join(stateDir, "hooks.json"), HooksStateSchema),
    readJson(join(stateDir, "chapter_summaries.json"), ChapterSummariesStateSchema),
  ]);

  const snapshot = {
    manifest,
    currentState,
    hooks,
    chapterSummaries,
  };

  const issues = validateRuntimeState(snapshot);
  if (issues.length > 0) {
    // Attempt auto-repair for recoverable issues (duplicate IDs that can be deduped)
    const repaired = repairRuntimeState(snapshot, issues);
    if (repaired) {
      // Re-validate after repair; if still broken, throw
      const remaining = validateRuntimeState(repaired);
      if (remaining.length > 0) {
        const summary = remaining
          .map((issue) => `${issue.code}${issue.path ? `@${issue.path}` : ""}`)
          .join(", ");
        throw new Error(`Invalid persisted runtime state (after auto-repair): ${summary}`);
      }
      // Persist the repaired state so subsequent loads are clean
      await saveRuntimeStateSnapshot(bookDir, repaired);
      return repaired;
    }
    const summary = issues
      .map((issue) => `${issue.code}${issue.path ? `@${issue.path}` : ""}`)
      .join(", ");
    throw new Error(`Invalid persisted runtime state: ${summary}`);
  }

  return snapshot;
}

export async function buildRuntimeStateArtifacts(params: {
  readonly bookDir: string;
  readonly delta: RuntimeStateDelta;
  readonly language: "zh" | "en";
  readonly allowReapply?: boolean;
}): Promise<RuntimeStateArtifacts> {
  const snapshot = await loadRuntimeStateSnapshot(params.bookDir);
  const { resolvedDelta } = arbitrateRuntimeStateDeltaHooks({
    hooks: snapshot.hooks.hooks,
    delta: params.delta,
  });
  const next = applyRuntimeStateDelta({
    snapshot,
    delta: resolvedDelta,
    allowReapply: params.allowReapply,
  });

  return {
    snapshot: next,
    resolvedDelta,
    currentStateMarkdown: renderCurrentStateProjection(next.currentState, params.language),
    // Pass the chapter number so the projection can tag stale / blocked hooks.
    hooksMarkdown: renderHooksProjection(next.hooks, params.language, {
      currentChapter: resolvedDelta.chapter,
    }),
    chapterSummariesMarkdown: renderChapterSummariesProjection(next.chapterSummaries, params.language),
  };
}

export async function saveRuntimeStateSnapshot(
  bookDir: string,
  snapshot: RuntimeStateSnapshot,
): Promise<void> {
  const stateDir = join(bookDir, "story", "state");
  await mkdir(stateDir, { recursive: true });

  await Promise.all([
    writeFile(join(stateDir, "manifest.json"), JSON.stringify(snapshot.manifest, null, 2), "utf-8"),
    writeFile(join(stateDir, "current_state.json"), JSON.stringify(snapshot.currentState, null, 2), "utf-8"),
    writeFile(join(stateDir, "hooks.json"), JSON.stringify(snapshot.hooks, null, 2), "utf-8"),
    writeFile(join(stateDir, "chapter_summaries.json"), JSON.stringify(snapshot.chapterSummaries, null, 2), "utf-8"),
  ]);
}

export async function loadNarrativeMemorySeed(bookDir: string): Promise<NarrativeMemorySeed> {
  const snapshot = await loadRuntimeStateSnapshot(bookDir);

  return {
    summaries: snapshot.chapterSummaries.rows.map((row) => ({
      chapter: row.chapter,
      title: row.title,
      characters: row.characters,
      events: row.events,
      stateChanges: row.stateChanges,
      hookActivity: row.hookActivity,
      mood: row.mood,
      chapterType: row.chapterType,
    })),
      hooks: snapshot.hooks.hooks.map((hook) => ({
        hookId: hook.hookId,
        startChapter: hook.startChapter,
        type: hook.type,
        status: hook.status,
        lastAdvancedChapter: hook.lastAdvancedChapter,
        expectedPayoff: hook.expectedPayoff,
        payoffTiming: hook.payoffTiming,
        notes: hook.notes,
      })),
  };
}

export async function loadSnapshotCurrentStateFacts(
  bookDir: string,
  chapterNumber: number,
): Promise<ReadonlyArray<Fact>> {
  const snapshotDir = join(bookDir, "story", "snapshots", String(chapterNumber));
  const structuredState = await readJsonOrNull(
    join(snapshotDir, "state", "current_state.json"),
    CurrentStateStateSchema,
  );
  if (structuredState) {
    return structuredState.facts;
  }

  const markdown = await readFile(join(snapshotDir, "current_state.md"), "utf-8").catch(() => "");
  return parseCurrentStateFacts(markdown, chapterNumber);
}

async function readJson<T>(
  path: string,
  schema: { parse(value: unknown): T },
): Promise<T> {
  const raw = await readFile(path, "utf-8");
  return schema.parse(JSON.parse(raw));
}

async function readJsonOrNull<T>(
  path: string,
  schema: { parse(value: unknown): T },
): Promise<T | null> {
  try {
    return await readJson(path, schema);
  } catch {
    return null;
  }
}

/**
 * Attempt to auto-repair recoverable runtime state issues.
 * Currently handles:
 * - duplicate_hook_id: keeps the last occurrence (most recent write wins)
 * - duplicate_summary_chapter: keeps the last occurrence
 *
 * Returns the repaired snapshot, or undefined if the issues are not recoverable.
 */
function repairRuntimeState(
  snapshot: RuntimeStateSnapshot,
  issues: ReadonlyArray<{ readonly code: string; readonly message: string; readonly path?: string }>,
): RuntimeStateSnapshot | undefined {
  const recoverableCodes = new Set(["duplicate_hook_id", "duplicate_summary_chapter"]);
  const hasUnrecoverable = issues.some((issue) => !recoverableCodes.has(issue.code));
  if (hasUnrecoverable) return undefined;

  let hooks = snapshot.hooks;
  let chapterSummaries = snapshot.chapterSummaries;

  // Deduplicate hooks: last occurrence wins (most recently written)
  if (issues.some((issue) => issue.code === "duplicate_hook_id")) {
    const seen = new Map<string, number>();
    const deduped: typeof hooks.hooks = [];
    // Iterate in order; later entries overwrite earlier ones with the same hookId
    for (const hook of hooks.hooks) {
      seen.set(hook.hookId, deduped.length);
      deduped.push(hook);
    }
    // Now remove earlier duplicates: keep only the last entry per hookId
    const finalHooks: typeof hooks.hooks = [];
    const added = new Set<string>();
    for (let i = deduped.length - 1; i >= 0; i--) {
      const hook = deduped[i]!;
      if (!added.has(hook.hookId)) {
        added.add(hook.hookId);
        finalHooks.unshift(hook);
      }
    }
    hooks = { hooks: finalHooks };
  }

  // Deduplicate chapter summaries: last occurrence wins
  if (issues.some((issue) => issue.code === "duplicate_summary_chapter")) {
    const finalRows: typeof chapterSummaries.rows = [];
    const added = new Set<number>();
    for (let i = chapterSummaries.rows.length - 1; i >= 0; i--) {
      const row = chapterSummaries.rows[i]!;
      if (!added.has(row.chapter)) {
        added.add(row.chapter);
        finalRows.unshift(row);
      }
    }
    chapterSummaries = { rows: finalRows };
  }

  return {
    manifest: snapshot.manifest,
    currentState: snapshot.currentState,
    hooks,
    chapterSummaries,
  };
}
