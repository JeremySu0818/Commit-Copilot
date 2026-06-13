# Commit Copilot Update Info

## What's New in Version 1.14.0

- Supported Ollama proxy mode: Introduced text agent tool protocols to remove the forced Direct Diff fallback mechanism, and supported aborting Ollama model download (Pull) progress when canceling generation.
- Supported Anthropic custom provider: Allowed configuring custom endpoints in Anthropic API format, setting max output tokens, optimized the input sequence of new fields, and automatically migrated legacy settings.
- Modularized core architecture: Split core components such as generation orchestration, Git operations, model management, and webview protocols into independent modules, and modularized language Prompts to improve load performance.
- Simplified provider display names: Corrected built-in provider labels to cleaner names.
- Fixed UI language labels: Corrected the model selector action label from "Add Model" to "Manage Models..." to better match the functional screen.
- Updated and optimized README.md documentation and configuration examples.
