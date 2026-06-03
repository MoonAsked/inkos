/**
 * OpenCode
 *
 * - 官网：https://opencode.ai/
 * - 控制台 / API key：https://opencode.ai/
 * - API 文档：https://opencode.ai/zen
 */
import type { InkosEndpoint } from "../types.js";

export const OPENCODE: InkosEndpoint = {
  id: "opencode",
  label: "OpenCode",
  group: "aggregator",
  api: "openai-completions",
  baseUrl: "https://opencode.ai/zen/v1",
  checkModel: "glm-5.1",
  temperatureRange: [0, 2],
  defaultTemperature: 1,
  writingTemperature: 1,
  compat: {
    supportsStore: false,
    supportsDeveloperRole: false,
    maxTokensField: "max_tokens",
    supportsUsageInStreaming: true,
  },
  models: [
    // ── Anthropic ──
    { id: "claude-opus-4-7", maxOutput: 32000, contextWindowTokens: 200000 },
    { id: "claude-opus-4-6", maxOutput: 32000, contextWindowTokens: 200000 },
    { id: "claude-opus-4-5", maxOutput: 32000, contextWindowTokens: 200000 },
    { id: "claude-opus-4-1", maxOutput: 32000, contextWindowTokens: 200000 },
    { id: "claude-sonnet-4-6", maxOutput: 64000, contextWindowTokens: 200000 },
    { id: "claude-sonnet-4-5", maxOutput: 64000, contextWindowTokens: 200000 },
    { id: "claude-sonnet-4", maxOutput: 64000, contextWindowTokens: 200000 },
    { id: "claude-haiku-4-5", maxOutput: 8192, contextWindowTokens: 200000 },
    // ── Google ──
    { id: "gemini-3.5-flash", maxOutput: 65536, contextWindowTokens: 1048576 },
    { id: "gemini-3.1-pro", maxOutput: 65536, contextWindowTokens: 1048576 },
    { id: "gemini-3-flash", maxOutput: 65536, contextWindowTokens: 1048576 },
    // ── OpenAI ──
    { id: "gpt-5.5", maxOutput: 32768, contextWindowTokens: 1047576 },
    { id: "gpt-5.5-pro", maxOutput: 100000, contextWindowTokens: 1047576 },
    { id: "gpt-5.4", maxOutput: 32768, contextWindowTokens: 1047576 },
    { id: "gpt-5.4-pro", maxOutput: 100000, contextWindowTokens: 1047576 },
    { id: "gpt-5.4-mini", maxOutput: 32768, contextWindowTokens: 1047576 },
    { id: "gpt-5.4-nano", maxOutput: 32768, contextWindowTokens: 1047576 },
    { id: "gpt-5.3-codex-spark", maxOutput: 100000, contextWindowTokens: 200000 },
    { id: "gpt-5.3-codex", maxOutput: 100000, contextWindowTokens: 200000 },
    { id: "gpt-5.2", maxOutput: 32768, contextWindowTokens: 1047576 },
    { id: "gpt-5.2-codex", maxOutput: 100000, contextWindowTokens: 200000 },
    { id: "gpt-5.1", maxOutput: 32768, contextWindowTokens: 1047576 },
    { id: "gpt-5.1-codex-max", maxOutput: 100000, contextWindowTokens: 200000 },
    { id: "gpt-5.1-codex", maxOutput: 100000, contextWindowTokens: 200000 },
    { id: "gpt-5.1-codex-mini", maxOutput: 100000, contextWindowTokens: 200000 },
    { id: "gpt-5", maxOutput: 32768, contextWindowTokens: 1047576 },
    { id: "gpt-5-codex", maxOutput: 100000, contextWindowTokens: 200000 },
    { id: "gpt-5-nano", maxOutput: 32768, contextWindowTokens: 1047576 },
    // ── xAI ──
    { id: "grok-build-0.1", maxOutput: 32768, contextWindowTokens: 131072 },
    // ── 智谱 ──
    { id: "glm-5.1", maxOutput: 32000, contextWindowTokens: 204800, enabled: true },
    { id: "glm-5", maxOutput: 32000, contextWindowTokens: 204800 },
    // ── MiniMax ──
    { id: "minimax-m2.7", maxOutput: 32000, contextWindowTokens: 204800, enabled: true },
    { id: "minimax-m2.5", maxOutput: 32000, contextWindowTokens: 204800 },
    // ── 月之暗面 ──
    { id: "kimi-k2.6", maxOutput: 32000, contextWindowTokens: 262144, temperature: 1 },
    { id: "kimi-k2.5", maxOutput: 32000, contextWindowTokens: 262144, temperature: 1 },
    // ── 阿里 ──
    { id: "qwen3.6-plus", maxOutput: 32000, contextWindowTokens: 262144, enabled: true },
    { id: "qwen3.5-plus", maxOutput: 32000, contextWindowTokens: 262144 },
    // ── 其他 ──
    { id: "big-pickle", maxOutput: 4096, contextWindowTokens: 32768 },
    // ── 免费模型 ──
    { id: "deepseek-v4-flash-free", maxOutput: 4096, contextWindowTokens: 163840 },
    { id: "qwen3.6-plus-free", maxOutput: 4096, contextWindowTokens: 262144 },
    { id: "minimax-m2.5-free", maxOutput: 4096, contextWindowTokens: 204800 },
    { id: "nemotron-3-super-free", maxOutput: 4096, contextWindowTokens: 32768 },
  ],
};
