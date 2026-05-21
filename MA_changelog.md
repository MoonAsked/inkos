# InkOS 改动日志

## 导入基础设定合并功能 (import foundation merge)

### 功能描述

在 `import chapters` 过程中，每导入一章（或按 N 章间隔），自动将当前章节合并到所有基础设定文件中，实现基础设定的**增量演进**。

解决了以下问题：
- `book create` 产生的空 foundation 不会被章节导入覆盖
- 超长篇小说（2047+ 章）中后出现的角色不会丢失
- 角色的 `## 当前现状` 等字段随剧情实时更新
- `story_frame`、`volume_map`、`book_rules` 等随剧情推进逐步完善

### 工作流程

```
import chapters 执行
  │
  ├─ Step 1: 检测 book create 空 foundation → 重新生成（基于导入内容）
  │
  └─ Step 2: 逐章分析
       │
       ├─ 分析章节（原有）
       ├─ 保存章节（原有）
       └─ 合并基础设定（新增）
            ├─ 读取现有 story_frame, volume_map, book_rules, roles
            ├─ 传给 architect（当前章节正文 + 现有基础设定上下文）
            └─ 写回 story_frame.md, volume_map.md, book_rules.md, roles/
```

关键设计：
- 每次只传**当前 1 章**给 architect，不是累计全部章节（效率高）
- 现有基础设定作为**外部上下文**一并传入（architect 做合并而非覆盖）
- 运行时文件（current_state, pending_hooks, emotional_arcs 等）**不受影响**
- 角色文件**只写不删**，不会丢失之前章节出现过的角色

### 已修复的问题

#### roles 未写入（Phase 5 / Legacy 格式混淆）

**现象**：`mergeChapterIntoFoundation` 的 log 显示"基础设定已合并"，但 roles/ 目录的文件没有被更新（时间戳不变）。

**根因**：`parseSections()`（architect.ts）中有 legacy 兼容逻辑：
```typescript
const usingLegacyOutlineNames = !storyFrame && !volumeMap
    && (legacyStoryBible.length > 0 || legacyVolumeOutline.length > 0);
```
外部上下文传入了 `## 已有故事框架` 等 markdown 标题格式的数据，LLM 输出的 section 名被带偏从 `=== SECTION: story_frame ===` 变为 `=== SECTION: story_bible ===`（旧格式）。此时 `storyFrame` 为空、`legacyStoryBible` 有值 → `usingLegacyOutlineNames = true` → roles 段变成可选 → `foundation.roles` 为空数组 → `mergeChapterIntoFoundation` 中 `if (foundation.roles?.length > 0)` 为 false → 不写角色文件。

**修复**：外部上下文指令中明确要求使用 `=== SECTION: ===` Phase 5 格式输出，禁止旧版 `story_bible`/`volume_outline` 格式。

### 改动代码

#### CLI: `packages/cli/src/commands/import.ts`

**新增 `--foundation-interval` 选项：**
```
.option("--foundation-interval <n>", "...Default: 1 (every chapter)", parseInt)
```
控制每 N 章执行一次 foundation merge。默认 1（每章），设为 0 禁用。

**自动日志保存：**
```typescript
const logDir = resolve(root, "logs");
await mkdir(logDir, { recursive: true });
const logPath = join(logDir, `import-${bookId}-${ts}.jsonl`);
const pipeline = new PipelineRunner(buildPipelineConfig(config, root, {
  logFile: createWriteStream(logPath, { flags: "a" }),
}));
```
不再需要 `--log-file` 参数，每次 import 自动在 `{projectRoot}/logs/` 下生成 JSON Lines 格式日志文件。

**新增 imports：**
```typescript
import { mkdir } from "node:fs/promises";
import { createWriteStream } from "node:fs";
```

---

#### Core Pipeline: `packages/core/src/pipeline/runner.ts`

**`ImportChaptersInput` 接口新增字段：**
```typescript
readonly foundationInterval?: number;
```

**Step 1 foundation 生成逻辑修改（line ~2517）：**
```typescript
// 检测 book create 空 foundation
const hasExistingImportChapters = (await this.state.loadChapterIndex(input.bookId)).length > 0;
const foundationFromBookCreate = foundationAlreadyExists && !hasExistingImportChapters;
const needsFoundation = startFrom === 1 && (!foundationAlreadyExists || foundationFromBookCreate);
```
当 `isCompleteBookDirectory` 返回 true 但实际无章节（book create 场景），仍然会重新生成 foundation。

**Step 2 每章合并调用（line ~2737）：**
```typescript
const fi = input.foundationInterval ?? 0;
if (fi > 0 && (chapterNumber % fi === 0 || i === input.chapters.length - 1)) {
  await this.mergeChapterIntoFoundation(...);
}
```

**新增 `mergeChapterIntoFoundation` 方法（line ~2960）：**
```typescript
private async mergeChapterIntoFoundation(
  bookId, book, bookDir, chapter, chapterNumber,
  _numericalSystem, language, importMode,
): Promise<void>
```

核心逻辑：
1. `readStoryFrame()` / `readVolumeMap()` / `readRoleCards()` / `readRhythmPrinciples()` 读取现有基础设定
2. `readFile(book_rules.md)` 读取书籍规则
3. 将所有现有基础设定格式化为 `externalContext`，传给 `architect.generateFoundationFromImport()`
4. 遍历 architect 返回的 5 个 section，写入对应文件：
   - `storyFrame` → `story/outline/story_frame.md`
   - `volumeMap` → `story/outline/volume_map.md`
   - `bookRules` → `story/book_rules.md`
   - `roles` → `story/roles/主要角色/*.md` 和 `story/roles/次要角色/*.md`（只写不删）
   - `rhythmPrinciples` → `story/outline/节奏原则.md`（有则写，无则跳过）

**新增 imports：**
```typescript
import { readRhythmPrinciples, readRoleCards } from "../utils/outline-paths.js";
```

---

#### Agent: `packages/core/src/agents/sensitive-words.ts`

新增敏感词检测 agent 文件（从主分支同步）。

---

#### Pipeline: `packages/core/src/pipeline/chapter-review-cycle.ts`

Review cycle 类型定义增加 `analyzeSensitiveWords`（从主分支同步）。

---

### 不确定分支适配

所有改动同步到 `inkos_uncertain` 分支，额外同步了缺失的依赖文件：
- `sensitive-words.ts`
- `chapter-review-cycle.ts`（含类型定义更新）
- `chapter-review-cycle.test.ts`（测试 mock 适配）

---

## 分支功能合并（master ↔ uncertain 双向同步）

### 背景

`inkos_master` 和 `inkos_uncertain` 两个分支各自新增了不同的功能，长期未同步。本次进行双向兼并，使两个分支互为功能超集。

### 同步方向：master → uncertain（增强稳定性/容错性）

| 文件 | 功能 |
|------|------|
| `models/book.ts` | platform 标准化函数（`normalizePlatformId`, `normalizePlatformOrOther`） |
| `agents/architect.ts` | LLM 输出重试循环（缺失 section 自动重试）、上下文窗口截断、YAML frontmatter 恢复 |
| `agents/chapter-analyzer.ts` | 上下文窗口预算计算和章节内容截断 |
| `agents/base.ts` | stream progress 的 agent label 标识 |
| `utils/chapter-splitter.ts` | HTML/广告/水印清洗功能 |
| `utils/effective-llm-config.ts` | contextWindow 配置透传 |
| `llm/service-resolver.ts` | Ollama 等本地端点可免 API key |
| `llm/providers/probe.ts` | apiKey/baseUrl 空值检查逻辑 |
| `agent/agent-tools.ts` | SubAgent 的 platform 预处理 |
| `pipeline/agent.ts` | bookId/platform 标准化调用 |
| `interaction/project-tools.ts` | platform/bookId 标准化函数 |
| `notify/dispatcher.ts` | 通知分发器（动态 import） |
| `index.ts` | 导出敏感词分析、platform 标准化函数 |
| `cli/utils.ts` | 流式进度日志格式（时间戳/label/thinkingChars） |
| `cli/commands/book.ts` | platform/bookId 标准化 |
| `cli/commands/fanfic.ts` | platform/bookId 标准化 |

### 同步方向：uncertain → master（新增功能）

| 文件 | 功能 |
|------|------|
| `agents/planner-prompts.ts` | **每章用户指令**（`buildChapterContextBlock`），优先级高于卷纲 |
| `utils/chapter-memo-parser.ts` | goal 长度限制收紧 80→50 字 |
| `llm/service-presets.ts` | **providerFamily 显式解析** |
| `llm/providers/endpoints/sensenova.ts` | 新增 SenseChat-5-beta 模型、deepseek-v4-flash maxOutput 调整 |
| `llm/providers/endpoints/volcengine.ts` | checkModel 更换为 doubao-lite-32k |

---

## 章节导入增强、LLM 稳定性改进与 SENSENOVA_2 提供商接入

### 功能描述

本次改动聚焦三大方向：

1. **章节导入（import）大幅增强**：auto-create book（导入不存在的书时自动创建）、`--foundation-interval` 逐章合并基础设定、自动日志保存到 `logs/` 目录、resume-from 行为优化
2. **LLM 层稳定性提升**：maxTokens 硬钳位到模型 maxOutput 防止 400 错误、section 预算硬截断防止关键 section 被挤掉、流式进度加入 `currentSection`/`recentText` 调试信息、日志从 `console.warn` 迁移到结构化 Logger
3. **SENSENOVA_2 提供商接入**：新增 sensenova2.ts 端点定义，所有 provider 计数测试同步更新

### 改动代码

---

#### CLI: `packages/cli/src/commands/import.ts`

**Auto-create book & log 自动保存：**
```typescript
// 导入不存在的书时自动创建 BookConfig
if (bookIdArg && e instanceof Error && e.message.includes("not found")) {
  bookId = deriveBookIdFromTitle(bookIdArg) || `book-${Date.now().toString(36)}`;
  // ...创建 BookConfig 并 saveBookConfig
}

// 自动日志保存到 {projectRoot}/logs/
const logDir = resolve(root, "logs");
await mkdir(logDir, { recursive: true });
const logPath = join(logDir, `import-${bookId}-${ts}.jsonl`);
```

**`--foundation-interval` 选项（默认 1）：**
```typescript
.option("--foundation-interval <n>", "...Default: 1 (every chapter)", parseInt)
```

**resume-from 行为变更：** resume-from 回退一章（从 `existingChapterCount + 1` → `existingChapterCount`），确保前一章的分析/截图等步骤完整完成。

**新增 imports：** `deriveBookIdFromTitle`、`normalizePlatformOrOther`、`BookConfig`、`mkdir`、`createWriteStream`。

---

#### CLI: `packages/core/src/agents/planner-prompts.ts`

**新增 `buildChapterContextBlock`（每章用户指令）：**
```typescript
function buildChapterContextBlock(chapterContext: string, language: "zh" | "en"): string {
  // 返回 "## 本章用户指令（本章最高优先级）" 或 "## Per-chapter user instruction"
  // memo 必须优先遵守它，再参考卷纲兜底
}
```

模板中新增 `{{chapter_context_block}}` 占位符，`PlannerUserMessageInput` 新增 `chapterContext` 字段。

**goal 长度收紧：** 80 → 50 字。

---

#### CLI: `packages/cli/src/utils.ts`

**INKOS_LOG_LEVEL 环境变量支持：**
```typescript
const envLevel = process.env.INKOS_LOG_LEVEL as LogLevel | undefined;
const minLevel: LogLevel = (envLevel && ["debug", "info", "warn", "error"].includes(envLevel)) ? envLevel : "info";
```

**Stream progress 增强：** 显示 `currentSection`（当前生成的 SECTION 名称）和 `recentText`（最近 200 字符输出预览，debug 级别）。

---

#### Core Pipeline: `packages/core/src/pipeline/runner.ts`

**Step 1 foundation 检测增强：** 识别 `book create` 空 foundation（目录完整但无章节）→ 重新生成。

**Step 2 每章 foundation merge：** 通过 `--foundation-interval` 控制频率。核心方法 `mergeChapterIntoFoundation()` 读取现有 `story_frame`、`volume_map`、`roles`、`book_rules`、`rhythm_principles`，传给 `architect.generateFoundationFromImport()` 做增量合并，写回磁盘。角色文件采用 dedup（同名同 canonical 取 major）、existing-name 匹配复用（防止重复文件）。

**新增 debug 日志：** 关键阶段添加 `this.logDebug(...)` 便于排查。

---

#### Agent: `packages/core/src/agents/architect.ts`

**maxTokens 提升：** `generateFoundation`/`generateFoundationFromImport` 的 `maxTokens` 从 20480→131072，适应超长输出。

**Section 预算硬截断：**
```typescript
const SECTION_BUDGET = { story_frame: 3000, volume_map: 5000, roles: 8000, book_rules: 500, pending_hooks: 2000 };
// 超预算 section 被硬截断，防止 book_rules 过长挤掉 pending_hooks
```

**`prepareRoleWrites()` 新方法：** 角色文件写入前做 cross-tier dedup（同名 major 覆盖 minor），扫描已有文件复用文件名，移除旧层级文件。

**精简 retry 提示：** 明确告知 LLM 超预算原因和预算限制。

---

#### Core LLM: `packages/core/src/llm/provider.ts`

**StreamProgress 接口扩展：**
```typescript
readonly recentText?: string;        // 最近 500 字符滑动窗口
readonly currentSection?: string;    // 当前生成的 SECTION 名称
```

**createStreamMonitor 增强：** 跟踪 `=== SECTION: ===` 标记，扫描最近文本检测当前 section。

**maxTokens 硬钳位：**
```typescript
// chatCompletion 和 chatWithTools 都做钳位
const modelMaxOutput = client._piModel?.maxTokens;
const clampedMaxTokens = modelMaxOutput && rawMaxTokens > modelMaxOutput ? modelMaxOutput : rawMaxTokens;
```

**日志改进：** `providerWarn`/`providerDebug` 函数替代 `console.warn`，`LLMClient` 新增 `_logger` 字段，`createLLMClient` 接受可选 Logger 参数。

---

#### Core LLM Providers

**`sensenova.ts`：** 新增 `SenseChat-5-beta` 模型；`deepseek-v4-flash` maxOutput 从 65536 降至 8192；更新 API 文档链接。

**`volcengine.ts`：** `checkModel` 从 `doubao-seed-2.0-lite` 更换为 `doubao-lite-32k`。

**`index.ts`：** 注册 `SENSENOVA_2` 端点。provider 总数从 43→44（base 35→36）。

**`sensenova2.ts`（新文件）：** 新增 SenseNova 第二端点定义，包含 `SenseChat-5-beta`、`deepseek-v4-flash` 等模型。

**`service-presets.ts`：** 显式 `providerFamily` 解析（`preset?.providerFamily ?? (provider?.api.startsWith("anthropic") ? "anthropic" : "openai")`）；nvidia/ollama 条目顺序交换。

---

#### Core Utils: `packages/core/src/utils/outline-paths.ts`

**新增 `sanitizeRoleFileName`：** 清理角色名为安全文件名（替换非法字符、折叠连续下划线、修剪首尾下划线）。

**新增 `canonicalRoleName`：** 剥离 Markdown 格式标记（`*`、`_`、`"`、`《》`等）获取规范名用于 dedup 匹配。

---

#### Core: `packages/core/src/utils/chapter-memo-parser.ts`

goal 长度校验从 80→50 字，与 planner-prompts 对齐。

---

#### Studio: `packages/studio/src/api/server.ts`

`onStreamProgress` 回调透传 `currentSection` 字段。

---

#### Tests

| 文件 | 变更 |
|------|------|
| `architect.test.ts` | maxTokens 断言从 `not.toHaveProperty("maxTokens")` → `toEqual(131072)` |
| `outline-paths.test.ts` | 新增 `sanitizeRoleFileName` 和 `canonicalRoleName` 测试套件（各 4-5 用例） |
| `providers-group.test.ts` | china 组新增 `sensenova_2` |
| `providers-schema.test.ts` | B2 计数 6→7，B4 计数 35→36，B6 计数 43→44 |
| `server.test.ts` | china 组 18→19、总数 42→43
