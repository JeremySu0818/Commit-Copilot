import { EXIT_CODES } from '../../errors';
import type { LocaleTextBundle } from '../types';

export const enLocale: LocaleTextBundle = {
  errorMessages: {
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
  extensionText: {
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
  sidePanelText: {
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
  webviewLanguagePack: {
    sections: {
      apiProvider: 'API Provider',
      configuration: 'API Configuration',
      ollamaConfiguration: 'Ollama Configuration',
      model: 'Model',
      generateConfiguration: 'Generate Configuration',
      settings: 'Settings',
      addProvider: 'Add Custom Provider',
      editProvider: 'Edit Custom Provider',
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
      maxAgentSteps: 'Max Agent Steps',
      providerName: 'Provider Name',
      apiBaseUrl: 'API Base URL',
    },
    placeholders: {
      selectProvider: 'Select a provider...',
      selectModel: 'Select a model...',
      selectGenerateMode: 'Select generate mode...',
      enterApiKey: 'Enter your API Key',
      enterGeminiApiKey: 'Enter your Gemini API Key',
      enterOpenAIApiKey: 'Enter your OpenAI API Key',
      enterAnthropicApiKey: 'Enter your Anthropic API Key',
      enterCustomApiKey: 'Enter your API Key',
    },
    buttons: {
      save: 'Save',
      validating: 'Validating...',
      generateCommitMessage: 'Generate Commit Message',
      cancelGenerating: 'Cancel Generating',
      back: 'Back',
      editProvider: 'Edit Provider',
      addProvider: '+ Add Provider...',
      deleteProvider: 'Delete Provider',
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
      providerNameConflict: 'A provider with this name already exists.',
      providerNameRequired: 'Provider name is required.',
      baseUrlRequired: 'API Base URL is required.',
      apiKeyRequired: 'API Key is required.',
      providerSaved: 'Custom provider saved!',
      providerDeleted: 'Custom provider deleted.',
      modelNameRequired: 'Please enter a model name before generating.',
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
      maxAgentStepsDescription: 'Limit agentic tool calls per generation. Enter 0 or leave empty for unlimited.',
      customProviderInfo: 'Custom providers must be <strong>OpenAI-compatible</strong>.<br>The API Base URL should point to a service that implements the OpenAI Chat Completions API.',
    },
    options: {
      agentic: 'Agentic Generate',
      directDiff: 'Direct Diff',
    },
  },
};
