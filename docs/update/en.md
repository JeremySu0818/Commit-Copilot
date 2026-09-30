# Commit Copilot Update Info

## What's New in Version 1.20.0

- Fixed an issue where OpenAI endpoint tool calls failed due to unsupported schema keywords, properly sanitizing tool parameter schemas for function calling and the Responses API.
- Disabled Ollama thinking mode in agent and direct-diff requests to ensure commit messages and tool calls are returned.
- Fixed an issue where Google Gemini tool calling would fail by correctly passing function declaration parameters through the raw JSON Schema field.
- Added support for Google Gemini 3.8 Flash and upgraded the default Google provider model to Gemini 3.8 Flash.
- Added support for OpenAI GPT-6 Astra.
- Added support for Anthropic Claude Fable 5.1.
- Updated the DeepSeek model catalog with DeepSeek V4.1 Flash, while removing deprecated models.
- Added support for OpenAI GPT-6 Luna, GPT-6 Sol, and GPT-6.1 Sol, and upgraded the default OpenAI model to GPT-6.1 Sol.
- Added support for Anthropic Claude Opus 5.5.
- Added support for xAI Grok 4.7.
- Updated the Groq model catalog with Qwen 3.8 27b, while removing deprecated models.
