# Commit Copilot Update Info

## What's New in Version 1.20.0

- Disabled Ollama thinking mode in agent and direct-diff requests to ensure commit messages and tool calls are returned.
- Fixed an issue where Google Gemini tool calling would fail by correctly passing function declaration parameters through the raw JSON Schema field.
- Added support for Google Gemini 3.8 Flash and upgraded the default Google provider model to Gemini 3.8 Flash.
- Added support for OpenAI GPT-6 Astra.
- Added support for Anthropic Claude Fable 5.1.
- Updated the DeepSeek model catalog with DeepSeek V4.1 Flash, while removing deprecated models.
