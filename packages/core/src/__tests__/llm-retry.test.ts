import { describe, expect, it } from "vitest";
import { isTransientLLMHttpError } from "../llm/provider.js";

describe("LLM transient HTTP retry detection", () => {
  it("retries transient upstream HTTP failures", () => {
    expect(isTransientLLMHttpError(new Error("Request failed with status code 503"))).toBe(true);
    expect(isTransientLLMHttpError(new Error("502 Bad Gateway"))).toBe(true);
    expect(isTransientLLMHttpError(new Error("504 Gateway Timeout"))).toBe(true);
    expect(isTransientLLMHttpError(new Error("429 Too Many Requests"))).toBe(true);
  });

  it("does not retry known permanent provider model availability failures", () => {
    expect(isTransientLLMHttpError(new Error("500 MODEL_NOT_AVAILABLE"))).toBe(false);
  });

  it("walks nested error causes", () => {
    const err = new Error("request failed") as Error & { cause?: unknown };
    err.cause = new Error("503 temporarily unavailable");

    expect(isTransientLLMHttpError(err)).toBe(true);
  });
});
