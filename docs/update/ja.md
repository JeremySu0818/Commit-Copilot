# Commit Copilot 更新情報

## バージョン 1.20.0 の新機能

- OpenAI エンドポイントで非対応の Schema キーワードによりツール呼び出しが失敗する問題を修正し、関数呼び出しおよび Responses API のツールパラメータ Schema を適切にサニタイズするようにしました。
- Agent モードおよび Direct Diff モードで Ollama の thinking（思考）を無効化し、コミットメッセージとツール呼び出しが正常に返されるように修正しました。
- Google Gemini のツール呼び出しが失敗する問題を修正し、生の JSON Schema フィールド経由で関数宣言パラメータを正しく渡すようにしました。
- Google Gemini プロバイダーの Gemini 3.8 Flash に対応し、Google の既定モデルを Gemini 3.8 Flash に更新しました。
- OpenAI プロバイダーの GPT-6 Astra に対応しました。
- Anthropic Claude プロバイダーの Claude Fable 5.1 に対応しました。
- DeepSeek モデルカタログを更新し、DeepSeek V4.1 Flash を追加し、非推奨モデルを整理しました。
- OpenAI プロバイダーの GPT-6 Luna、GPT-6 Sol、GPT-6.1 Sol に対応し、OpenAI の既定モデルを GPT-6.1 Sol に更新しました。
- Anthropic Claude プロバイダーの Claude Opus 5.5 に対応しました。
- xAI Grok プロバイダーの Grok 4.7 に対応しました。
- Groq モデルカタログを更新し、Qwen 3.8 27b を追加し、非推奨モデルを整理しました。
