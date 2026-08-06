import { invoke } from "@tauri-apps/api/core";

export type LlmProvider = "anthropic" | "openai" | "google";

export type KeyStatus = {
  provider: LlmProvider;
  label: string;
  configured: boolean;
  value: string;
};

export type ProviderCatalog = {
  id: LlmProvider;
  label: string;
  defaultModel: string;
  models: string[];
};

export type LlmSettings = {
  provider: LlmProvider;
  model: string;
  keys: KeyStatus[];
  providers: ProviderCatalog[];
};

const SHORT_MODEL_NAMES: Record<string, string> = {
  "claude-opus-5": "Opus 5",
  "claude-sonnet-5": "Sonnet 5",
  "claude-opus-4-8": "Opus 4.8",
  "claude-opus-4-7": "Opus 4.7",
  "claude-sonnet-4-6": "Sonnet 4.6",
  "claude-opus-4-6": "Opus 4.6",
  "claude-opus-4-5": "Opus 4.5",
  "claude-sonnet-4-5": "Sonnet 4.5",
  "claude-haiku-4-5": "Haiku 4.5",
  "gpt-4.1": "GPT-4.1",
  "gpt-4.1-mini": "GPT-4.1 Mini",
  "gpt-4.1-nano": "GPT-4.1 Nano",
  "gpt-4o": "GPT-4o",
  "gpt-4o-mini": "GPT-4o Mini",
  o3: "o3",
  "o3-mini": "o3 Mini",
  "o4-mini": "o4 Mini",
  "gemini-3.5-flash": "Gemini 3.5 Flash",
  "gemini-3.5-flash-lite": "Gemini 3.5 Flash Lite",
  "gemini-3.1-flash-lite": "Gemini 3.1 Flash Lite",
  "gemini-2.5-pro": "Gemini 2.5 Pro",
  "gemini-2.5-flash": "Gemini 2.5 Flash",
  "gemini-2.5-flash-lite": "Gemini 2.5 Flash Lite",
  "gemini-2.5-flash-image": "Gemini 2.5 Flash Image",
  "gemini-2.0-flash": "Gemini 2.0 Flash",
  "gemini-2.0-flash-lite": "Gemini 2.0 Flash Lite",
  "gemini-1.5-pro": "Gemini 1.5 Pro",
  "gemini-1.5-flash": "Gemini 1.5 Flash",
};

export function shortModelLabel(modelId: string): string {
  if (SHORT_MODEL_NAMES[modelId]) return SHORT_MODEL_NAMES[modelId];
  return modelId.replace(/-\d{8}$/, "");
}

export async function getLlmSettings(): Promise<LlmSettings> {
  return invoke<LlmSettings>("get_llm_settings");
}

export async function setLlmApiKey(
  provider: LlmProvider,
  key: string,
): Promise<LlmSettings> {
  return invoke<LlmSettings>("set_llm_api_key", { provider, key });
}

export async function clearLlmApiKey(provider: LlmProvider): Promise<LlmSettings> {
  return invoke<LlmSettings>("clear_llm_api_key", { provider });
}

export async function setLlmModel(
  provider: LlmProvider,
  model: string,
): Promise<LlmSettings> {
  return invoke<LlmSettings>("set_llm_model", { provider, model });
}

export function providerHasKey(
  settings: LlmSettings | null,
  provider: LlmProvider,
): boolean {
  return Boolean(settings?.keys.find((item) => item.provider === provider)?.configured);
}
