# Model discovery

The model selector fetches built-in provider catalogs at runtime. It keeps a saved
selection when available, otherwise chooses the first returned model after sorting.
There is no fixed catalog or preferred model version.

| Provider      | Model listing           | Notes                                                                                                                                                                                                                                                                    |
| ------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Google Gemini | `GET /v1beta/models`    | API key header; follows `nextPageToken`; requires `generateContent`. [Reference](https://ai.google.dev/api/models)                                                                                                                                                       |
| OpenAI        | `GET /v1/models`        | Bearer token; filters chat model families because the list omits capabilities. [Reference](https://developers.openai.com/api/reference/resources/models/methods/list)                                                                                                    |
| Anthropic     | `GET /v1/models`        | Bearer key and API version `2026-10-21`; follows `has_more` / `last_id`; excludes retired/deprecated models and reads output limits. [Reference](https://platform.claude.com/docs/en/api/models/list)                                                                    |
| xAI Grok      | `GET /v1/models`        | Bearer token. [Reference](https://docs.x.ai/developers/rest-api-reference/inference/models)                                                                                                                                                                              |
| Groq          | `GET /openai/v1/models` | Bearer token. [Reference](https://console.groq.com/docs/models)                                                                                                                                                                                                          |
| DeepSeek      | `GET /models`           | Bearer token. [Reference](https://api-docs.deepseek.com/api/list-models/)                                                                                                                                                                                                |
| Ollama        | `GET /api/tags`         | Lists installed models on the configured host. [Reference](https://docs.ollama.com/api/tags)                                                                                                                                                                             |
| OpenRouter    | `GET /api/v1/models`    | Existing text-output and tool-support filtering. [Reference](https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties)                                                                                                                   |
| Qwen          | `GET /api/v1/models`    | Native `output.models` / `output.total` schema, `page_no` / `page_size` pagination and `TG` filtering. Uses the host from `commit-copilot.qwen.baseUrl`, with the existing Beijing host as the default. [Reference](https://help.aliyun.com/en/model-studio/list-models) |

## Readable names

Model IDs are passed to the provider unchanged. API display names take priority;
when absent, regular expressions extract readable aliases, for example:

- `claude-sonnet-4-5-20250929` → `Claude Sonnet 4.5`
- `gemini-2.5-flash-lite` → `Gemini 2.5 Flash Lite`
- `openai/gpt-oss-120b` → `GPT OSS 120B`
- `qwen3-coder-plus` → `Qwen 3 Coder Plus`

Manual model aliases are retained. Date snapshots can share the same readable
alias while keeping distinct IDs.

Google, OpenAI, Anthropic, Grok, Groq and DeepSeek requests have a shared 15-second
deadline across pages. The settings view stores their last successful catalog for
network failure fallback. No API key is stored in that catalog. Anthropic uses a
4096-token request budget if output limit metadata is unavailable.

Some APIs do not expose chat or tool capabilities. Name-based exclusion is a
heuristic and cannot guarantee every returned model supports every generation mode.
The SDK contract tests use the actual pinned SDKs with intercepted HTTP/SSE responses. Live cloud account access still requires provider keys. See `ai-sdk-migration-1.25.0.md` for validation results.
