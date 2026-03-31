# Commit-Copilot VS Code Extension

Commit-Copilot is an **agentic** VS Code extension that uses a multi-step AI agent loop to generate meaningful, conventional commit messages. Unlike simple diff-to-prompt tools, Commit-Copilot's agent autonomously investigates your repository — reading files, analyzing code structure, and inspecting diffs — before classifying changes and crafting professional commit messages directly within your editor.

## Features

- **Multi-Provider Support**: Choose your preferred AI provider:
  - **Google Gemini**: Support for Gemini 2.5 Flash-Lite/Flash/Pro, Gemini 3 Flash and Gemini 3.1 Flash-Lite/Pro.
  - **OpenAI**: Support for o3/o3-mini, o4-mini, GPT-4o mini/GPT-4o, GPT-4.1 nano/GPT-4.1 mini/GPT-4.1, GPT-5 nano/GPT-5 mini/GPT-5, GPT-5.1, GPT-5.2, and GPT-5.4 nano/GPT-5.4 mini/GPT-5.4.
  - **Anthropic**: Support for Claude Sonnet/Opus 4, Claude Opus 4.1, Claude Haiku/Sonnet/Opus 4.5 and Claude Opus 4.6.
  - **Ollama**: Support for local models like Gemma 3 1B/4B/12B/27B, gpt-oss-20B/120B, Llama 3.3 8B/70B, Phi-4 14B and Mistral 7B.
- **Agentic AI Architecture**: Instead of blindly feeding the entire diff into a prompt, Commit-Copilot runs a multi-step agent loop. The AI is given only file names and line counts initially, then autonomously decides which tools to call — `get_diff`, `read_file`, `get_file_outline`, `find_references`, `get_recent_commits`, `search_code` — to investigate the actual changes, understand surrounding context, inspect the project structure tree, and learn the project's commit style before making its classification decision.
- **Cross-Project Pattern Search**: Uses a built-in `search_code` tool (grep-like) to discover hidden relationships not expressed through imports, such as environment variable references, string-based event names, and configuration keys.
- **LSP Reference Impact Radar**: Uses VS Code's Language Server Protocol via `vscode.executeReferenceProvider` to find syntax-aware references for a symbol across the workspace. This helps the agent connect a change to the business scope it impacts.
- **Strict Conventional Commits Classification**: Applies a priority-ordered ruleset covering 11 commit types (`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`) with clearly defined boundary rules (e.g., removing dead code is `chore`, not `refactor`). Enforces mandatory scope parentheses, commit body, and 72-character line limits.
- **Intelligent Change Detection**: Detects five distinct change scenarios — staged-only, unstaged-only, mixed (staged + unstaged), unstaged with untracked files, and untracked-only — and presents contextual prompts to let you decide how to proceed. Never auto-stages without your explicit consent.
- **Git Index-Aware Analysis**: When analyzing staged changes, the agent reads file contents from the Git index (`git show :path`) rather than from disk, ensuring the analysis matches exactly what will be committed. For LSP-based `find_references`, a temporary workspace snapshot is created from the index so that on-disk references align with the staged state.
- **Real-Time API Validation**: Each provider's API key is validated against its actual endpoint before saving. Invalid keys, quota limits, and connection failures are caught immediately with provider-specific error messages.
- **Ollama Pull (Always)**: Always runs `ollama pull` for the selected model before generation, with real-time download progress reporting in the notification area. This can re-download layers even if the model already exists.
- **Seamless VS Code Integration**: Access Commit-Copilot from the Activity Bar, Source Control navigation bar (sparkle icon), or Command Palette — three entry points integrated into your existing workflow.
- **Real-Time Git Monitoring**: The side panel dynamically reflects your repository state. The Generate button automatically enables when changes are detected and disables when the working tree is clean.
- **Detailed Error Handling**: Provides specific, actionable error messages for every failure scenario — API key issues link to the settings panel, quota errors open the provider console, and staging failures suggest corrective actions.
- **Secure Key Storage**: API keys are stored securely using VS Code's Secret Storage.
- **Model Selection**: Customize which model you want to use for each provider.
- **Preview & Edit**: Review the generated message in the Source Control input box before committing.

## How It Works

Commit-Copilot uses an **agentic workflow** rather than a single-shot LLM call:

1. **Change Summary**: The extension collects file names, change types (added/modified/deleted/renamed), and line counts from `git diff`, along with a project structure tree.
2. **Agent Initialization**: This summary is sent to the LLM with a system prompt that instructs it to act as an autonomous commit message agent. The agent does **not** receive the raw diff content at this stage.
3. **Tool-Based Investigation**: The agent decides which files to inspect and calls tools in a loop:
   - `get_diff` — Retrieve the actual diff for a specific file.
   - `read_file` — Read file contents (from Git index for staged changes) with optional line ranges.
   - `get_file_outline` — Get the structural outline (functions, classes, exports) of a file.
   - `find_references` — Find LSP-based references for a symbol at a file position.
   - `get_recent_commits` — Fetch recent commit messages to learn the project's commit style.
   - `search_code` — Search for a keyword or pattern across the entire project to discover hidden relationships, verify consistency, or find string-based references.
4. **Classification & Generation**: After investigating, the agent applies a strict priority-ordered ruleset to classify the change type, determines the appropriate scope, and outputs the final commit message in `type(scope): description` format with a mandatory body.
5. **Output**: The generated message is placed into the Source Control input box for review.

This approach produces significantly more accurate commit messages because the agent can selectively investigate ambiguous changes, read surrounding context, and understand the role of each file in the project.

## Requirements

- **VS Code**: v1.80.0 or higher.
- **Git**: Installed and accessible by VS Code's built-in Git extension.
- **API Key**: A valid API key for your chosen provider (or a local Ollama instance).

## Usage

### 1. Installation

Download and install the extension from the VS Code Marketplace or Open VSX Registry.

### 2. Configuration

1. Click on the **Commit Copilot** icon in the Activity Bar (left side sidebar).
2. Select your desired **Provider** from the dropdown menu (Google, OpenAI, Anthropic, or Ollama).
3. Enter your **API Key** (or Host URL for Ollama).
   - _Note: Keys are stored securely on your device._
4. Click **Save**. The extension will validate your key.
5. Once validated, you can select a specific **Model** from the dropdown if available.

### 3. Generate Commit Message

#### Method A: Activity Bar

1. Open the **Commit Copilot** view in the Activity Bar.
2. Ensure you have changes in your repository (staged, unstaged, or untracked).
3. Click the **"Generate Commit Message"** button.
   - If only untracked files are found, you will be prompted to **"Stage & Generate"**.

#### Method B: Source Control Navigation

1. Open the **Source Control** view (`Ctrl+Shift+G`).
2. Click the **Commit-Copilot** icon (sparkle) in the navigation bar.

#### Method C: Command Palette

1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac).
2. Type `Commit-Copilot: Generate Commit Message` and select it.

### 4. Review and Commit

The generated message will automatically populate the Source Control input box. You can:

- Edit the message if needed.
- Press `Ctrl+Enter` (or Click Commit) to commit your changes.

## Development

### Prerequisites

- Node.js 20+
- npm

### Building

You can easily build the project using the provided scripts. These will handle dependency installation, compilation, and packaging automatically.

**Windows (CMD):**

```cmd
build.bat
```

**Windows (PowerShell):**

```powershell
.\build.ps1
```

**Linux / macOS:**

```bash
./build.sh
```

After building, you can open the project in VS Code (`code .`) and press `F5` to start debugging.

### Unit Testing

Run the unit test pipeline:

```bash
npm test
```

This executes:

1. `npm run test:build` (compile TypeScript tests with `tsconfig.test.json`)
2. `node --test --test-concurrency=1 out/test/**/*.test.js`

Current unit tests cover:

- All agent tools: `get_diff`, `read_file`, `get_file_outline`, `find_references`, `get_recent_commits`, `search_code`
- Tool dispatcher: `executeToolCall`
- Core supporting logic: context parsing/building, staged workspace snapshot utilities, retry behavior, and state managers

## License

This project is released into the public domain. You are free to copy, modify, publish, use, compile, sell, or distribute this software, either in source code form or as a compiled binary, for any purpose, commercial or non-commercial, and by any means.
