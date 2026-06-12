import type { CommitCopilotErrorMessageKey } from '../shared/errors';

export type DisplayLanguage =
  | 'auto'
  | 'ar'
  | 'cs'
  | 'de'
  | 'en'
  | 'es'
  | 'fr'
  | 'hi'
  | 'hu'
  | 'id'
  | 'it'
  | 'ja'
  | 'ko'
  | 'nl'
  | 'pl'
  | 'pt-br'
  | 'ru'
  | 'tr'
  | 'vi'
  | 'zh-CN'
  | 'zh-TW';
export type EffectiveDisplayLanguage =
  | 'ar'
  | 'cs'
  | 'de'
  | 'en'
  | 'es'
  | 'fr'
  | 'hi'
  | 'hu'
  | 'id'
  | 'it'
  | 'ja'
  | 'ko'
  | 'nl'
  | 'pl'
  | 'pt-br'
  | 'ru'
  | 'tr'
  | 'vi'
  | 'zh-CN'
  | 'zh-TW';

export interface LanguageOption {
  value: DisplayLanguage;
  label?: string;
  labels?: Record<EffectiveDisplayLanguage, string>;
}

export interface ErrorInfo {
  title: string;
  action?: string;
}

export type LocaleCommitCopilotErrorMessageKey = Exclude<
  CommitCopilotErrorMessageKey,
  'git.notRepository'
>;

export type CommitCopilotErrorMessages = Record<
  LocaleCommitCopilotErrorMessageKey,
  (args: Partial<Record<string, string>>) => string
>;

export interface ExtensionText {
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
    openingSettings: string;
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
}

export interface MainViewText {
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
}

export interface WebviewLanguagePack {
  sections: {
    apiProvider: string;
    configuration: string;
    ollamaConfiguration: string;
    model: string;
    generateConfiguration: string;
    settings: string;
    addProvider: string;
    editProvider: string;
    addModel: string;
    about: string;
    updateInfo: string;
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
    includeGitmoji: string;
    language: string;
    commitMessageLanguage: string;
    hybridGeneration: string;
    useScmInputAsDraft: string;
    maxAgentSteps: string;
    providerName: string;
    apiBaseUrl: string;
    commitMessage: string;
    modelName: string;
    version: string;
    author: string;
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
    enterModelName: string;
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
    addModel: string;
    deleteModel: string;
    cancel: string;
    showUpdateNotes: string;
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
    commitMessageLanguageSaved: string;
    providerNameConflict: string;
    providerNameRequired: string;
    baseUrlRequired: string;
    apiKeyRequired: string;
    providerSaved: string;
    providerDeleted: string;
    modelNameRequired: string;
    modelAdded: string;
    modelDeleted: string;
    modelNameConflict: string;
    fetchingModels: string;
    fetchModelsFailed: string;
  };
  descriptions: {
    agenticModeDescription: string;
    directDiffDescription: string;
    ollamaInfo: string;
    googleInfo: string;
    openaiInfo: string;
    anthropicInfo: string;
    maxAgentStepsDescription: string;
    hybridGenerationDescription: string;
    customProviderInfo: string;
  };
  options: {
    agentic: string;
    directDiff: string;
  };
}

export interface ProgressMessages {
  analyzingChanges: string;
  generatingMessage: string;
  transientApiError: (
    attempt: number,
    maxAttempts: number,
    seconds: number,
  ) => string;
  pulling: (model: string, status: string, percent?: number) => string;

  stepAnalyzingDiff: (step: number, path: string) => string;
  stepReadingFile: (step: number, path: string) => string;
  stepGettingOutline: (step: number, path: string) => string;
  stepFindingReferences: (step: number, target: string) => string;
  stepFetchingRecentCommits: (step: number, count?: number) => string;
  stepSearchingProject: (step: number, keyword: string) => string;
  stepCalling: (step: number, toolName: string) => string;
  stepWritingCommitMessage: (step: number) => string;

  stepAnalyzingMultipleDiffs: (step: number, paths: string) => string;
  stepAnalyzingDiffsForCount: (step: number, count: number) => string;
  stepReadingMultipleFiles: (step: number, paths: string) => string;
  stepReadingFilesForCount: (step: number, count: number) => string;
  stepGettingMultipleOutlines: (step: number, paths: string) => string;
  stepGettingOutlinesForCount: (step: number, count: number) => string;
  stepFindingReferencesForMultiple: (step: number, targets: string) => string;
  stepFindingReferencesForCount: (step: number, count: number) => string;
  stepSearchingProjectForMultiple: (step: number, keywords: string) => string;
  stepSearchingProjectForCount: (step: number, count: number) => string;
  stepExecutingMultipleTools: (step: number, count: number) => string;
}

export interface AgentToolPromptBundle {
  pathArgument: string;
  startLineArgument: string;
  endLineArgument: string;
  lineArgument: string;
  characterArgument: string;
  includeDeclarationArgument: string;
  countArgument: string;
  queryArgument: string;
  caseSensitiveArgument: string;
  maxResultsArgument: string;
  messageArgument: string;
}

export interface OllamaProtocolPromptBundle {
  instructions: string;
  protocolError: string;
  correction: string;
  ordinaryTextError: string;
  finalReminder: string;
}

export interface LocalePromptBundle {
  agentTools: AgentToolPromptBundle;
  ollamaProtocol: OllamaProtocolPromptBundle;
  commitLanguagePrompt: string;
  systemPromptIntroNoTools: string;
  systemPromptIntroWithTools: string;
  promptInjectionTitle: string;
  promptInjectionBodyNoTools: string;
  promptInjectionBodyWithTools: string;
  workflowTitle: string;
  workflowNoToolsReviewDiff: string;
  workflowNoToolsClassify: string;
  workflowNoToolsScopeMandatory: string;
  workflowNoToolsScopeForbidden: string;
  workflowNoToolsOutputOnly: string;
  workflowWithToolsInvestigate: string;
  workflowWithToolsMaxSteps: string;
  workflowWithToolsRecentCommits: string;
  workflowWithToolsClassify: string;
  workflowWithToolsScopeMandatory: string;
  workflowWithToolsScopeForbidden: string;
  workflowWithToolsSubmit: string;
  limitedInfoTitle: string;
  limitedInfoBody: string;
  availableToolsTitle: string;
  availableToolsIntro: string;
  availableToolsNotLimited: string;
  toolDescGetDiff: string;
  toolDescReadFile: string;
  toolDescGetFileOutline: string;
  toolDescFindReferences: string;
  toolDescGetRecentCommits: string;
  toolDescSearchCode: string;
  toolDescWriteCommitMessage: string;
  toolUseReadFile: string;
  toolUseGetFileOutline: string;
  toolUseFindReferences: string;
  toolUseGetRecentCommits: string;
  toolUseSearchCode: string;
  toolUseCombine: string;
  toolUseSubmit: string;
  classificationRulesTitle: string;
  classificationRulesIntro: string;
  classificationRulesTableHeader: string;
  classificationRulesTableDivider: string;
  classificationRulesDocsRule: string;
  classificationRulesTestRule: string;
  classificationRulesCiRule: string;
  classificationRulesBuildRule: string;
  classificationRulesFeatRule: string;
  classificationRulesFixSecurityRule: string;
  classificationRulesFixBugRule: string;
  classificationRulesPerfRule: string;
  classificationRulesStyleRule: string;
  classificationRulesRefactorRule: string;
  classificationRulesChoreRule: string;
  criticalDistinctionsTitle: string;
  criticalDistinctionsChoreVsRefactor: string;
  criticalDistinctionsChoreVsStyle: string;
  criticalDistinctionsFeatVsRefactor: string;
  criticalDistinctionsSecurityFixes: string;
  gitmojiGuideTitle: string;
  gitmojiGuideIntro: string;
  gitmojiTableHeader: string;
  gitmojiTableDivider: string;
  gitmojiUseFeat: string;
  gitmojiUseFix: string;
  gitmojiUseHotfix: string;
  gitmojiUseSecurity: string;
  gitmojiUseDocs: string;
  gitmojiUseUiStyle: string;
  gitmojiUseCodeStyle: string;
  gitmojiUseRefactor: string;
  gitmojiUsePerf: string;
  gitmojiUseTest: string;
  gitmojiUseBuild: string;
  gitmojiUseDependency: string;
  gitmojiUseCi: string;
  gitmojiUseChore: string;
  gitmojiUseRevert: string;
  outputFormatRulesTitle: string;
  outputFormatStrictRulesTitle: string;
  outputFormatRequiredLayoutTitle: string;
  outputFormatCriticalConstraintTitle: string;
  outputFormatCriticalConstraintBody: string;
  outputFormatNoAnalysis: string;
  outputFormatNoBulletPoints: string;
  outputFormatNoPrecede: string;
  outputFormatNoFollow: string;
  outputFormatFirstCharGitmoji: string;
  outputFormatFirstCharCommitType: string;
  outputFormatParseable: string;
  outputFormatViolatingRule: string;
  ruleScopeMandatory: string;
  ruleScopeForbidden: string;
  ruleBodyAndFooterMandatory: string;
  ruleBodyMandatoryFooterForbidden: string;
  ruleBodyForbiddenFooterMandatory: string;
  ruleBodyAndFooterForbidden: string;
  ruleGitmojiMandatory: string;
  ruleEmojisForbidden: string;
  ruleStrictRuleFirstLineCommitType: string;
  ruleStrictRuleFirstLineGitmoji: string;
  ruleStrictRuleMaxChars: string;
  ruleStrictRuleNoMarkdownCodeBlocks: string;
  layoutExplanatoryText: string;
  reminderEntireOutputMessage: string;
  reminderFirstLineFormat: string;
  reminderScopeMandatory: string;
  reminderScopeForbidden: string;
  reminderBodyMandatory: string;
  reminderBodyForbidden: string;
  reminderFooterMandatory: string;
  reminderFooterForbidden: string;
  reminderGitmojiMandatory: string;
  reminderEmojisForbidden: string;
  reminderNoAnalysis: string;
  reminderExhaustedSteps: string;
  reminderFinalToolRequired: string;
  contextStagedChangesSummary: string;
  contextUnstagedChangesSummary: string;
  contextModifiedFilesIntro: string;
  contextProjectStructureHeader: string;
  contextCommitHistoryHeader: string;
  contextDraftCommitMessageHeader: string;
  contextDraftCommitMessageWarning: string;
  contextEndGivenDiffNoTools: string;
  contextEndGivenNoDiffWithTools: string;
  historyCannotDetermine: string;
  historyNoCommitsYet: string;
  historyHasCommitsSingular: string;
  historyHasCommitsPlural: string;
  directDiffPromptPrefix: string;
  ollamaFullDiffHeading: string;
  projectStructureTruncated: string;
}

export interface LocaleTextBundle {
  errorMessages: Record<number, ErrorInfo>;
  commitCopilotErrorMessages: CommitCopilotErrorMessages;
  extensionText: ExtensionText;
  mainViewText: MainViewText;
  webviewLanguagePack: WebviewLanguagePack;
  progressMessages: ProgressMessages;
}
