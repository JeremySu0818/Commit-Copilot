# Auto-Commit CLI Tool

A Python-based CLI tool to automatically generate [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) messages using Google Gemini.

## Features

- Support for **Google Gemini** API.
- Generates strict **English** conventional commits.
- **No emojis** (professional standard).
- Simple CLI interface using `typer` and `rich`.

## Installation

1. Create a virtual environment:

   ```bash
   uv venv .venv
   # Windows
   .venv\Scripts\activate
   # Linux/Mac
   source .venv/bin/activate
   ```

2. Install dependencies:

   ```bash
   uv pip install -r requirements.txt
   ```

3. Configure API Keys:
   Copy `.env.example` to `.env` and fill in your keys.
   ```bash
   cp .env.example .env
   ```

## Usage

Basic usage:

```bash
python main.py generate
```

Auto-commit without confirmation:

```bash
python main.py generate -y
```

## VS Code Extension

You can now use Auto-Commit directly within VS Code!

### Installation for Development

1. Open this project in VS Code.
2. Run `npm install` to install extension dependencies.
3. Press `F5` to start the Extension Development Host.

### How to Use

1. Stage your changes in the **Source Control** view.
2. Click the **Sparkle icon** (`Auto-Commit: Generate Message`) in the Source Control title bar.
3. The generated message will be automatically filled into the commit message box.

## Development

- Managed by `uv`.
- Entry point: `main.py` or `python -m auto_commit.cli`.
