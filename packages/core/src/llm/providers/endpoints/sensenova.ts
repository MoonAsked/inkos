/**
 * 商汤日日新 (SenseNova)
 *
 * - 官网：https://platform.sensenova.cn/
 * - 控制台 / API key：https://platform.sensenova.cn/console
 * - API 文档：https://platform.sensenova.cn/docs
 * - Base URL：https://token.sensenova.cn/v1（OpenAI SDK 兼容）
 */
import type { InkosEndpoint } from "../types.js";

export const SENSENOVA: InkosEndpoint = {
  id: "sensenova",
  label: "商汤日日新",
  group: "china",
  api: "openai-completions",
  baseUrl: "https://token.sensenova.cn/v1",
  checkModel: "sensenova-6.7-flash-lite",
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
    // ── SenseNova 6.7 系列（2025 新 API，token.sensenova.cn） ──
    {
      id: "sensenova-6.7-flash-lite",
      maxOutput: 65536,
      contextWindowTokens: 262144,
      enabled: true,
      releasedAt: "2025-05-04",
      capabilities: { text: true, imageInput: true, tools: true, reasoning: true },
    },
    // ── SenseNova U1 系列（信息图生成，/v1/images/generations） ──
    {
      id: "sensenova-u1-fast",
      maxOutput: 4096,
      contextWindowTokens: 4096,
      enabled: true,
      releasedAt: "2025-05-04",
      status: "nonText",
      capabilities: { text: false, imageOutput: true },
    },
    // ── DeepSeek V4 Flash（商汤托管） ──
    {
      id: "deepseek-v4-flash",
      maxOutput: 65536,
      contextWindowTokens: 262144,
      enabled: true,
      releasedAt: "2025-05-04",
      capabilities: { text: true, tools: true, reasoning: true },
    },
    // ── 旧兼容模式模型（api.sensenova.cn/compatible-mode/v1） ──
    { id: "SenseNova-V6-5-Pro", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-07-23" },
    { id: "SenseNova-V6-5-Turbo", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-07-23" },
    { id: "Qwen3-235B", maxOutput: 4096, contextWindowTokens: 32768, releasedAt: "2025-05-27" },
    { id: "Qwen3-32B", maxOutput: 4096, contextWindowTokens: 32768, releasedAt: "2025-05-27" },
    { id: "SenseNova-V6-Reasoner", maxOutput: 4096, contextWindowTokens: 32768, releasedAt: "2025-04-14" },
    { id: "SenseNova-V6-Turbo", maxOutput: 4096, contextWindowTokens: 32768, releasedAt: "2025-04-14" },
    { id: "SenseNova-V6-Pro", maxOutput: 4096, contextWindowTokens: 32768, releasedAt: "2025-04-14" },
    { id: "SenseChat-5-1202", maxOutput: 4096, contextWindowTokens: 32768, releasedAt: "2024-12-30" },
    { id: "SenseChat-Turbo-1202", maxOutput: 4096, contextWindowTokens: 32768, releasedAt: "2024-12-30" },
    { id: "SenseChat-5", maxOutput: 131072, contextWindowTokens: 131072 },
    { id: "SenseChat-Vision", maxOutput: 16384, contextWindowTokens: 16384, releasedAt: "2024-09-12" },
    { id: "SenseChat-Turbo", maxOutput: 32768, contextWindowTokens: 32768 },
    { id: "SenseChat-128K", maxOutput: 131072, contextWindowTokens: 131072 },
    { id: "SenseChat-32K", maxOutput: 32768, contextWindowTokens: 32768 },
    { id: "SenseChat", maxOutput: 4096, contextWindowTokens: 4096 },
    { id: "SenseChat-5-Cantonese", maxOutput: 32768, contextWindowTokens: 32768 },
    { id: "SenseChat-Character", maxOutput: 1024, contextWindowTokens: 8192 },
    { id: "SenseChat-Character-Pro", maxOutput: 4096, contextWindowTokens: 32768 },
    { id: "DeepSeek-V3", maxOutput: 4096, contextWindowTokens: 32768 },
    { id: "DeepSeek-R1", maxOutput: 4096, contextWindowTokens: 32768 },
    { id: "DeepSeek-R1-Distill-Qwen-14B", maxOutput: 4096, contextWindowTokens: 32768 },
    { id: "DeepSeek-R1-Distill-Qwen-32B", maxOutput: 4096, contextWindowTokens: 8192 },
  ],
};
