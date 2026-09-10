# Commit Copilot 更新情報

## バージョン 1.20.0 の新機能

- Agent モードおよび Direct Diff モードで Ollama の thinking（思考）を無効化し、コミットメッセージとツール呼び出しが正常に返されるように修正しました。
- Google Gemini のツール呼び出しが失敗する問題を修正し、生の JSON Schema フィールド経由で関数宣言パラメータを正しく渡すようにしました。
- Google Gemini プロバイダーの Gemini 3.8 Flash に対応し、Google の既定モデルを Gemini 3.8 Flash に更新しました。
- OpenAI プロバイダーの GPT-6 Astra に対応しました。
- Anthropic Claude プロバイダーの Claude Fable 5.1 に対応しました。
- DeepSeek モデルカタログを更新し、DeepSeek V4.1 Flash を追加し、非推奨モデルを整理しました。
