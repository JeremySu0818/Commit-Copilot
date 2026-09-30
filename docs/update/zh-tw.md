# Commit Copilot 更新資訊

## 版本 1.20.0 的新功能

- 修復 OpenAI 端點工具呼叫因不相容 Schema 關鍵字導致失敗的問題，正確過濾函式呼叫與 Responses API 的工具參數 Schema。
- 在 Agent 與 Direct Diff 模式中停用 Ollama 思考模式（thinking），確保能正常回傳 Commit 訊息與工具呼叫。
- 修復 Google Gemini 工具呼叫失敗的問題，改以原始 JSON Schema 欄位正確傳遞函式宣告參數。
- 新增支援 Google Gemini 供應商的 Gemini 3.8 Flash，並將 Google 預設模型升級為 Gemini 3.8 Flash。
- 新增支援 OpenAI 供應商的 GPT-6 Astra。
- 新增支援 Anthropic Claude 供應商的 Claude Fable 5.1。
- 更新 DeepSeek 模型目錄，新增 DeepSeek V4.1 Flash，並清理已下線的舊模型。
- 新增支援 OpenAI 供應商的 GPT-6 Luna、GPT-6 Sol 與 GPT-6.1 Sol，並將 OpenAI 預設模型升級為 GPT-6.1 Sol。
- 新增支援 Anthropic Claude 供應商的 Claude Opus 5.5。
- 新增支援 xAI Grok 供應商的 Grok 4.7。
- 更新 Groq 模型目錄，新增 Qwen 3.8 27b，並清理已下線的舊模型。
