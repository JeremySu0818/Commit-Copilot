export type APIProvider = "google" | "openai" | "anthropic" | "ollama";
export const PROVIDER_DISPLAY_NAMES: Record<APIProvider, string> = {
  google: "Google (Gemini)",
  openai: "OpenAI (ChatGPT)",
  anthropic: "Anthropic (Claude)",
  ollama: "Ollama (Local)",
};
export const GEMINI_MODELS = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
  "gemini-3-flash-preview",
  "gemini-3-pro-preview",
];
export const OPENAI_MODELS = [
  "o3",
  "o3-mini",
  "o4-mini",
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-5-nano",
  "gpt-5-mini",
  "gpt-5",
  "gpt-5.1",
  "gpt-5.2",
];
export const ANTHROPIC_MODELS = [
  "claude-sonnet-4-20250514",
  "claude-opus-4-20250514",
  "claude-opus-4-1-20250805",
  "claude-haiku-4-5-20251001",
  "claude-sonnet-4-5-20250929",
  "claude-opus-4-5-20251101",
  "claude-opus-4-6-20260205",
];
export const OLLAMA_MODELS = [
  "gemma3:1b",
  "gemma3:4b",
  "gemma3:12b",
  "gemma3:27b",
  "gpt-oss:20b",
  "gpt-oss:120b",
  "llama3.3:8b",
  "llama3.3:70b",
  "phi4:14b",
  "mistral:7b",
];
export const MODELS_BY_PROVIDER: Record<APIProvider, string[]> = {
  google: GEMINI_MODELS,
  openai: OPENAI_MODELS,
  anthropic: ANTHROPIC_MODELS,
  ollama: OLLAMA_MODELS,
};
export const DEFAULT_MODELS: Record<APIProvider, string> = {
  google: "gemini-2.5-flash",
  openai: "gpt-5-mini",
  anthropic: "claude-haiku-4-5-20251001",
  ollama: "gemma3:12b",
};
export const DEFAULT_PROVIDER: APIProvider = "google";
export const DEFAULT_MODEL = DEFAULT_MODELS[DEFAULT_PROVIDER];
export const API_KEY_STORAGE_KEYS: Record<APIProvider, string> = {
  google: "GEMINI_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  ollama: "OLLAMA_HOST",
};
export const OLLAMA_DEFAULT_HOST = "http://127.0.0.1:11434";
