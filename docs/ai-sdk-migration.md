# AI SDK 遷移與相容性驗證（整合至 1.24.0）

本次將 SDK 遷移整合至尚未提交的 1.24.0 工作，版本維持 1.24.0。升級前問題見 [稽核紀錄](ai-sdk-api-audit-2026-11-06.md)。本文件區分離線契約測試、真實服務測試與尚未驗證的帳戶範圍。

## 固定的 SDK 與執行環境

| SDK | 升級前 bundle | 遷移後 |
| --- | --- | --- |
| OpenAI | 6.49.0 | **7.53.0** |
| Anthropic | 0.98.1 | **1.6.0** |
| Google Gen AI | 1.52.0 | **3.0.0** |
| Ollama | 0.6.4 | **0.6.4** |

版本以本次實作時 npm 官方 registry 回傳的 stable 版本為準，使用精確版本固定。前次稽核與本次實作之間 registry 已發布新版，所以版本高於原稽核表。最低 VS Code 為 **1.101.0**，其桌面及遠端 Extension Host 已提供 Node 22。型別套件也對齊 Node 22／VS Code 1.101。[VS Code 官方執行環境說明](https://code.visualstudio.com/updates/v1_101)

## 遷移後行為

| 路徑 | Direct diff | Agentic | 模型探索與驗證 |
| --- | --- | --- | --- |
| OpenAI | Responses；舊 GPT-3.5／GPT-4 家族保留 Chat | 同左 | `/v1/models` |
| xAI | Responses | Responses，完整回送加密推理與工具結果 | `/v1/models` |
| Anthropic | Messages SSE | Messages SSE，保留簽署的思考與工具 ID | `/v1/models`，Bearer、API version `2026-10-21` |
| Google | `generateContent`，明確指定 `v1beta` | 同版 API，保留 thought signatures | 同版模型目錄；避免 SDK 3 預設 `v1` 與探索不一致 |
| Qwen | Chat Completions SSE | SSE，重組分片的參數與工具呼叫 | 原生 `/api/v1/models`，`output.models`、`output.total` 分頁 |
| Groq、OpenRouter、DeepSeek | Chat Completions | Chat Completions | 各供應商原有官方模型 API |
| Ollama | `/api/chat` | 既有文字工具協定 | `/api/tags`；已安裝模型不再向 registry 重複 pull |
| 自訂供應商 | 可選 Chat、Responses 或 Anthropic | 依選定協定 | 原有設定保留；已知 Qwen 區域端點採原生目錄 |

Responses 使用 `store: false` 和完整 output item replay，包括 `reasoning.encrypted_content`、function calls 及對應 `call_id` 的 function outputs。達到步數上限時，最後的工具結果仍會一併送出。OpenAI 相容服務不會再因模型名稱含 GPT 新版本而被誤送到 Responses。[OpenAI 官方遷移指南](https://developers.openai.com/api/docs/guides/migrate-to-responses)、[xAI 官方最佳實務](https://docs.x.ai/developers/model-capabilities/text/best-practices)

Anthropic 會排除退役與 deprecated 模型；未取得輸出上限時採 4096-token 預設。自訂 Messages 端點也必定有 `max_tokens`，並保留舊代理常用的 `x-api-key` 認證標頭；內建 Anthropic 使用新版 SDK 的 Bearer 預設值。生成不傳新版 API 已移除的 sampling 參數。[Anthropic 遷移指南](https://platform.claude.com/docs/en/api/migration-2026-10-21)、[模型生命週期規格](https://platform.claude.com/docs/en/api/models/list)

Qwen 可在 VS Code 設定 `commit-copilot.qwen.baseUrl` 指定所屬區域與 Workspace 完整相容網址，例如：

```json
{
  "commit-copilot.qwen.baseUrl": "https://WORKSPACE_ID.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1"
}
```

生成、驗證及原生模型目錄共用這個 host；Key 必須屬於同一區域。留空保留原有北京域名，因為沒有帳戶的 Workspace ID，無法自動推算專屬域名。[Qwen 區域與域名規格](https://www.alibabacloud.com/help/en/model-studio/compatibility-of-openai-with-dashscope)、[原生模型清單](https://help.aliyun.com/zh/model-studio/list-models)

另修正以下共通問題：

- SDK 內建重試與應用程式重試不再疊乘；OpenAI／Anthropic 設 `maxRetries: 0`，Google 設單次 attempt，統一交由既有 `withRetry` 處理。
- 生成採 15 分鐘 SDK timeout，模型探索／驗證採 15 秒 deadline。
- HTTP request 或串流途中取消，都回報 `GenerationCancelledError`。Ollama 額外把取消 signal 傳到所有 HTTP 請求，補上其 `client.abort()` 僅涵蓋串流 iterator 的缺口。
- Responses incomplete／failed、Chat length／content_filter、Google／Anthropic token 截斷、Qwen SSE 提早 EOF 都不會被當成完整 commit 訊息。

## 不需 Key 的契約測試

`src/test/llm/sdk-contracts.test.ts` 使用**真實 SDK**，僅攔截 HTTP 回應。沒有把 SDK 本身替換成可直接成功的假物件。串流測試會把資料切在 JSON 與 UTF-8 字元中間，檢查實際 SSE parser。

涵蓋：

- 9 家供應商的生成、Key 驗證與模型探索。
- OpenAI／xAI Responses 完整推理與工具歷史，及步數上限的最後一輪。
- Anthropic SSE signed thinking／tool-use IDs、Google 3 thought signatures／function responses。
- Qwen SSE 分片、工具參數、reasoning_content、Workspace URL 與目錄分頁。
- 舊 GPT 與自訂 Responses 路由、自訂 Anthropic 必填參數及 header 相容性。
- 400／401／429、503 重試次數、取消、截斷、提早 EOF、退役模型與重複目錄頁。
- Ollama 已安裝／本地匯入模型不需 registry pull，非串流請求也能取消。

可重跑：

```sh
npm run check-types
npm run lint
npm run test:sdk
npm run test:unit
```

## 本次執行結果

- 真實 SDK 離線契約測試：**42/42 通過**。
- 全套單元與契約測試：**237/237 通過**。
- Node **22.15.0** 執行同一套測試：**237/237 通過**，確認最低 VS Code 同世代執行環境相容。
- TypeScript 型別檢查、ESLint 與打包驗證另於交付前確認。
- OpenRouter 無 Key 的公開目錄實際連線成功：453 個模型中，389 個符合當時的文字輸出與 tools 篩選。
- 本機 Ollama **0.40.13**、既有 `qwen3.5:4b` 模型：Direct diff 真實生成成功，輸出 `chore(a.ts): update answer constant from 41 to 42`，約 60 秒。沒有下載新模型。
- Agentic 真實生成也通過：約 111 秒，保留相同模型與已安裝資料；在 Node 22.15.0 執行。先前 120 秒時間上限測試亦確認取消能正常終止。

## 驗證界線

沒有申請或讀取其他 API Key，也沒有呼叫付費雲端生成。離線測試證明的是所固定 SDK、目前程式和測試的官方 HTTP／SSE 契約相容；**無法證明每個帳戶的權限、額度、區域設定、每一款模型或第三方代理都可用**。

沒有在真實 VS Code GUI 中操作；會另檢查最終 VSIX 的 manifest、資產、bundle SDK 版本及 Node 22 載入。需要 Key 的雲端服務仍需在持有對應 Key 的環境做少量 smoke test。
