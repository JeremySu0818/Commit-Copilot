import { EXIT_CODES } from './errors';

export type DisplayLanguage = 'auto' | 'en' | 'zh-TW';
export type EffectiveDisplayLanguage = 'en' | 'zh-TW';

export const DISPLAY_LANGUAGE_STATE_KEY = 'DISPLAY_LANGUAGE';
export const DEFAULT_DISPLAY_LANGUAGE: DisplayLanguage = 'auto';

export type LanguageOption = {
  value: DisplayLanguage;
  labels: Record<EffectiveDisplayLanguage, string>;
};

export const DISPLAY_LANGUAGE_OPTIONS: LanguageOption[] = [
  {
    value: 'auto',
    labels: { en: 'Auto (Follow VS Code)', 'zh-TW': '自動（跟隨 VS Code）' },
  },
  { value: 'en', labels: { en: 'English', 'zh-TW': '英文' } },
  {
    value: 'zh-TW',
    labels: { en: 'Traditional Chinese', 'zh-TW': '繁體中文' },
  },
];

export function normalizeDisplayLanguage(value: unknown): DisplayLanguage {
  if (value === 'en' || value === 'zh-TW' || value === 'auto') {
    return value;
  }
  return DEFAULT_DISPLAY_LANGUAGE;
}

export function resolveEffectiveDisplayLanguage(
  displayLanguage: DisplayLanguage,
  vscodeLanguage?: string,
): EffectiveDisplayLanguage {
  if (displayLanguage === 'en' || displayLanguage === 'zh-TW') {
    return displayLanguage;
  }
  const normalized = String(vscodeLanguage || '')
    .trim()
    .toLowerCase();
  if (normalized.startsWith('zh')) {
    return 'zh-TW';
  }
  return 'en';
}

type ErrorInfo = { title: string; action?: string };

const LOCALIZED_ERROR_MESSAGES: Record<
  EffectiveDisplayLanguage,
  Record<number, ErrorInfo>
> = {
  en: {
    [EXIT_CODES.NOT_GIT_REPO]: {
      title: 'Not a Git repository',
      action: 'Please open a folder that contains a Git repository.',
    },
    [EXIT_CODES.STAGE_FAILED]: {
      title: 'Failed to stage changes',
      action: 'Check if Git is properly configured.',
    },
    [EXIT_CODES.NO_CHANGES]: {
      title: 'No changes to commit',
      action: 'Make some changes to your files first.',
    },
    [EXIT_CODES.NO_CHANGES_BUT_UNTRACKED]: {
      title: 'No staged changes detected',
      action:
        'Untracked files found. Please stage them to generate a commit message.',
    },
    [EXIT_CODES.NO_TRACKED_CHANGES_BUT_UNTRACKED]: {
      title: 'Only untracked files found',
      action:
        'You have newly created files but no tracked modifications. Please stage them to generate a commit.',
    },
    [EXIT_CODES.CANCELLED]: {
      title: 'Generation cancelled',
      action: 'Generation was cancelled by user.',
    },
    [EXIT_CODES.MIXED_CHANGES]: {
      title: 'Mixed changes detected',
      action:
        'You have both staged and unstaged changes. Please choose how to proceed.',
    },
    [EXIT_CODES.API_KEY_MISSING]: {
      title: 'API Key not configured',
      action: 'Please set your API Key in the Commit-Copilot panel.',
    },
    [EXIT_CODES.API_KEY_INVALID]: {
      title: 'Invalid API Key',
      action:
        'Your API Key is invalid or has been revoked. Please check and update it.',
    },
    [EXIT_CODES.QUOTA_EXCEEDED]: {
      title: 'API quota exceeded',
      action:
        'You have exceeded your API quota. Please check your provider account.',
    },
    [EXIT_CODES.API_ERROR]: {
      title: 'API request failed',
      action:
        'There was an error communicating with the API. Please try again.',
    },
    [EXIT_CODES.COMMIT_FAILED]: {
      title: 'Failed to commit changes',
      action: 'Check if there are any Git conflicts or issues.',
    },
    [EXIT_CODES.UNKNOWN_ERROR]: {
      title: 'An unexpected error occurred',
      action: 'Check the "Commit-Copilot Debug" output for details.',
    },
  },
  'zh-TW': {
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
};

export function getLocalizedErrorInfo(
  language: EffectiveDisplayLanguage,
  exitCode: number,
): ErrorInfo {
  return (
    LOCALIZED_ERROR_MESSAGES[language][exitCode] ||
    LOCALIZED_ERROR_MESSAGES[language][EXIT_CODES.UNKNOWN_ERROR]
  );
}

export type ExtensionText = {
  output: {
    generationIgnored: string;
    generationStart: (timestamp: string) => string;
    gitExtensionMissing: string;
    selectedRepoFromScm: (path: string) => string;
    selectedRepoFromEditor: (path: string) => string;
    noRepoMatchedActiveEditor: string;
    noActiveEditorForRepoSelection: string;
    selectedOnlyRepo: (path: string) => string;
    multiRepoNotDetermined: (count: number) => string;
    noRepoInApi: string;
    usingProvider: (providerName: string) => string;
    usingGenerateMode: (mode: string) => string;
    usingCommitOutputOptions: (optionsJson: string) => string;
    missingApiKeyWarning: (provider: string) => string;
    cancelRequestedFromProgress: string;
    callingGenerateCommitMessage: string;
    repositoryPath: (path: string) => string;
    usingModel: (model: string) => string;
    generatedMessage: (message: string) => string;
    generationError: (errorCode: string, message: string) => string;
    unexpectedError: (message: string) => string;
    openingLanguageSettings: string;
  };
  notification: {
    gitExtensionMissing: string;
    multiRepoWarning: string;
    repoNotFound: string;
    apiKeyMissing: (providerName: string) => string;
    configureApiKeyAction: string;
    mixedChangesQuestion: string;
    stageAllAndGenerate: string;
    proceedStagedOnly: string;
    cancel: string;
    noStagedButUntrackedQuestion: string;
    stageAndGenerateAll: string;
    generateTrackedOnly: string;
    onlyUntrackedQuestion: string;
    stageAndTrack: string;
    commitGenerated: string;
    viewProviderConsoleAction: string;
    noChanges: string;
    generationCanceled: string;
    failedPrefix: string;
  };
};

const EXTENSION_TEXTS: Record<EffectiveDisplayLanguage, ExtensionText> = {
  en: {
    output: {
      generationIgnored:
        'Generation request ignored: generation already in progress.',
      generationStart: (timestamp) =>
        `[${timestamp}] Starting commit-copilot generation...`,
      gitExtensionMissing: 'Error: Git extension not found.',
      selectedRepoFromScm: (path) =>
        `Selected repository from SCM context: ${path}`,
      selectedRepoFromEditor: (path) =>
        `Selected repository from active editor: ${path}`,
      noRepoMatchedActiveEditor: 'No repository matched the active editor.',
      noActiveEditorForRepoSelection:
        'No active editor found for repository selection.',
      selectedOnlyRepo: (path) => `Selected only repository: ${path}`,
      multiRepoNotDetermined: (count) =>
        `Found ${count} repositories but could not determine the active one.`,
      noRepoInApi: 'No repositories found in API.',
      usingProvider: (providerName) => `Using provider: ${providerName}`,
      usingGenerateMode: (mode) => `Generation mode: ${mode}`,
      usingCommitOutputOptions: (optionsJson) =>
        `Commit output options: ${optionsJson}`,
      missingApiKeyWarning: (provider) =>
        `Warning: No API Key found for ${provider}.`,
      cancelRequestedFromProgress: 'Cancellation requested from progress UI.',
      callingGenerateCommitMessage: 'Calling generateCommitMessage...',
      repositoryPath: (path) => `Repository path: ${path}`,
      usingModel: (model) => `Using model: ${model}`,
      generatedMessage: (message) => `Generated message: ${message}`,
      generationError: (errorCode, message) =>
        `Error: ${errorCode} - ${message}`,
      unexpectedError: (message) => `Unexpected error: ${message}`,
      openingLanguageSettings: 'Opening language settings in activity view...',
    },
    notification: {
      gitExtensionMissing:
        'Git extension not found. Please ensure Git is installed and the Git extension is enabled.',
      multiRepoWarning:
        'Multiple Git repositories found. Please focus a file in the target repository or run from the SCM view.',
      repoNotFound:
        'No Git repository found. Please open a folder containing a Git repository.',
      apiKeyMissing: (providerName) =>
        `${providerName} API Key is not configured. Please set your API Key in the Commit-Copilot panel first.`,
      configureApiKeyAction: 'Configure API Key',
      mixedChangesQuestion:
        'You have both staged and unstaged changes. How would you like to proceed?',
      stageAllAndGenerate: 'Stage All & Generate',
      proceedStagedOnly: 'Proceed with Staged Only',
      cancel: 'Cancel',
      noStagedButUntrackedQuestion:
        'No staged changes detected. Untracked files found. Would you like to stage all files (including untracked) or generate only for tracked modified files?',
      stageAndGenerateAll: 'Stage & Generate All',
      generateTrackedOnly: 'Generate Tracked Only',
      onlyUntrackedQuestion:
        'Only untracked files are present with no tracked modifications. Do you want to stage and track these new files to generate a commit?',
      stageAndTrack: 'Stage & Track',
      commitGenerated: 'Commit message generated!',
      viewProviderConsoleAction: 'View Provider Console',
      noChanges: 'No changes to commit. Make some changes first!',
      generationCanceled: 'Commit message generation canceled.',
      failedPrefix: 'Commit-Copilot failed',
    },
  },
  'zh-TW': {
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
      missingApiKeyWarning: (provider) =>
        `警告：${provider} 尚未設定 API Key。`,
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
};

export function getExtensionText(
  language: EffectiveDisplayLanguage,
): ExtensionText {
  return EXTENSION_TEXTS[language];
}

export type SidePanelText = {
  invalidApiKeyPrefix: string;
  quotaExceededPrefix: string;
  apiRequestFailedPrefix: string;
  connectionErrorPrefix: string;
  unknownProvider: string;
  cannotConnectOllamaAt: (host: string) => string;
  cannotConnectOllama: (message: string) => string;
  apiKeyCannotBeEmpty: string;
  validationFailedPrefix: string;
  unableToConnectFallback: string;
  saveConfigSuccess: (providerName: string) => string;
  saveConfigFailed: string;
  languageSaved: (label: string) => string;
};

const SIDE_PANEL_TEXTS: Record<EffectiveDisplayLanguage, SidePanelText> = {
  en: {
    invalidApiKeyPrefix: 'Invalid API Key',
    quotaExceededPrefix: 'API quota exceeded',
    apiRequestFailedPrefix: 'API request failed',
    connectionErrorPrefix: 'Connection error',
    unknownProvider: 'Unknown provider',
    cannotConnectOllamaAt: (host) => `Cannot connect to Ollama at ${host}`,
    cannotConnectOllama: (message) =>
      `Cannot connect to Ollama: ${message}. Make sure Ollama is running.`,
    apiKeyCannotBeEmpty: 'API Key cannot be empty',
    validationFailedPrefix: 'Validation failed',
    unableToConnectFallback: 'Unable to connect',
    saveConfigSuccess: (providerName) =>
      `${providerName} configuration saved successfully!`,
    saveConfigFailed: 'Failed to save configuration',
    languageSaved: (label) => `Language updated: ${label}`,
  },
  'zh-TW': {
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
};

export function getSidePanelText(
  language: EffectiveDisplayLanguage,
): SidePanelText {
  return SIDE_PANEL_TEXTS[language];
}

export type WebviewLanguagePack = {
  sections: {
    apiProvider: string;
    configuration: string;
    ollamaConfiguration: string;
    model: string;
    generateConfiguration: string;
    settings: string;
  };
  labels: {
    provider: string;
    apiKey: string;
    ollamaHostUrl: string;
    model: string;
    mode: string;
    conventionalCommitSections: string;
    includeScope: string;
    includeBody: string;
    includeFooter: string;
    language: string;
  };
  placeholders: {
    selectProvider: string;
    selectModel: string;
    selectGenerateMode: string;
    enterApiKey: string;
    enterGeminiApiKey: string;
    enterOpenAIApiKey: string;
    enterAnthropicApiKey: string;
  };
  buttons: {
    save: string;
    validating: string;
    generateCommitMessage: string;
    cancelGenerating: string;
    back: string;
  };
  statuses: {
    checkingStatus: string;
    configured: string;
    notConfigured: string;
    validating: string;
    loadingConfiguration: string;
    noChangesDetected: string;
    cancelCurrentGeneration: string;
    languageSaved: string;
  };
  descriptions: {
    ollamaFixedToDirectDiff: string;
    agenticModeDescription: string;
    directDiffDescription: string;
    ollamaInfo: string;
    googleInfo: string;
    openaiInfo: string;
    anthropicInfo: string;
  };
  options: {
    agentic: string;
    directDiff: string;
  };
};

export const WEBVIEW_LANGUAGE_PACKS: Record<
  EffectiveDisplayLanguage,
  WebviewLanguagePack
> = {
  en: {
    sections: {
      apiProvider: 'API Provider',
      configuration: 'API Configuration',
      ollamaConfiguration: 'Ollama Configuration',
      model: 'Model',
      generateConfiguration: 'Generate Configuration',
      settings: 'Settings',
    },
    labels: {
      provider: 'Provider',
      apiKey: 'API Key',
      ollamaHostUrl: 'Ollama Host URL',
      model: 'Model',
      mode: 'Mode',
      conventionalCommitSections: 'Conventional Commit Sections',
      includeScope: 'Include Scope',
      includeBody: 'Include Body',
      includeFooter: 'Include Footer',
      language: 'Extension Language',
    },
    placeholders: {
      selectProvider: 'Select a provider...',
      selectModel: 'Select a model...',
      selectGenerateMode: 'Select generate mode...',
      enterApiKey: 'Enter your API Key',
      enterGeminiApiKey: 'Enter your Gemini API Key',
      enterOpenAIApiKey: 'Enter your OpenAI API Key',
      enterAnthropicApiKey: 'Enter your Anthropic API Key',
    },
    buttons: {
      save: 'Save',
      validating: 'Validating...',
      generateCommitMessage: 'Generate Commit Message',
      cancelGenerating: 'Cancel Generating',
      back: 'Back',
    },
    statuses: {
      checkingStatus: 'Checking status...',
      configured: 'Configured',
      notConfigured: 'Not configured',
      validating: 'Validating...',
      loadingConfiguration: 'Loading configuration...',
      noChangesDetected: 'No changes detected',
      cancelCurrentGeneration: 'Cancel current generation',
      languageSaved: 'Language updated.',
    },
    descriptions: {
      ollamaFixedToDirectDiff: 'Ollama is fixed to Direct Diff mode',
      agenticModeDescription:
        'Agentic mode uses repository tools for deeper analysis',
      directDiffDescription:
        'Direct Diff sends the raw diff directly to the model',
      ollamaInfo:
        '<strong>Ollama</strong> runs locally on your machine.<br>Default host: <code>{host}</code><br>Make sure Ollama is running before generating.',
      googleInfo:
        'Get your API key from <strong>Google AI Studio</strong>:<br><a href="https://aistudio.google.com/app/apikey" style="color: var(--vscode-textLink-foreground);">aistudio.google.com</a>',
      openaiInfo:
        'Get your API key from <strong>OpenAI Platform</strong>:<br><a href="https://platform.openai.com/api-keys" style="color: var(--vscode-textLink-foreground);">platform.openai.com</a>',
      anthropicInfo:
        'Get your API key from <strong>Anthropic Console</strong>:<br><a href="https://platform.claude.com/settings/keys" style="color: var(--vscode-textLink-foreground);">platform.claude.com</a>',
    },
    options: {
      agentic: 'Agentic Generate',
      directDiff: 'Direct Diff',
    },
  },
  'zh-TW': {
    sections: {
      apiProvider: 'API 供應商',
      configuration: 'API 設定',
      ollamaConfiguration: 'Ollama 設定',
      model: '模型',
      generateConfiguration: '產生設定',
      settings: '設定',
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
    },
    placeholders: {
      selectProvider: '請選擇供應商...',
      selectModel: '請選擇模型...',
      selectGenerateMode: '請選擇產生模式...',
      enterApiKey: '請輸入 API Key',
      enterGeminiApiKey: '請輸入 Gemini API Key',
      enterOpenAIApiKey: '請輸入 OpenAI API Key',
      enterAnthropicApiKey: '請輸入 Anthropic API Key',
    },
    buttons: {
      save: '儲存',
      validating: '驗證中...',
      generateCommitMessage: '產生 Commit Message',
      cancelGenerating: '取消產生',
      back: '返回',
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
    },
    options: {
      agentic: 'Agentic 產生',
      directDiff: 'Direct Diff',
    },
  },
};

function replacePlaceholders(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) => {
    return values[key] ?? '';
  });
}

export function localizeProgressMessage(
  message: string,
  language: EffectiveDisplayLanguage,
): string {
  if (language === 'en') {
    return message;
  }

  if (message === 'Agent analyzing changes...') {
    return 'Agent 正在分析變更...';
  }
  if (message === 'Generating commit message...') {
    return '正在產生 commit message...';
  }
  if (message.startsWith('Pulling ')) {
    return message.replace(/^Pulling /, '正在下載 ');
  }

  const linePatterns: Array<[RegExp, (...groups: string[]) => string]> = [
    [
      /^\[Step (\d+)\] Analyzing diff: (.+)$/,
      (step, path) => `[步驟 ${step}] 分析 diff：${path}`,
    ],
    [
      /^\[Step (\d+)\] Reading file: (.+)$/,
      (step, path) => `[步驟 ${step}] 讀取檔案：${path}`,
    ],
    [
      /^\[Step (\d+)\] Getting outline: (.+)$/,
      (step, path) => `[步驟 ${step}] 取得結構：${path}`,
    ],
    [
      /^\[Step (\d+)\] Finding references: (.+)$/,
      (step, target) => `[步驟 ${step}] 查找參照：${target}`,
    ],
    [
      /^\[Step (\d+)\] Fetching recent commits: (.+) entries$/,
      (step, count) => `[步驟 ${step}] 取得近期 commits：${count} 筆`,
    ],
    [
      /^\[Step (\d+)\] Searching project for: (.+)$/,
      (step, keyword) => `[步驟 ${step}] 在專案中搜尋：${keyword}`,
    ],
    [
      /^\[Step (\d+)\] Calling (.+)\.\.\.$/,
      (step, toolName) => `[步驟 ${step}] 呼叫 ${toolName}...`,
    ],
    [
      /^\[Step (\d+)\] Analyzing diffs: (.+)$/,
      (step, paths) => `[步驟 ${step}] 分析多個 diff：${paths}`,
    ],
    [
      /^\[Step (\d+)\] Analyzing diffs for (\d+) files\.\.\.$/,
      (step, count) => `[步驟 ${step}] 分析 ${count} 個檔案的 diff...`,
    ],
    [
      /^\[Step (\d+)\] Reading files: (.+)$/,
      (step, paths) => `[步驟 ${step}] 讀取多個檔案：${paths}`,
    ],
    [
      /^\[Step (\d+)\] Reading (\d+) files\.\.\.$/,
      (step, count) => `[步驟 ${step}] 讀取 ${count} 個檔案...`,
    ],
    [
      /^\[Step (\d+)\] Getting outlines: (.+)$/,
      (step, paths) => `[步驟 ${step}] 取得多個檔案結構：${paths}`,
    ],
    [
      /^\[Step (\d+)\] Getting outlines for (\d+) files\.\.\.$/,
      (step, count) => `[步驟 ${step}] 取得 ${count} 個檔案結構...`,
    ],
    [
      /^\[Step (\d+)\] Finding references for (\d+) symbols\.\.\.$/,
      (step, count) => `[步驟 ${step}] 查找 ${count} 個符號的參照...`,
    ],
    [
      /^\[Step (\d+)\] Fetching recent commits\.\.\.$/,
      (step) => `[步驟 ${step}] 取得近期 commits...`,
    ],
    [
      /^\[Step (\d+)\] Searching project for (\d+) keywords\.\.\.$/,
      (step, count) => `[步驟 ${step}] 在專案中搜尋 ${count} 個關鍵字...`,
    ],
    [
      /^\[Step (\d+)\] Executing (\d+) investigation tools\.\.\.$/,
      (step, count) => `[步驟 ${step}] 執行 ${count} 個調查工具...`,
    ],
  ];

  for (const [pattern, formatter] of linePatterns) {
    const match = message.match(pattern);
    if (match) {
      return formatter(...match.slice(1));
    }
  }

  return message;
}

export function getDisplayLanguageLabel(
  language: DisplayLanguage,
  uiLanguage: EffectiveDisplayLanguage,
): string {
  const option = DISPLAY_LANGUAGE_OPTIONS.find(
    (item) => item.value === language,
  );
  return option ? option.labels[uiLanguage] : language;
}

export function formatWebviewText(
  template: string,
  values: Record<string, string>,
): string {
  return replacePlaceholders(template, values);
}
