import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isLlmConfigured, selectLlmProvider, selectLlmProviders } from "@/lib/ai/nim-client";

const providerEnvKeys = [
  "ENABLE_NIM",
  "NVIDIA_NIM_API_KEY",
  "NIM_API_KEY",
  "NVIDIA_API_KEY",
  "NVIDIA_NIM_BASE_URL",
  "NVIDIA_NIM_API_BASE_URL",
  "NVIDIA_NIM_API_BASE",
  "NVIDIA_NIM_MODEL",
  "NVIDIA_NIM_TIMEOUT_MS",
  "NIM_TIMEOUT_MS",
  "ENABLE_GROQ",
  "GROQ_API_KEY",
  "GROQ_BASE_URL",
  "GROQ_API_BASE_URL",
  "GROQ_MODEL",
  "GROQ_TIMEOUT_MS",
  "ENABLE_LLM",
  "LLM_API_KEY",
  "LLM_BASE_URL",
  "LLM_MODEL",
  "LLM_TIMEOUT_MS",
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "OPENAI_MODEL",
] as const;

const originalProviderEnv = new Map<string, string | undefined>(
  providerEnvKeys.map((key) => [key, process.env[key]]),
);

function clearProviderEnv() {
  for (const key of providerEnvKeys) {
    delete process.env[key];
  }
}

function restoreProviderEnv() {
  clearProviderEnv();
  for (const [key, value] of originalProviderEnv) {
    if (value !== undefined) {
      process.env[key] = value;
    }
  }
}

describe("LLM provider selection", () => {
  beforeEach(() => {
    clearProviderEnv();
  });

  afterEach(() => {
    restoreProviderEnv();
  });

  it("stays in demo mode when provider keys are absent", () => {
    expect(selectLlmProvider()).toBeNull();
    expect(isLlmConfigured()).toBe(false);
  });

  it("selects NVIDIA NIM first when NIM, Groq, and generic providers are configured", () => {
    process.env.NVIDIA_NIM_API_KEY = "nim-secret";
    process.env.NVIDIA_NIM_BASE_URL = "https://nim.example.test/v1///";
    process.env.NVIDIA_NIM_MODEL = "meta/llama-test";
    process.env.GROQ_API_KEY = "groq-secret";
    process.env.LLM_API_KEY = "generic-secret";
    process.env.LLM_TIMEOUT_MS = "7500";

    expect(selectLlmProvider()).toEqual({
      name: "nim",
      apiKey: "nim-secret",
      baseUrl: "https://nim.example.test/v1",
      model: "meta/llama-test",
      timeoutMs: 7500,
    });
    expect(isLlmConfigured()).toBe(true);
  });

  it("keeps the full live provider failover order", () => {
    process.env.NVIDIA_NIM_API_KEY = "nim-secret";
    process.env.GROQ_API_KEY = "groq-secret";
    process.env.LLM_API_KEY = "generic-secret";

    expect(selectLlmProviders().map((provider) => provider.name)).toEqual(["nim", "groq", "generic"]);
  });

  it("uses available keys unless a provider is explicitly disabled", () => {
    process.env.NVIDIA_NIM_API_KEY = "nim-secret";
    process.env.GROQ_API_KEY = "groq-secret";
    process.env.LLM_API_KEY = "generic-secret";

    expect(selectLlmProvider()).toMatchObject({
      name: "nim",
      apiKey: "nim-secret",
    });

    process.env.ENABLE_NIM = "false";
    expect(selectLlmProvider()).toMatchObject({
      name: "groq",
      apiKey: "groq-secret",
    });

    process.env.ENABLE_GROQ = "false";
    expect(selectLlmProvider()).toMatchObject({
      name: "generic",
      apiKey: "generic-secret",
    });

    process.env.ENABLE_LLM = "false";
    expect(selectLlmProvider()).toBeNull();
  });

  it("supports the NVIDIA_API_KEY fallback for NIM", () => {
    process.env.NVIDIA_API_KEY = "legacy-nvidia-secret";

    expect(selectLlmProvider()).toMatchObject({
      name: "nim",
      apiKey: "legacy-nvidia-secret",
      baseUrl: "https://integrate.api.nvidia.com/v1",
      model: "meta/llama-3.2-11b-vision-instruct",
    });
  });

  it("recognizes the cloud NIM_API_KEY binding and honors explicit disabling", () => {
    process.env.NIM_API_KEY = "cloud-nim-test-key";
    expect(selectLlmProvider()).toMatchObject({ name: "nim", apiKey: "cloud-nim-test-key" });
    process.env.ENABLE_NIM = "false";
    expect(selectLlmProvider()).toBeNull();
  });

  it("selects Groq before generic OpenAI-compatible providers", () => {
    process.env.GROQ_API_KEY = "groq-secret";
    process.env.GROQ_BASE_URL = "https://api.groq.com/openai/v1/";
    process.env.GROQ_MODEL = "groq-test-model";
    process.env.LLM_API_KEY = "generic-secret";

    expect(selectLlmProvider()).toEqual({
      name: "groq",
      apiKey: "groq-secret",
      baseUrl: "https://api.groq.com/openai/v1",
      model: "groq-test-model",
      timeoutMs: 15_000,
    });
  });

  it("uses OpenAI-compatible aliases for the generic provider", () => {
    process.env.OPENAI_API_KEY = "openai-compatible-secret";
    process.env.OPENAI_BASE_URL = "https://gateway.example.test/v1/";
    process.env.OPENAI_MODEL = "provider-model";
    process.env.LLM_TIMEOUT_MS = "120000";

    expect(selectLlmProvider()).toEqual({
      name: "generic",
      apiKey: "openai-compatible-secret",
      baseUrl: "https://gateway.example.test/v1",
      model: "provider-model",
      timeoutMs: 60_000,
    });
  });

  it("supports local NVIDIA and Groq base URL aliases", () => {
    process.env.NVIDIA_NIM_API_KEY = "nim-secret";
    process.env.NVIDIA_NIM_API_BASE = "https://nim-alias.example.test/v1/";

    expect(selectLlmProvider()).toMatchObject({
      name: "nim",
      baseUrl: "https://nim-alias.example.test/v1",
    });

    process.env.ENABLE_NIM = "false";
    process.env.GROQ_API_KEY = "groq-secret";
    process.env.GROQ_API_BASE_URL = "https://groq-alias.example.test/openai/v1/";

    expect(selectLlmProvider()).toMatchObject({
      name: "groq",
      baseUrl: "https://groq-alias.example.test/openai/v1",
    });
  });
});
