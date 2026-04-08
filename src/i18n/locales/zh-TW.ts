import { EXIT_CODES } from '../../errors';
import type { LocaleTextBundle } from '../types';

export const zhTWLocale: LocaleTextBundle = {
  errorMessages: {
    [EXIT_CODES.NOT_GIT_REPO]: {
      title: '不是 Git 儲存庫',
      action: '請開啟包含 Git 儲存庫的資料夾。',
    },
    [EXIT_CODES.STAGE_FAILED]: {
      title: '暫存變更失敗',
      action: '請確認 Git 設定是否正確。',
    },
    [EXIT_CODES.NO_CHANGES]: {
      title: '沒有可提交的變更',
      action: '請先修改檔案。',
    },
    [EXIT_CODES.NO_CHANGES_BUT_UNTRACKED]: {
      title: '未偵測到已暫存變更',
      action: '發現未追蹤檔案，請先暫存再產生 commit message。',
    },
    [EXIT_CODES.NO_TRACKED_CHANGES_BUT_UNTRACKED]: {
      title: '只有未追蹤檔案',
      action: '目前只有新檔案，請先暫存後再產生 commit。',
    },
    [EXIT_CODES.CANCELLED]: {
      title: '已取消產生',
      action: '使用者已取消產生流程。',
    },
    [EXIT_CODES.MIXED_CHANGES]: {
      title: '偵測到混合變更',
      action: '同時存在 staged 與 unstaged 變更，請選擇處理方式。',
    },
    [EXIT_CODES.API_KEY_MISSING]: {
      title: '未設定 API Key',
      action: '請先在 Commit-Copilot 面板設定 API Key。',
    },
    [EXIT_CODES.API_KEY_INVALID]: {
      title: 'API Key 無效',
      action: 'API Key 可能無效或已被撤銷，請更新後再試。',
    },
    [EXIT_CODES.QUOTA_EXCEEDED]: {
      title: 'API 配額已用盡',
      action: '請至供應商後台確認帳戶配額。',
    },
    [EXIT_CODES.API_ERROR]: {
      title: 'API 請求失敗',
      action: '與 API 通訊時發生錯誤，請稍後再試。',
    },
    [EXIT_CODES.COMMIT_FAILED]: {
      title: '提交變更失敗',
      action: '請確認是否有 Git 衝突或其他問題。',
    },
    [EXIT_CODES.UNKNOWN_ERROR]: {
      title: '發生未預期錯誤',
      action: '請查看「Commit-Copilot Debug」輸出以取得細節。',
    },
  },
  extensionText: {
    output: {
      generationIgnored: '忽略產生請求：目前已有產生流程進行中。',
      generationStart: (timestamp) =>
        `[${timestamp}] 開始執行 commit-copilot 產生流程...`,
      gitExtensionMissing: '錯誤：找不到 Git extension。',
      selectedRepoFromScm: (path) => `從 SCM 內容選擇儲存庫：${path}`,
      selectedRepoFromEditor: (path) => `從目前編輯器選擇儲存庫：${path}`,
      noRepoMatchedActiveEditor: '目前編輯器未對應到任何儲存庫。',
      noActiveEditorForRepoSelection: '找不到作用中的編輯器，無法選擇儲存庫。',
      selectedOnlyRepo: (path) => `已選擇唯一儲存庫：${path}`,
      multiRepoNotDetermined: (count) =>
        `找到 ${count} 個儲存庫，但無法判定作用中的目標。`,
      noRepoInApi: 'Git API 中沒有可用儲存庫。',
      usingProvider: (providerName) => `使用供應商：${providerName}`,
      usingGenerateMode: (mode) => `產生模式：${mode}`,
      usingCommitOutputOptions: (optionsJson) =>
        `Commit 輸出選項：${optionsJson}`,
      missingApiKeyWarning: (provider) => `警告：${provider} 尚未設定 API Key。`,
      cancelRequestedFromProgress: '已從進度通知請求取消。',
      callingGenerateCommitMessage: '呼叫 generateCommitMessage...',
      repositoryPath: (path) => `儲存庫路徑：${path}`,
      usingModel: (model) => `使用模型：${model}`,
      generatedMessage: (message) => `已產生訊息：${message}`,
      generationError: (errorCode, message) =>
        `錯誤：${errorCode} - ${message}`,
      unexpectedError: (message) => `未預期錯誤：${message}`,
      openingLanguageSettings: '正在開啟 Activity View 的語言設定...',
    },
    notification: {
      gitExtensionMissing:
        '找不到 Git extension。請確認已安裝 Git 並啟用 Git extension。',
      multiRepoWarning:
        '偵測到多個 Git 儲存庫。請先聚焦目標儲存庫中的檔案，或從 SCM 視圖執行。',
      repoNotFound: '找不到 Git 儲存庫。請開啟包含 Git 儲存庫的資料夾。',
      apiKeyMissing: (providerName) =>
        `${providerName} API Key 尚未設定。請先在 Commit-Copilot 面板設定 API Key。`,
      configureApiKeyAction: '設定 API Key',
      mixedChangesQuestion:
        '目前同時有 staged 與 unstaged 變更。請選擇要如何處理：',
      stageAllAndGenerate: '全部暫存並產生',
      proceedStagedOnly: '僅使用已暫存內容',
      cancel: '取消',
      noStagedButUntrackedQuestion:
        '目前沒有 staged 變更，但有未追蹤檔案。要先暫存全部檔案（含未追蹤）還是只針對已追蹤修改產生？',
      stageAndGenerateAll: '暫存並產生全部',
      generateTrackedOnly: '只產生已追蹤修改',
      onlyUntrackedQuestion:
        '目前只有未追蹤檔案，沒有已追蹤修改。要暫存並追蹤這些新檔案後產生 commit 嗎？',
      stageAndTrack: '暫存並追蹤',
      commitGenerated: '已產生 Commit Message！',
      viewProviderConsoleAction: '開啟供應商後台',
      noChanges: '目前沒有可提交的變更，請先修改檔案！',
      generationCanceled: '已取消 commit message 產生。',
      failedPrefix: 'Commit-Copilot 執行失敗',
    },
  },
  sidePanelText: {
    invalidApiKeyPrefix: 'API Key 無效',
    quotaExceededPrefix: 'API 配額已用盡',
    apiRequestFailedPrefix: 'API 請求失敗',
    connectionErrorPrefix: '連線錯誤',
    unknownProvider: '未知的供應商',
    cannotConnectOllamaAt: (host) => `無法連線到 ${host} 的 Ollama`,
    cannotConnectOllama: (message) =>
      `無法連線到 Ollama：${message}。請確認 Ollama 已啟動。`,
    apiKeyCannotBeEmpty: 'API Key 不可為空',
    validationFailedPrefix: '驗證失敗',
    unableToConnectFallback: '無法連線',
    saveConfigSuccess: (providerName) => `已儲存 ${providerName} 設定！`,
    saveConfigFailed: '儲存設定失敗',
    languageSaved: (label) => `語言已更新：${label}`,
  },
  webviewLanguagePack: {
    sections: {
      apiProvider: 'API 供應商',
      configuration: 'API 設定',
      ollamaConfiguration: 'Ollama 設定',
      model: '模型',
      generateConfiguration: '產生設定',
      settings: '設定',
      addProvider: '新增自訂供應商',
    },
    labels: {
      provider: '供應商',
      apiKey: 'API Key',
      ollamaHostUrl: 'Ollama 主機 URL',
      model: '模型',
      mode: '模式',
      conventionalCommitSections: '約定式提交區塊',
      includeScope: '包含 Scope',
      includeBody: '包含 Body',
      includeFooter: '包含 Footer',
      language: 'Extension 語言',
      maxAgentSteps: '最大 Agent 步數',
      providerName: '供應商名稱',
      apiBaseUrl: 'API Base URL',
    },
    placeholders: {
      selectProvider: '請選擇供應商...',
      selectModel: '請選擇模型...',
      selectGenerateMode: '請選擇產生模式...',
      enterApiKey: '請輸入 API Key',
      enterGeminiApiKey: '請輸入 Gemini API Key',
      enterOpenAIApiKey: '請輸入 OpenAI API Key',
      enterAnthropicApiKey: '請輸入 Anthropic API Key',
      enterProviderName: '例如 DeepSeek、Groq、Together AI...',
      enterApiBaseUrl: '例如 https://api.deepseek.com/v1',
      enterCustomApiKey: '請輸入 API Key',
    },
    buttons: {
      save: '儲存',
      validating: '驗證中...',
      generateCommitMessage: '產生 Commit Message',
      cancelGenerating: '取消產生',
      back: '返回',
      editProvider: '編輯 Provider',
      addProvider: '+ 新增 Provider...',
      deleteProvider: '刪除 Provider',
    },
    statuses: {
      checkingStatus: '檢查狀態中...',
      configured: '已設定',
      notConfigured: '未設定',
      validating: '驗證中...',
      loadingConfiguration: '載入設定中...',
      noChangesDetected: '未偵測到變更',
      cancelCurrentGeneration: '取消目前產生流程',
      languageSaved: '語言已更新。',
      providerNameConflict: '已存在相同名稱的供應商。',
      providerNameRequired: '請輸入供應商名稱。',
      baseUrlRequired: '請輸入 API Base URL。',
      apiKeyRequired: '請輸入 API Key。',
      providerSaved: '已儲存自訂供應商！',
      providerDeleted: '已刪除自訂供應商。',
    },
    descriptions: {
      ollamaFixedToDirectDiff: 'Ollama 固定使用 Direct Diff 模式',
      agenticModeDescription: 'Agentic 模式會使用儲存庫工具做更深入分析',
      directDiffDescription: 'Direct Diff 會將原始 diff 直接送給模型',
      ollamaInfo:
        '<strong>Ollama</strong> 在本機執行。<br>預設主機：<code>{host}</code><br>產生前請確認 Ollama 已啟動。',
      googleInfo:
        '請到 <strong>Google AI Studio</strong> 取得 API Key：<br><a href="https://aistudio.google.com/app/apikey" style="color: var(--vscode-textLink-foreground);">aistudio.google.com</a>',
      openaiInfo:
        '請到 <strong>OpenAI Platform</strong> 取得 API Key：<br><a href="https://platform.openai.com/api-keys" style="color: var(--vscode-textLink-foreground);">platform.openai.com</a>',
      anthropicInfo:
        '請到 <strong>Anthropic Console</strong> 取得 API Key：<br><a href="https://platform.claude.com/settings/keys" style="color: var(--vscode-textLink-foreground);">platform.claude.com</a>',
      maxAgentStepsDescription: '限制每次產生的 Agent 工具呼叫次數。輸入 0 或留空表示無限制。',
      customProviderInfo: '自訂供應商必須<strong>兼容 OpenAI</strong>。<br>API Base URL 需指向支援 OpenAI Chat Completions API 的服務。',
    },
    options: {
      agentic: 'Agentic 產生',
      directDiff: 'Direct Diff',
    },
  },
  progressMessages: {
    exact: {
      'Agent analyzing changes...': 'Agent 正在分析變更...',
      'Generating commit message...': '正在產生 commit message...',
    },
    patterns: [
      {
        pattern: /^Pulling (.+)$/,
        format: (value) => `正在下載 ${value}`,
      },
      {
        pattern: /^\[Step (\d+)\] Analyzing diff: (.+)$/,
        format: (step, path) => `[步驟 ${step}] 分析 diff：${path}`,
      },
      {
        pattern: /^\[Step (\d+)\] Reading file: (.+)$/,
        format: (step, path) => `[步驟 ${step}] 讀取檔案：${path}`,
      },
      {
        pattern: /^\[Step (\d+)\] Getting outline: (.+)$/,
        format: (step, path) => `[步驟 ${step}] 取得結構：${path}`,
      },
      {
        pattern: /^\[Step (\d+)\] Finding references: (.+)$/,
        format: (step, target) => `[步驟 ${step}] 查找參照：${target}`,
      },
      {
        pattern: /^\[Step (\d+)\] Fetching recent commits: (.+) entries$/,
        format: (step, count) => `[步驟 ${step}] 取得近期 commits：${count} 筆`,
      },
      {
        pattern: /^\[Step (\d+)\] Searching project for: (.+)$/,
        format: (step, keyword) => `[步驟 ${step}] 在專案中搜尋：${keyword}`,
      },
      {
        pattern: /^\[Step (\d+)\] Calling (.+)\.\.\.$/,
        format: (step, toolName) => `[步驟 ${step}] 呼叫 ${toolName}...`,
      },
      {
        pattern: /^\[Step (\d+)\] Analyzing diffs: (.+)$/,
        format: (step, paths) => `[步驟 ${step}] 分析多個 diff：${paths}`,
      },
      {
        pattern: /^\[Step (\d+)\] Analyzing diffs for (\d+) files\.\.\.$/,
        format: (step, count) => `[步驟 ${step}] 分析 ${count} 個檔案的 diff...`,
      },
      {
        pattern: /^\[Step (\d+)\] Reading files: (.+)$/,
        format: (step, paths) => `[步驟 ${step}] 讀取多個檔案：${paths}`,
      },
      {
        pattern: /^\[Step (\d+)\] Reading (\d+) files\.\.\.$/,
        format: (step, count) => `[步驟 ${step}] 讀取 ${count} 個檔案...`,
      },
      {
        pattern: /^\[Step (\d+)\] Getting outlines: (.+)$/,
        format: (step, paths) => `[步驟 ${step}] 取得多個檔案結構：${paths}`,
      },
      {
        pattern: /^\[Step (\d+)\] Getting outlines for (\d+) files\.\.\.$/,
        format: (step, count) => `[步驟 ${step}] 取得 ${count} 個檔案結構...`,
      },
      {
        pattern: /^\[Step (\d+)\] Finding references for (\d+) symbols\.\.\.$/,
        format: (step, count) => `[步驟 ${step}] 查找 ${count} 個符號的參照...`,
      },
      {
        pattern: /^\[Step (\d+)\] Fetching recent commits\.\.\.$/,
        format: (step) => `[步驟 ${step}] 取得近期 commits...`,
      },
      {
        pattern: /^\[Step (\d+)\] Searching project for (\d+) keywords\.\.\.$/,
        format: (step, count) =>
          `[步驟 ${step}] 在專案中搜尋 ${count} 個關鍵字...`,
      },
      {
        pattern: /^\[Step (\d+)\] Executing (\d+) investigation tools\.\.\.$/,
        format: (step, count) => `[步驟 ${step}] 執行 ${count} 個調查工具...`,
      },
    ],
  },
};
