/**
 * NVIDIA NIM (NVIDIA Inference Microservices)
 *
 * - 官网：https://build.nvidia.com/
 * - 控制台 / API key：https://build.nvidia.com/profile/api-keys
 * - API 文档：https://docs.nvidia.com/nim/
 * - 模型广场：https://build.nvidia.com/explore/discover
 * - 模型列表 JSON：https://integrate.api.nvidia.com/v1/models
 *
 * NVIDIA NIM 提供 OpenAI 兼容 API，托管 Meta Llama、Mistral、Google Gemma 等开源模型。
 * API base URL: https://integrate.api.nvidia.com/v1
 * API key 前缀：nvapi-
 */
import type { InkosEndpoint } from "../types.js";

export const NVIDIA: InkosEndpoint = {
  id: "nvidia",
  label: "NVIDIA NIM",
  group: "overseas",
  api: "openai-completions",
  baseUrl: "https://integrate.api.nvidia.com/v1",
  checkModel: "meta/llama-3.1-8b-instruct",
  temperatureRange: [0, 1],
  defaultTemperature: 0.7,
  writingTemperature: 1,
  // NVIDIA NIM 不支持 OpenAI v2 新增字段：store、max_completion_tokens、developer role。
  // 必须显式声明 compat，否则 pi-ai detectCompat 会按标准 OpenAI 兼容层处理，发送
  // max_completion_tokens / store / developer role 等字段，导致 400 错误。
  compat: {
    supportsStore: false,
    supportsDeveloperRole: false,
    maxTokensField: "max_tokens",
    supportsUsageInStreaming: false,
  },
  models: [
    // === Meta Llama 4 ===
    { id: "meta/llama-4-maverick-17b-128e-instruct", maxOutput: 4096, contextWindowTokens: 1048576, releasedAt: "2025-04-05" },
    // === Meta Llama 3.3 ===
    { id: "meta/llama-3.3-70b-instruct", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2024-12-06" },
    // === Meta Llama 3.2 ===
    { id: "meta/llama-3.2-1b-instruct", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2024-09-25" },
    { id: "meta/llama-3.2-3b-instruct", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2024-09-25" },
    // === Meta Llama 3.1 ===
    { id: "meta/llama-3.1-405b-instruct", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2024-07-23" },
    { id: "meta/llama-3.1-70b-instruct", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2024-07-23" },
    { id: "meta/llama-3.1-8b-instruct", maxOutput: 4096, contextWindowTokens: 131072, enabled: true, releasedAt: "2024-07-23" },
    // === Meta Llama legacy ===
    { id: "meta/llama2-70b", maxOutput: 4096, contextWindowTokens: 4096 },
    { id: "meta/codellama-70b", maxOutput: 4096, contextWindowTokens: 4096 },
    // === NVIDIA Nemotron ===
    { id: "nvidia/llama-3.1-nemotron-ultra-253b-v1", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-03-18" },
    { id: "nvidia/llama-3.3-nemotron-super-49b-v1.5", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-06-01" },
    { id: "nvidia/llama-3.3-nemotron-super-49b-v1", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-04-15" },
    { id: "nvidia/llama-3.1-nemotron-70b-instruct", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-01-08" },
    { id: "nvidia/llama-3.1-nemotron-51b-instruct", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2024-11-15" },
    { id: "nvidia/nemotron-4-340b-instruct", maxOutput: 4096, contextWindowTokens: 4096, releasedAt: "2024-06-12" },
    { id: "nvidia/nemotron-3-super-120b-a12b", maxOutput: 4096, contextWindowTokens: 4096 },
    { id: "nvidia/llama-3.1-nemotron-nano-8b-v1", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-01-08" },
    { id: "nvidia/nvidia-nemotron-nano-9b-v2", maxOutput: 4096, contextWindowTokens: 131072 },
    { id: "nvidia/nemotron-3-nano-30b-a3b", maxOutput: 4096, contextWindowTokens: 4096 },
    { id: "nvidia/nemotron-mini-4b-instruct", maxOutput: 4096, contextWindowTokens: 4096 },
    { id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning", maxOutput: 4096, contextWindowTokens: 4096 },
    { id: "nvidia/llama3-chatqa-1.5-70b", maxOutput: 4096, contextWindowTokens: 4096 },
    { id: "nvidia/mistral-nemo-minitron-8b-8k-instruct", maxOutput: 4096, contextWindowTokens: 8192 },
    // === DeepSeek ===
    { id: "deepseek-ai/deepseek-v4-pro", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-05-28" },
    { id: "deepseek-ai/deepseek-v4-flash", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-05-28" },
    { id: "deepseek-ai/deepseek-v3.2", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-04-10" },
    { id: "deepseek-ai/deepseek-v3.1-terminus", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-03-25" },
    { id: "deepseek-ai/deepseek-coder-6.7b-instruct", maxOutput: 4096, contextWindowTokens: 16384, releasedAt: "2024-01-29" },
    // === Mistral ===
    { id: "mistralai/mistral-large-3-675b-instruct-2512", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-12-10" },
    { id: "mistralai/mistral-medium-3.5-128b", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-06-18" },
    { id: "mistralai/devstral-2-123b-instruct-2512", maxOutput: 4096, contextWindowTokens: 262144, releasedAt: "2025-12-09" },
    { id: "mistralai/mistral-medium-3-instruct", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-03-18" },
    { id: "mistralai/mistral-small-4-119b-2603", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2026-03-16" },
    { id: "mistralai/mistral-large-2-instruct", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-07-09" },
    { id: "mistralai/mistral-large", maxOutput: 4096, contextWindowTokens: 131072 },
    { id: "mistralai/magistral-small-2506", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-06-18" },
    { id: "mistralai/ministral-14b-instruct-2512", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-12-09" },
    { id: "mistralai/codestral-22b-instruct-v0.1", maxOutput: 4096, contextWindowTokens: 65536, releasedAt: "2025-04-15" },
    { id: "mistralai/mistral-nemotron", maxOutput: 4096, contextWindowTokens: 131072 },
    { id: "mistralai/mistral-7b-instruct-v0.3", maxOutput: 4096, contextWindowTokens: 32768 },
    { id: "mistralai/mixtral-8x22b-instruct-v0.1", maxOutput: 4096, contextWindowTokens: 65536, releasedAt: "2024-04-10" },
    { id: "mistralai/mixtral-8x7b-instruct-v0.1", maxOutput: 4096, contextWindowTokens: 32768, releasedAt: "2023-12-11" },
    { id: "nv-mistralai/mistral-nemo-12b-instruct", maxOutput: 4096, contextWindowTokens: 131072 },
    // === Google Gemma ===
    { id: "google/gemma-4-31b-it", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-06-18" },
    { id: "google/gemma-3-27b-it", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-03-12" },
    { id: "google/gemma-3-12b-it", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-03-12" },
    { id: "google/gemma-3-4b-it", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-03-12" },
    { id: "google/gemma-3n-e4b-it", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-06-18" },
    { id: "google/gemma-3n-e2b-it", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-06-18" },
    { id: "google/gemma-2-2b-it", maxOutput: 4096, contextWindowTokens: 8192, releasedAt: "2024-06-27" },
    { id: "google/gemma-2b", maxOutput: 4096, contextWindowTokens: 8192 },
    { id: "google/recurrentgemma-2b", maxOutput: 4096, contextWindowTokens: 8192 },
    // === Qwen ===
    { id: "qwen/qwen3.5-397b-a17b", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-05-28" },
    { id: "qwen/qwen3.5-122b-a10b", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-05-28" },
    { id: "qwen/qwen3-coder-480b-a35b-instruct", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-05-28" },
    { id: "qwen/qwen3-next-80b-a3b-thinking", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-06-01" },
    { id: "qwen/qwen3-next-80b-a3b-instruct", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-06-01" },
    { id: "qwen/qwen2.5-coder-32b-instruct", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2024-11-12" },
    // === Moonshot / Kimi ===
    { id: "moonshotai/kimi-k2.6", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-05-28" },
    { id: "moonshotai/kimi-k2-instruct-0905", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-06-05" },
    { id: "moonshotai/kimi-k2-instruct", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-05-28" },
    { id: "moonshotai/kimi-k2-thinking", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-05-28" },
    // === Microsoft Phi ===
    { id: "microsoft/phi-4-mini-instruct", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-06-01" },
    { id: "microsoft/phi-4-multimodal-instruct", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-05-28" },
    { id: "microsoft/phi-3.5-moe-instruct", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2024-08-20" },
    // === 01.AI ===
    { id: "01-ai/yi-large", maxOutput: 4096, contextWindowTokens: 32768, releasedAt: "2024-05-15" },
    // === AI21 Labs ===
    { id: "ai21labs/jamba-1.5-large-instruct", maxOutput: 4096, contextWindowTokens: 262144, releasedAt: "2024-08-20" },
    // === ByteDance ===
    { id: "bytedance/seed-oss-36b-instruct", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-06-01" },
    // === Databricks ===
    { id: "databricks/dbrx-instruct", maxOutput: 4096, contextWindowTokens: 32768, releasedAt: "2024-03-27" },
    // === IBM Granite ===
    { id: "ibm/granite-3.0-8b-instruct", maxOutput: 4096, contextWindowTokens: 8192, releasedAt: "2024-11-15" },
    { id: "ibm/granite-3.0-3b-a800m-instruct", maxOutput: 4096, contextWindowTokens: 8192, releasedAt: "2024-11-15" },
    { id: "ibm/granite-34b-code-instruct", maxOutput: 4096, contextWindowTokens: 8192 },
    { id: "ibm/granite-8b-code-instruct", maxOutput: 4096, contextWindowTokens: 8192 },
    // === MiniMax ===
    { id: "minimaxai/minimax-m2.7", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-05-28" },
    { id: "minimaxai/minimax-m2.5", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-03-18" },
    // === OpenAI (hosted on NIM) ===
    { id: "openai/gpt-oss-120b", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-06-01" },
    { id: "openai/gpt-oss-20b", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-06-01" },
    // === StepFun ===
    { id: "stepfun-ai/step-3.5-flass", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-06-01" },
    // === Writer ===
    { id: "writer/palmyra-creative-122b", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-05-28" },
    { id: "writer/palmyra-med-70b-32k", maxOutput: 4096, contextWindowTokens: 32768 },
    { id: "writer/palmyra-med-70b", maxOutput: 4096, contextWindowTokens: 8192 },
    { id: "writer/palmyra-fin-70b-32k", maxOutput: 4096, contextWindowTokens: 32768 },
    // === Zhipu GLM ===
    { id: "z-ai/glm-5.1", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-06-01" },
    { id: "z-ai/glm5", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-05-28" },
    { id: "z-ai/glm4.7", maxOutput: 4096, contextWindowTokens: 131072, releasedAt: "2025-04-15" },
    // === Upstage ===
    { id: "upstage/solar-10.7b-instruct", maxOutput: 4096, contextWindowTokens: 4096, releasedAt: "2023-12-20" },
    // === Zyphra ===
    { id: "zyphra/zamba2-7b-instruct", maxOutput: 4096, contextWindowTokens: 4096, releasedAt: "2025-05-28" },
    // === Stockmark ===
    { id: "stockmark/stockmark-2-100b-instruct", maxOutput: 4096, contextWindowTokens: 4096 },
    // === Sarvam AI ===
    { id: "sarvamai/sarvam-m", maxOutput: 4096, contextWindowTokens: 8192, releasedAt: "2025-05-28" },
  ],
};