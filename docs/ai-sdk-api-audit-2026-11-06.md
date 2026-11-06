# AI SDK 與 API 相容性稽核

查核日期：2026-11-06。對象：`commit-copilot-1.24.0.vsix`。

此文保留升級前的稽核結果。整合至 1.24.0 的修正與驗證結果另見 [遷移紀錄](ai-sdk-migration.md)。

結論：三套 SDK 已落後最新主版本；有明確的模型路由問題、已棄用的 xAI 呼叫介面，以及 Qwen、Anthropic 的條件性相容性風險。SDK 版本落後不等於 API 已停止服務，以下分開記錄。

## 查核依據與限制

- 從 VSIX 讀取 manifest 及 `extension/out/extension.js`，確認 bundle 與工作目錄的 `out/extension.js` 逐位元組一致。
- 在 bundle 中找到四套 SDK 的版本常數，與 `package-lock.json` 一致；不是只看 `package.json` 的版本範圍。
- VSIX SHA-256：`08fc993f660579d26f2bfc923a375a08c081913e17c9ddcc62a93898a3f55cf2`。
- 對照官方 API 文件，透過 npm 官方 registry 查詢最新版本，另解開 Anthropic 最新 SDK tarball 核對版本與認證標頭。
- `npm run check-types` 通過；相關既有離線測試 **72/72 通過**，涵蓋 clients、agent loops、模型探索與 provider 驗證。
- 額外使用真實的已安裝 SDK、目前原始碼及攔截的 `fetch`，執行 **9 家供應商、33 個情境、35 次模擬請求**，確認 URL、headers、body 及回應解析。工具執行器以 stub 隔離，未呼叫 VS Code API。
- 模擬回應不代表官方服務接受請求；部分斷言特別驗證下列問題確實存在。沒有使用真實 API Key，沒有驗證帳戶權限、額度、實際模型可用性或生成品質。
- 原始碼、依賴、lockfile 與 VSIX 均未修改。測試輸出寫入 `/tmp`，避免覆寫打包產物。

## SDK 實際版本

| 套件                | VSIX manifest | Bundle 實際版本 | npm latest | 判讀                                               |
| ------------------- | ------------- | --------------- | ---------- | -------------------------------------------------- |
| `openai`            | `^6.33.0`     | **6.49.0**      | **7.51.0** | 落後一個主版本；目前仍是 6.x 分支最後一版          |
| `@anthropic-ai/sdk` | `^0.98.0`     | **0.98.1**      | **1.5.0**  | 落後；0.x 也已有 0.137.0，`^0.98.0` 不會升到 0.99+ |
| `@google/genai`     | `^1.48.0`     | **1.52.0**      | **2.32.0** | 落後一個主版本；目前仍是 1.x 分支最後一版          |
| `ollama`            | `^0.6.3`      | **0.6.4**       | **0.6.4**  | 最新                                               |

版本來源：[OpenAI npm metadata](https://registry.npmjs.org/openai/latest)、[Anthropic npm metadata](https://registry.npmjs.org/@anthropic-ai%2Fsdk/latest)、[Google npm metadata](https://registry.npmjs.org/@google%2Fgenai/latest)、[Ollama npm metadata](https://registry.npmjs.org/ollama/latest)。查詢方式為 `npm view <package>@latest name version engines --json`，另查詢各舊分支版本。

Grok、Groq、OpenRouter、DeepSeek、Qwen 共用 `openai` SDK，沒有另外使用這五家的專用 SDK。

## 需要優先處理的相容性問題

### 1. OpenAI：僅支援 Responses 的模型仍會送往 Chat Completions

位置：`src/llm/clients.ts:468`、`src/agent/loop/openai.ts:125`、`src/models/discovery.ts:51`。

- Direct diff 一律呼叫 `client.chat.completions.create()`。
- Agentic 只有名稱符合 `gpt-5.6…` 或 `gpt-6…` 才走 Responses。
- 模型探索卻接受其他 `gpt-…`、`o…` 模型，例如 `gpt-5.4-pro`。
- 官方明確表示 GPT-5.4 Pro 僅支援 Responses；離線攔截確認 Agentic 實際仍送 `POST https://api.openai.com/v1/chat/completions`。

這是確定的路由／官方契約不一致；使用者選到這類模型時，兩種生成模式都可能失敗。應以供應商、API 能力與模型設定選擇協定，避免只靠目前的版本名稱正規表示式。

依據：[GPT-5.4 Pro 官方模型文件](https://developers.openai.com/api/docs/models/gpt-5.4-pro)。OpenAI 的 Chat Completions 本身仍有官方支援文件，不能把它整體判定為已停用；問題是特定模型不支援該端點。[Chat Completions 官方規格](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)

### 2. Anthropic：模型探索未處理新的 lifecycle 欄位

位置：`src/models/discovery.ts:29`、`src/models/catalog.ts:237`、`src/core/provider-routing.ts:51`。

官方模型清單現在包含 `lifecycle: active | deprecated | retired`。`retired` 模型會保留在目錄作歷史紀錄，但不能推論；`deprecated` 模型也可能不對新使用者開放。

目前只排除 `active === false`，未讀取 `lifecycle`，而無已存模型時會自動選排序後第一個。以包含 `retired` 與 `active` 的官方欄位形狀模擬，已重現退役模型仍進入清單且排第一的情況。實際影響取決於帳戶與所用 API 版本回傳的目錄。

應至少排除 `retired`，優先選 `active`，並明確處理 `deprecated` 的既有使用權。

依據：[Anthropic Models List 官方規格](https://platform.claude.com/docs/en/api/models/list)。

### 3. Qwen：部分思考模型需要串流，目前共用非串流請求

位置：`src/llm/clients.ts:468`、`src/agent/loop/openai.ts`、`src/models/catalog.ts:178`。

目前 Direct diff 與 Agentic 都使用非串流 Chat Completions，沒有依模型設定 `enable_thinking`。官方列出部分模型開啟思考時僅接受串流，否則會回 `parameter.enable_thinking only support stream call`；例如 Qwen3.5 部分開源模型。現有名稱篩選會納入這些模型。

這是特定模型／模式的相容性風險，不代表所有 Qwen 都失效。應按模型能力啟用串流，或在模型允許時明確關閉思考。

依據：[Qwen 深度思考官方文件](https://www.alibabacloud.com/help/tc/model-studio/deep-thinking)。

### 4. 自訂 Anthropic：未設定上限時省略必填 max_tokens

位置：`src/llm/clients.ts:553`、`src/llm/clients.ts:607`、`src/agent/loop/anthropic.ts:520`。

自訂 `apiFormat: anthropic`、指定 `baseUrl` 且未填 `maxTokens` 時，不使用內建 fallback，實際送出的 `/v1/messages` body 沒有 `max_tokens`。官方契約要求該參數；遵循此契約且不代填的服務會拒絕這種請求。若代理自行補入預設值則可能正常。

建議為這類設定要求有效上限，或採用模型上限內的保守預設值。這項風險不影響目前有傳上限的內建 Anthropic 路徑。

依據：[Anthropic Messages Create 官方規格](https://platform.claude.com/docs/en/api/messages/create)。

## 已棄用介面與舊設定

### xAI：Chat Completions 明確列為 deprecated／legacy

內建 Grok 的兩種模式目前都送 `/v1/chat/completions`。xAI 官方已要求新整合使用 `/v1/responses`，舊介面仍提供，但不能保留其加密推理狀態，對多輪工具呼叫尤其不利。

應新增 xAI Responses 路徑並按其規格保留推理狀態；不能只把網址換掉，因為 request、工具結果與歷史狀態格式也不同。這項遷移不能套用到所有 OpenAI 相容供應商。

依據：[xAI Best Practices](https://docs.x.ai/developers/model-capabilities/text/best-practices)、[xAI Legacy Chat Completions](https://docs.x.ai/developers/model-capabilities/legacy/chat-completions)。

### Qwen：固定舊北京域名，模型列表路徑缺乏目前官方文件支持

位置：`src/llm/provider-registry.ts:57`、`src/models/catalog.ts:35`、`src/models/catalog.ts:192`。

- 生成固定使用 `https://dashscope.aliyuncs.com/compatible-mode/v1`。官方仍表示舊域名可用，但建議改用 Workspace 專屬域名；不同區域的 Key 不能混用。內建設定沒有提供區域或 Workspace 選擇，其他區域使用者需透過自訂供應商設定正確 base URL。
- 模型清單固定呼叫 `/compatible-mode/v1/models`；目前官方模型清單文件規範的是 **`GET /api/v1/models`**，並有分頁與篩選參數。
- 未用 Key 實測前，不能聲稱舊列表路徑已回 404；但也無法依目前官方文件保證其存在及相容性。應按官方目錄 API 實作，另確認回應 schema、分頁與區域設定，不能只替換路徑。

依據：[Qwen OpenAI 相容介面／域名遷移](https://www.alibabacloud.com/help/en/model-studio/compatibility-of-openai-with-dashscope)、[查詢模型列表](https://help.aliyun.com/zh/model-studio/list-models)。

### Anthropic：2023-06-01 是舊版 API，不能只因日期舊就認定停用

VSIX SDK 與手寫模型探索請求都送 `anthropic-version: 2023-06-01`。最新 SDK 1.5.0 已改為 `2026-10-21`，API Key 預設改用 Bearer；官方仍接受兩種認證標頭。

官方有新版遷移指南，但未在本次查核文件中找到舊版必須立即停用的公告。目前 Anthropic 生成程式已不送 `temperature`、`top_p`、`top_k`，符合新版移除這三項參數的方向。

若升級 SDK，需同步評估手寫目錄請求的版本、自訂代理的 headers 與新 SDK 型別，避免生成與探索長期使用不同契約。

依據：[Anthropic API Versions](https://platform.claude.com/docs/en/api/versioning)、[2026-10-21 遷移指南](https://platform.claude.com/docs/en/api/migration-2026-10-21)。

## 各家實際端點與呼叫方式

下表為本次攔截到的目前行為。列為符合文件僅表示端點與基本呼叫方式一致，不保證所有模型都有相同能力。

| 供應商        | 基底網址                                            | 生成                                                              | 模型清單         | 判讀                                      |
| ------------- | --------------------------------------------------- | ----------------------------------------------------------------- | ---------------- | ----------------------------------------- |
| OpenAI        | `https://api.openai.com/v1`                         | `chat.completions.create()`；部分 Agentic 用 `responses.create()` | `GET /models`    | 需修正模型路由，見上文                    |
| Anthropic     | `https://api.anthropic.com`                         | `messages.stream().finalMessage()` → `/v1/messages`               | `GET /v1/models` | 舊 API 版本；需處理 lifecycle             |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta`  | `models.generateContent()` → `/models/{model}:generateContent`    | `GET /models`    | 仍受支援；SDK 已有新版                    |
| xAI Grok      | `https://api.x.ai/v1`                               | `chat.completions.create()`                                       | `GET /models`    | 生成介面已列 deprecated／legacy           |
| Groq          | `https://api.groq.com/openai/v1`                    | `chat.completions.create()`                                       | `GET /models`    | 端點符合文件                              |
| OpenRouter    | `https://openrouter.ai/api/v1`                      | `chat.completions.create()`                                       | `GET /models`    | 端點符合文件；Key 驗證用 `GET /key`       |
| DeepSeek      | `https://api.deepseek.com`                          | `chat.completions.create()` → `/chat/completions`                 | `GET /models`    | 端點符合文件；這裡沒有 `/v1` 也是官方用法 |
| Qwen          | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `chat.completions.create()`                                       | `GET /models`    | 舊區域域名、目錄及串流風險，見上文        |
| Ollama        | `http://127.0.0.1:11434`，可自訂                    | `pull()` → `/api/pull`；`chat()` → `/api/chat`                    | `GET /api/tags`  | 端點與 SDK 符合目前文件                   |

其他查核依據：[Google Gen AI SDK](https://googleapis.github.io/js-genai/release_docs/index.html)、[Google Interactions 公告](https://blog.google/innovation-and-ai/technology/developers-tools/interactions-api-general-availability/)、[Groq API](https://console.groq.com/docs/api-reference)、[OpenRouter Chat](https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request)、[OpenRouter Key](https://openrouter.ai/docs/api/api-reference/api-keys/get-current-key)、[DeepSeek 官方用法](https://api-docs.deepseek.com/)、[Ollama Chat](https://docs.ollama.com/api/chat)。

Google 已優先推薦 Interactions，但官方明言 `generateContent` 仍完整支援，不能判為已停用。目前也已使用正確的 `@google/genai`，沒有使用舊的 `@google/generative-ai`。

DeepSeek 另外核對了思考模式的工具往返：程式會把完整 assistant message 加回歷史，真實 SDK 的第二次請求仍含 `reasoning_content`，沒有發現常見的遺失推理欄位問題。[DeepSeek Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode/)

## 建議處理順序

1. 修正 OpenAI Responses 模型路由、Anthropic lifecycle 篩選與自訂 Anthropic 必填參數。
2. 補上 Qwen 區域／Workspace、官方模型目錄與思考模式的串流支援。
3. 將 xAI 遷到 Responses，加入多輪工具與推理狀態的契約測試。
4. 分別升級 SDK，避免一次把所有供應商切換到同一種 API。OpenAI 7.51.0 的 npm metadata 要求 **Node >=22**，必須與目前宣告的最低 VS Code 執行環境一起評估；Anthropic 新版有 API 版本與認證預設值變動；Google 2.x 需檢查遷移內容。
5. 保留不需 Key 的請求契約測試；日後只用持有的 Key 做少量 smoke test。列模型／驗證 Key 成功，只能證明該端點可存取，不能證明有生成額度或每個模型都能執行 Agentic。
