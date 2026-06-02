export interface SplitChapter {
  readonly title: string;
  readonly content: string;
}

export interface VolumeInfo {
  readonly volumeNumber: number;
  readonly label: string;
  readonly title: string;
  readonly chapterStart: number;
  readonly chapterEnd: number;
  readonly chapterCount: number;
}

/**
 * Split a single text file into chapters by matching title lines,
 * then clean noise (ads, HTML, watermarks) from chapter content.
 *
 * Default pattern matches:
 * - "第一章 xxxx" / "第1章 xxxx"
 * - "第一卷001章 xxxx" / "第一卷1章 xxxx" (volume + chapter)
 * - "第一节 xxxx" / "第1节 xxxx" (section as chapter)
 * - "第一節 xxxx" / "第1節 xxxx" (traditional Chinese)
 * - "第一回 xxxx" / "第1回 xxxx"
 * - "# 第1章 xxxx" / "## 第23章 xxxx"
 * - "CHAPTER I." / "CHAPTER II."
 * - "001章 xxxx" / "1234章 xxxx" (bare number + 章, no 第 prefix)
 * - "第三十二卷1707章 xxxx" (volume Chinese + chapter Arabic, no space)
 *
 * Each match marks the start of a new chapter. Content between matches
 * belongs to the preceding chapter.
 */
export function splitChapters(
  text: string,
  pattern?: string,
): ReadonlyArray<SplitChapter> {
  // [零〇○Ｏ０一二三四五六七八九十百千万\d]+ matches Chinese/Arabic volume number
  // \d* matches optional Arabic chapter number after volume (e.g., 第一卷001章)
  // Group 1: title after 第X章/第X回/第X节
  // Group 2: title after Chapter N
  // Group 3: full match for bare NNN章 (no 第 prefix) — title extracted separately
  const defaultPattern = /^#{0,2}\s*(?:第[零〇○Ｏ０一二三四五六七八九十百千万\d]+卷?\d*(?:章|回|节|節)(?:[:：]|\s+)?\s*(.*)|Chapter\s+(?:\d+|[IVXLCDM]+)(?:\.|:|\s+)?\s*(.*)|(\d{2,4}章\s*\S.*))/i;
  const regex = pattern ? new RegExp(pattern, "m") : defaultPattern;

  const lines = text.split("\n");
  const chapters: Array<{ title: string; startLine: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i]!.match(regex);
    if (match) {
      // Group 1/2: title after 第X章 or Chapter N
      // Group 3: bare NNN章 heading — extract title by stripping the number prefix
      const title = (match[1] ?? match[2] ?? "").trim();
      const bareTitle = match[3] ? extractBareChapterTitle(match[3].trim()) : "";
      chapters.push({
        title: title || bareTitle,
        startLine: i,
      });
    }
  }

  if (chapters.length === 0) {
    return [];
  }

  const result: SplitChapter[] = [];

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i]!;
    const nextStart = i + 1 < chapters.length ? chapters[i + 1]!.startLine : lines.length;

    // Content starts after the title line
    const contentLines = lines.slice(chapter.startLine + 1, nextStart);
    const content = stripTrailingLicense(cleanChapterNoise(contentLines.join("\n"))).trim();

    result.push({
      title: chapter.title || inferFallbackTitle(lines[chapter.startLine] ?? "", i + 1),
      content,
    });
  }

  return result;
}

/**
 * Extract title from bare chapter heading like "1188章巧合" → "巧合"
 */
function extractBareChapterTitle(bareMatch: string): string {
  if (!bareMatch) return "";
  // Remove the leading "NNN章" part, keep the rest as title
  const stripped = bareMatch.replace(/^\d{2,4}章\s*/, "").trim();
  return stripped;
}

/**
 * Clean noise from chapter content:
 * - Advertisement lines (推荐好文, TXT下载, etc.)
 * - HTML tags and entities (&lt;, &gt;, &amp;, &quot;, <a href>, etc.)
 * - Piracy site watermarks (最快更新, 无弹窗, 百度搜索, etc.)
 * - Separator-only lines (----)
 * - Trailing garbage after &gt;，
 */
function cleanChapterNoise(content: string): string {
  const lines = content.split("\n");
  const cleaned: string[] = [];

  for (const line of lines) {
    const stripped = line.trim();

    // Skip empty lines (preserve one blank line for paragraph breaks)
    if (stripped === "") {
      if (cleaned.length === 0 || cleaned[cleaned.length - 1] !== "") {
        cleaned.push("");
      }
      continue;
    }

    // Skip advertisement / recommendation lines
    if (isAdLine(stripped)) continue;

    // Skip separator-only lines (----)
    if (/^-{3,}$/.test(stripped)) continue;

    // Clean HTML entities and tags from the line
    const cleanedLine = cleanHtmlFromLine(stripped);
    if (!cleanedLine) continue;

    // Skip piracy site watermarks embedded in prose lines
    const dedupedLine = stripWatermark(cleanedLine);
    if (!dedupedLine) continue;

    cleaned.push(dedupedLine);
  }

  // Remove leading/trailing blank lines
  while (cleaned.length > 0 && cleaned[0] === "") cleaned.shift();
  while (cleaned.length > 0 && cleaned[cleaned.length - 1] === "") cleaned.pop();

  return cleaned.join("\n");
}

/**
 * Detect advertisement / spam lines that should be completely removed.
 */
function isAdLine(line: string): boolean {
  // Short-circuit: most ad lines are relatively short
  if (line.length > 300) return false;

  // Recommendation lines: "推荐好文：《xxx》作者：xxx。..."
  if (/^推荐好文[：:]/.test(line)) return true;

  // "TXT下载" standalone or at start
  if (/^TXT下载/.test(line)) return true;

  // "章节目录" standalone
  if (/^章节目录$/.test(line)) return true;

  // Pure HTML link lines: "&lt;a href=...&gt;...&lt;/a&gt;"
  if (/^&lt;a\s/.test(line) && /&lt;\/a&gt;$/.test(line)) return true;

  // Lines that are ONLY HTML tags/entities
  if (/^(?:&[a-z]+;|<[^>]+>)+$/.test(line)) return true;

  // "全文阅读" standalone link
  if (/^全文阅读&lt;a\s/.test(line)) return true;

  // Common piracy site boilerplate (standalone lines)
  if (/^(?:无弹窗|无广告|全文免费|免费阅读|最新章节|章节错乱|报错|求月票|求推荐|求收藏|求鲜花|求打赏|加更规则)/.test(line)) return true;

  // "一秒记住" / "天才一秒钟记住" type lines
  if (/^(?:天才一秒钟|一秒|三秒|五秒)记住/.test(line)) return true;

  // "请记住本书首发域名" / "手机版阅读网址"
  if (/^请记住本书/.test(line)) return true;
  if (/^手机版阅读/.test(line)) return true;

  // "本书最新更新" / "更多最新章节"
  if (/^(?:本书最新|更多最新)/.test(line)) return true;

  // "新章节更新" / "更新最快"
  if (/^(?:新章节更新|更新最快)/.test(line)) return true;

  // "百度搜索" standalone
  if (/^百度搜索/.test(line) && line.length < 50) return true;

  // Trailing ">" or "，>" garbage
  if (/^[，,]?&gt;[，,]?$/.test(line)) return true;
  if (/^[，,]?>[，,]?$/.test(line)) return true;

  return false;
}

/**
 * Clean HTML entities and tags from a line of text.
 * Returns empty string if the line becomes empty after cleaning.
 */
function cleanHtmlFromLine(line: string): string {
  let result = line;

  // IMPORTANT: Remove TXT下载/全文阅读 link patterns FIRST, before general HTML tag removal,
  // because the general removal would destroy the structure these patterns rely on.
  // Also handle when TXT下载 is embedded mid-line (e.g., "同志TXT下载&lt;a...&gt;首席御医&lt;/a&gt;！")
  // Use [^]*? (matches any char including newline) instead of [^&]*? to handle &quot; attributes
  result = result.replace(/TXT下载&lt;a\s[^]*?&gt;[^]*?&lt;\/a&gt;\.?/g, "");
  result = result.replace(/全文阅读&lt;a\s[^]*?&gt;[^]*?&lt;\/a&gt;\.?/g, "");

  // Remove standalone &lt;a href=...&gt;title&lt;/a&gt; patterns (embedded in prose)
  // Keep the link text (group 1) as it may be part of the sentence
  result = result.replace(/&lt;a\s[^]*?&gt;([^]*?)&lt;\/a&gt;/g, "$1");

  // Remove HTML tags (both real <tag> and entity-encoded &lt;tag&gt;)
  result = result.replace(/&lt;\/?[a-zA-Z][^]*?&gt;/g, "");
  result = result.replace(/<[^>]+>/g, "");

  // Remove <h3>NNN章 title</h3> patterns
  result = result.replace(/<h\d>\s*\d+章\s*[^<]*\s*<\/h\d>/g, "");

  // Decode common HTML entities
  result = result.replace(/&lt;/g, "<");
  result = result.replace(/&gt;/g, ">");
  result = result.replace(/&amp;/g, "&");
  result = result.replace(/&quot;/g, '"');
  result = result.replace(/&apos;/g, "'");
  result = result.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  // After entity decoding, remove any newly revealed HTML tags
  result = result.replace(/<[^>]+>/g, "");

  // Clean up trailing ">" or "，>" garbage that often appears after ad removal
  result = result.replace(/[，,]?\s*&gt;[，,]?\s*$/g, "");
  result = result.replace(/[，,]?\s*>\s*$/g, "");

  // Clean up |三八文学 type watermarks (pipe + site name)
  result = result.replace(/\|三八文学/g, "");

  // Clean up ( ) empty parentheticals
  result = result.replace(/\(\s*\)/g, "");

  // Clean up ﻿ (BOM) characters
  result = result.replace(/\uFEFF/g, "");

  return result.trim();
}

/**
 * Strip embedded watermark phrases from a prose line.
 * These are phrases injected into the middle of normal text by piracy sites.
 * Returns empty string if the entire line is a watermark.
 */
function stripWatermark(line: string): string {
  let result = line;

  // "寻找最快更新网站，请百度搜索+看书网" type embedded watermarks
  result = result.replace(/寻找最快更新网站，请百度搜索[^\s，。！？]*/g, "");

  // "寻找最快更新网站" standalone
  result = result.replace(/寻找最快更新网站/g, "");

  // "最快更新" + site name pattern
  result = result.replace(/最快更新[^\s，。！？]{0,30}/g, "");

  // "A ，最快更新特种兵在都市最新章节！" type prefixes
  result = result.replace(/A\s*，\s*最快更新[^！!]+[！!]\s*/g, "");

  // "更新最快" + site name
  result = result.replace(/更新最快[^\s，。！？]{0,30}/g, "");

  // "无弹窗" embedded
  result = result.replace(/无弹窗[^\s，。！？]{0,20}/g, "");

  // "百度搜索" embedded (short)
  result = result.replace(/百度搜索[^\s，。！？]{0,20}/g, "");

  // "本章未完，点击下一页继续阅读" type
  result = result.replace(/本章未完.*?继续阅读[^。！？]*[。！？]?/g, "");

  // "手机用户请浏览" type
  result = result.replace(/手机用户请浏览[^。！？]*[。！？]?/g, "");

  // Trailing ad fragments: "——xxx网" or "——来自xxx"
  result = result.replace(/\s*[—–-]{2}\s*(?:来自|看书|笔趣|起点|纵横|创世|17k|八一|八六|九九|飘天|飞天|逆天|天才|奇书|书海|阅文|中文|小说|文学|网文).+$/g, "");

  return result.trim();
}

function stripTrailingLicense(content: string): string {
  const trailerMatch = content.match(/^\s*Project Gutenberg(?:™|\(TM\))?.*$/im);
  if (!trailerMatch || trailerMatch.index === undefined) {
    return content;
  }

  return content.slice(0, trailerMatch.index).trimEnd();
}

function inferFallbackTitle(headingLine: string, chapterNumber: number): string {
  if (/chapter\s+(?:\d+|[ivxlcdm]+)/i.test(headingLine)) {
    return `Chapter ${chapterNumber}`;
  }

  if (/第[零一二三四五六七八九十百千万\d]+回/.test(headingLine)) {
    return `第${chapterNumber}回`;
  }

  if (/第[零一二三四五六七八九十百千万\d]+[节節]/.test(headingLine)) {
    return `第${chapterNumber}节`;
  }

  return `第${chapterNumber}章`;
}

const VOLUME_DETECT_PATTERNS: ReadonlyArray<RegExp> = [
  /^\s*第\s*([零一二三四五六七八九十百千\d]+)\s*卷[：:．.\s]*(.*)/u,
  /^\s*(?:volume|vol\.?)\s+(\d+)[：:．.\s]*(.*)/i,
];

const CHINESE_NUMERAL_MAP: Readonly<Record<string, number>> = {
  零: 0, 一: 1, 二: 2, 三: 3, 四: 4,
  五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
  十: 10, 百: 100, 千: 1000,
};

function parseVolumeNumber(token: string): number {
  if (/^\d+$/.test(token)) return parseInt(token, 10);
  // Handle simple single Chinese numeral
  if (token.length === 1 && CHINESE_NUMERAL_MAP[token] !== undefined) {
    return CHINESE_NUMERAL_MAP[token]!;
  }
  // Handle compound numerals up to 99 (e.g., 二十五)
  if (token.includes("十")) {
    const parts = token.split("十");
    const tens = parts[0] ? CHINESE_NUMERAL_MAP[parts[0]] ?? 1 : 1;
    const ones = parts[1] ? CHINESE_NUMERAL_MAP[parts[1]] ?? 0 : 0;
    return tens * 10 + ones;
  }
  return 1; // fallback
}

/**
 * Group already-split chapters by volume by scanning each chapter's title
 * and leading content for volume markers like "第X卷", "Volume X", "Vol. X".
 *
 * Returns an array of VolumeInfo describing each detected volume and the
 * chapter range it covers. If no volume markers are found, returns a single
 * volume containing all chapters.
 */
export function groupChaptersByVolume(
  chapters: ReadonlyArray<SplitChapter>,
): ReadonlyArray<VolumeInfo> {
  const volumes: Array<{ volumeNumber: number; label: string; title: string; startIndex: number }> = [];
  let lastVolumeNum = 1;
  let lastVolumeTitle = "";

  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i]!;
    const searchText = ch.title.length > 0 ? ch.title : ch.content.slice(0, 200);
    let foundVolume: number | null = null;
    let foundTitle = "";

    for (const pattern of VOLUME_DETECT_PATTERNS) {
      const match = searchText.match(pattern);
      if (match) {
        foundVolume = parseVolumeNumber(match[1]!);
        foundTitle = (match[2] ?? "").trim();
        break;
      }
    }

    if (foundVolume !== null) {
      lastVolumeNum = foundVolume;
      lastVolumeTitle = foundTitle;
      // Only register a new volume entry if we haven't seen this volume number
      if (!volumes.some((v) => v.volumeNumber === foundVolume)) {
        volumes.push({
          volumeNumber: foundVolume,
          label: /^[a-z]/i.test(foundTitle) ? `Volume ${foundVolume}` : `第${foundVolume}卷`,
          title: foundTitle,
          startIndex: i,
        });
      }
    }
  }

  // If no volumes detected, wrap everything in one volume
  if (volumes.length === 0) {
    return [
      {
        volumeNumber: 1,
        label: "第1卷",
        title: "",
        chapterStart: 0,
        chapterEnd: chapters.length - 1,
        chapterCount: chapters.length,
      },
    ];
  }

  // Build the final volume info with chapter ranges
  const result: VolumeInfo[] = [];
  for (let v = 0; v < volumes.length; v++) {
    const vol = volumes[v]!;
    const nextStart = v + 1 < volumes.length ? volumes[v + 1]!.startIndex : chapters.length;
    result.push({
      volumeNumber: vol.volumeNumber,
      label: vol.label,
      title: vol.title,
      chapterStart: vol.startIndex,
      chapterEnd: nextStart - 1,
      chapterCount: nextStart - vol.startIndex,
    });
  }

  return result;
}
