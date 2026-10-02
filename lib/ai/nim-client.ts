export type LlmProvider = {
  name: "nim" | "groq" | "generic";
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
};

export type ChatMessage = {
  role: "system" | "user";
  content: string;
};

export type ChatCompletionOptions = {
  temperature?: number;
  maxTokens?: number;
};

type LlmProviderEnv = Record<string, string | undefined>;

export function isLlmConfigured(): boolean {
  return selectLlmProviders().length > 0;
}

export function selectLlmProvider(
  env: LlmProviderEnv = process.env,
): LlmProvider | null {
  return selectLlmProviders(env)[0] ?? null;
}

export function selectLlmProviders(
  env: LlmProviderEnv = process.env,
): LlmProvider[] {
  const providers: LlmProvider[] = [];
  const nimApiKey = firstNonEmpty(env.NVIDIA_NIM_API_KEY, env.NVIDIA_API_KEY);
  if (nimApiKey && providerEnabled(env.ENABLE_NIM)) {
    providers.push({
      name: "nim",
      apiKey: nimApiKey,
      baseUrl: normalizeBaseUrl(
        firstNonEmpty(
          env.NVIDIA_NIM_BASE_URL,
          env.NVIDIA_NIM_API_BASE_URL,
          env.NVIDIA_NIM_API_BASE,
        ) || "https://integrate.api.nvidia.com/v1",
      ),
      model: env.NVIDIA_NIM_MODEL || "meta/llama-3.1-8b-instruct",
      timeoutMs: parseTimeoutMs(
        firstNonEmpty(
          env.NVIDIA_NIM_TIMEOUT_MS,
          env.NIM_TIMEOUT_MS,
          env.LLM_TIMEOUT_MS,
        ),
        12_000,
      ),
    });
  }

  const groqApiKey = firstNonEmpty(env.GROQ_API_KEY);
  if (groqApiKey && providerEnabled(env.ENABLE_GROQ)) {
    providers.push({
      name: "groq",
      apiKey: groqApiKey,
      baseUrl: normalizeBaseUrl(
        firstNonEmpty(env.GROQ_BASE_URL, env.GROQ_API_BASE_URL) ||
          "https://api.groq.com/openai/v1",
      ),
      model: env.GROQ_MODEL || "llama-3.3-70b-versatile",
      timeoutMs: parseTimeoutMs(
        firstNonEmpty(env.GROQ_TIMEOUT_MS, env.LLM_TIMEOUT_MS),
        15_000,
      ),
    });
  }

  const llmApiKey = firstNonEmpty(env.LLM_API_KEY, env.OPENAI_API_KEY);
  if (llmApiKey && providerEnabled(env.ENABLE_LLM)) {
    providers.push({
      name: "generic",
      apiKey: llmApiKey,
      baseUrl: normalizeBaseUrl(
        env.LLM_BASE_URL || env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      ),
      model: env.LLM_MODEL || env.OPENAI_MODEL || "gpt-4.1-mini",
      timeoutMs: parseTimeoutMs(env.LLM_TIMEOUT_MS, 20_000),
    });
  }

  return providers;
}

export async function requestChatCompletion(
  provider: LlmProvider,
  messages: ChatMessage[],
  options: ChatCompletionOptions = {},
): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), provider.timeoutMs);
  const temperature = clampNumber(options.temperature, 0, 2, 0.1);
  const maxTokens = clampInteger(options.maxTokens, 64, 4_096, 1_200);

  try {
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: provider.model,
        temperature,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
        messages,
      }),
    });

    if (!response.ok) {
      throw new Error(`${provider.name} returned HTTP ${response.status}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload?.choices?.[0]?.message?.content;
    return typeof content === "string" && content.trim() ? content : null;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function firstNonEmpty(
  ...values: Array<string | undefined>
): string | undefined {
  return values
    .map((value) => value?.trim())
    .find((value): value is string => Boolean(value));
}

function parseTimeoutMs(raw: string | undefined, defaultMs: number): number {
  const parsed = Number.parseInt(raw || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultMs;
  }

  return Math.min(parsed, 60_000);
}

function providerEnabled(raw: string | undefined): boolean {
  if (!raw) {
    return true;
  }

  const normalized = raw.toLowerCase();
  return normalized !== "0" && normalized !== "false" && normalized !== "no";
}

function clampNumber(
  value: number | undefined,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, value as number));
}

function clampInteger(
  value: number | undefined,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  return Math.round(clampNumber(value, minimum, maximum, fallback));
}
