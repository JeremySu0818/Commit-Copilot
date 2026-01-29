export type APIProvider = "google" | "openai" | "anthropic" | "ollama";
export const PROVIDER_DISPLAY_NAMES: Record<APIProvider, string> = {
  google: "Google (Gemini)",
  openai: "OpenAI",
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
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4.5-preview",
  "gpt-4-turbo",
  "o3",
  "o3-mini",
  "o1",
  "o1-mini",
];
export const ANTHROPIC_MODELS = [
  "claude-sonnet-4-5-20250929",
  "claude-opus-4-5",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-haiku-20241022",
  "claude-3-opus-20240229",
];
export const OLLAMA_MODELS = [
  "llama4",
  "llama3.3",
  "llama3.2",
  "llama3.1",
  "gemma3:1b",
  "gemma2",
  "phi4",
  "phi4-mini",
  "phi3",
  "qwen3",
  "qwen2.5",
  "deepseek-coder-v2",
  "mistral",
  "codellama",
];
export const MODELS_BY_PROVIDER: Record<APIProvider, string[]> = {
  google: GEMINI_MODELS,
  openai: OPENAI_MODELS,
  anthropic: ANTHROPIC_MODELS,
  ollama: OLLAMA_MODELS,
};
export const DEFAULT_MODELS: Record<APIProvider, string> = {
  google: "gemini-2.5-flash",
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4-5-20250929",
  ollama: "llama3.3",
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
