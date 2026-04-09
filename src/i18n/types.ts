export type DisplayLanguage = 'auto' | 'en' | 'zh-TW';
export type EffectiveDisplayLanguage = 'en' | 'zh-TW';

export type LanguageOption = {
  value: DisplayLanguage;
  labels: Record<EffectiveDisplayLanguage, string>;
};

export type ErrorInfo = { title: string; action?: string };

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

export type WebviewLanguagePack = {
  sections: {
    apiProvider: string;
    configuration: string;
    ollamaConfiguration: string;
    model: string;
    generateConfiguration: string;
    settings: string;
    addProvider: string;
    editProvider: string;
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
    maxAgentSteps: string;
    providerName: string;
    apiBaseUrl: string;
  };
  placeholders: {
    selectProvider: string;
    selectModel: string;
    selectGenerateMode: string;
    enterApiKey: string;
    enterGeminiApiKey: string;
    enterOpenAIApiKey: string;
    enterAnthropicApiKey: string;
    enterCustomApiKey: string;
  };
  buttons: {
    save: string;
    validating: string;
    generateCommitMessage: string;
    cancelGenerating: string;
    back: string;
    editProvider: string;
    addProvider: string;
    deleteProvider: string;
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
    providerNameConflict: string;
    providerNameRequired: string;
    baseUrlRequired: string;
    apiKeyRequired: string;
    providerSaved: string;
    providerDeleted: string;
    modelNameRequired: string;
  };
  descriptions: {
    ollamaFixedToDirectDiff: string;
    agenticModeDescription: string;
    directDiffDescription: string;
    ollamaInfo: string;
    googleInfo: string;
    openaiInfo: string;
    anthropicInfo: string;
    maxAgentStepsDescription: string;
    customProviderInfo: string;
  };
  options: {
    agentic: string;
    directDiff: string;
  };
};

export type ProgressMessagePattern = {
  pattern: RegExp;
  format: (...groups: string[]) => string;
};

export type ProgressMessages = {
  exact?: Record<string, string>;
  patterns?: ProgressMessagePattern[];
};

export type LocaleTextBundle = {
  errorMessages: Record<number, ErrorInfo>;
  extensionText: ExtensionText;
  sidePanelText: SidePanelText;
  webviewLanguagePack: WebviewLanguagePack;
  progressMessages?: ProgressMessages;
};
