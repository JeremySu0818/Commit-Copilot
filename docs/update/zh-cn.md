# Commit Copilot 更新信息

## 版本 1.21.0 的新功能

- 修复 OpenAI 端点工具调用因不兼容 Schema 关键字导致失败的问题，正确过滤函数调用与 Responses API 的工具参数 Schema。
- 新增支持 OpenAI 服务商的 GPT-6 Luna、GPT-6 Sol 与 GPT-6.1 Sol，并将 OpenAI 默认模型升级为 GPT-6.1 Sol。
- 新增支持 Anthropic Claude 服务商的 Claude Opus 5.5。
- 新增支持 xAI Grok 服务商的 Grok 4.7。
- 更新 Groq 模型目录，新增 Qwen 3.8 27b，并清理已下线的旧模型。
