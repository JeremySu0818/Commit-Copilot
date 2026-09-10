# Commit Copilot 更新信息

## 版本 1.20.0 的新功能

- 在 Agent 与 Direct Diff 模式中禁用 Ollama 思考模式（thinking），确保能正常返回 Commit 信息与工具调用。
- 修复 Google Gemini 工具调用失败的问题，改以原始 JSON Schema 字段正确传递函数声明参数。
- 新增支持 Google Gemini 服务商的 Gemini 3.8 Flash，并将 Google 默认模型升级为 Gemini 3.8 Flash。
- 新增支持 OpenAI 服务商的 GPT-6 Astra。
- 新增支持 Anthropic Claude 服务商的 Claude Fable 5.1。
- 更新 DeepSeek 模型目录，新增 DeepSeek V4.1 Flash，并清理已下线的旧模型。
