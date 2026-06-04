import { describe, it, expect } from "vitest";
import { resolveServicePreset, listModelsForService } from "../llm/service-presets.js";

describe("service-presets regression", () => {
  describe("Kimi Code preset", () => {
    it("uses Anthropic protocol on the Kimi Code coding endpoint", () => {
      const preset = resolveServicePreset("kimicode");
      expect(preset).toBeDefined();
      expect(preset!.providerFamily).toBe("anthropic");
      expect(preset!.api).toBe("anthropic-messages");
      expect(preset!.baseUrl).toBe("https://api.kimi.com/coding");
      expect(preset!.modelsBaseUrl).toBe("https://api.kimi.com/coding/v1");
    });

    it("exposes the Kimi Code model through provider-bank model listing", async () => {
      const models = await listModelsForService("kimicode");
      expect(models.map((m) => m.id)).toContain("kimi-for-coding");
    });
  });

  describe("MiniMax preset", () => {
    it("has correct domestic MiniMax OpenAI-compatible baseUrl (api.minimaxi.com/v1)", () => {
      const preset = resolveServicePreset("minimax");
      expect(preset).toBeDefined();
      expect(preset!.baseUrl).toBe("https://api.minimaxi.com/v1");
    });

    it("uses OpenAI-compatible api format", () => {
      const preset = resolveServicePreset("minimax");
      expect(preset!.providerFamily).toBe("openai");
      expect(preset!.api).toBe("openai-completions");
    });

    it("has knownModels with all 7 MiniMax models", () => {
      const preset = resolveServicePreset("minimax");
      expect(preset!.knownModels).toBeDefined();
      expect(preset!.knownModels).toHaveLength(7);
      expect(preset!.knownModels).toContain("MiniMax-M2.7");
      expect(preset!.knownModels).toContain("MiniMax-M2.7-highspeed");
      expect(preset!.knownModels).toContain("MiniMax-M2.5");
      expect(preset!.knownModels).toContain("MiniMax-M2");
    });
  });

  describe("kkaiapi preset", () => {
    it("resolves kkaiapi as an OpenAI-compatible aggregator", () => {
      const preset = resolveServicePreset("kkaiapi");
      expect(preset).toBeDefined();
      expect(preset!.providerFamily).toBe("openai");
      expect(preset!.api).toBe("openai-completions");
      expect(preset!.baseUrl).toBe("https://api.kkaiapi.com/v1");
      expect(preset!.modelsBaseUrl).toBe("https://api.kkaiapi.com/v1");
    });
  });

  describe("listModelsForService", () => {
    it("returns provider bank models for minimax (B8 升级：provider.models 替代 preset.knownModels)", async () => {
      const models = await listModelsForService("minimax");
      expect(models.length).toBeGreaterThanOrEqual(7);
      expect(models.some((m) => m.id === "MiniMax-M2.7")).toBe(true);
    });

    it("returns kkaiapi provider bank text models", async () => {
      const models = await listModelsForService("kkaiapi");
      expect(models.some((m) => m.id === "deepseek-v4-flash")).toBe(true);
      expect(models.some((m) => m.id === "gpt-image-2")).toBe(false);
    });

    it("returns empty for custom service without apikey + baseUrl", async () => {
      const models = await listModelsForService("custom");
      expect(models).toEqual([]);
    });
  });
});
