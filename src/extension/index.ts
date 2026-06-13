import * as vscode from 'vscode';

import { generateCommitMessage } from '../core/orchestrator';
import type { GitRepository } from '../git/types';
import {
  COMMIT_MESSAGE_LANGUAGE_STATE_KEY,
  DEFAULT_COMMIT_MESSAGE_LANGUAGE,
  DISPLAY_LANGUAGE_STATE_KEY,
  getExtensionText,
  getLocalizedCommitCopilotErrorMessage,
  getLocalizedErrorInfo,
  getModelNameRequiredText,
  normalizeDisplayLanguage,
  normalizeCommitMessageLanguage,
  resolveEffectiveDisplayLanguage,
} from '../i18n';
import {
  APIProvider,
  API_KEY_STORAGE_KEYS,
  DEFAULT_PROVIDER,
  PROVIDER_DISPLAY_NAMES,
} from '../llm/provider-registry';
import {
  CUSTOM_PROVIDERS_STATE_KEY,
  CustomProviderConfig,
  getCustomProviderId,
  getCustomProviderStorageKey,
  isCustomProvider,
  normalizeCustomProviders,
} from '../models/custom-provider';
import {
  CommitOutputOptions,
  DEFAULT_COMMIT_OUTPUT_OPTIONS,
  DEFAULT_HYBRID_GENERATION_OPTIONS,
  GenerateMode,
  HybridGenerationOptions,
  HYBRID_GENERATION_OPTIONS_STATE_KEY,
  MAX_AGENT_STEPS_STATE_KEY,
  normalizeCommitOutputOptions,
  normalizeHybridGenerationOptions,
  normalizeMaxAgentStepsValue,
  resolveGenerateMode,
} from '../models/options';
import { CommitCopilotError, EXIT_CODES } from '../shared/errors';
import { GenerationStateManager } from '../shared/state';

import { MainViewProvider } from './webview/main-view-provider';

type GenerateCommandArg =
  | vscode.SourceControl
  | {
      sourceControl?: vscode.SourceControl;
      generateMode?: GenerateMode;
      commitOutputOptions?: CommitOutputOptions;
      hybridGenerationOptions?: HybridGenerationOptions;
    };

interface GitApi {
  repositories: GitRepository[];
  getRepository?(uri: vscode.Uri): GitRepository | null;
}

interface GitExtensionExports {
  getAPI(version: 1): GitApi;
}

const generationLogSeparatorWidth = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isGitExtensionExports(value: unknown): value is GitExtensionExports {
  return isRecord(value) && typeof value.getAPI === 'function';
}

function isSourceControl(value: unknown): value is vscode.SourceControl {
  return (
    typeof value === 'object' &&
    value !== null &&
    'rootUri' in (value as Record<string, unknown>)
  );
}

function parseGenerateMode(value: unknown): GenerateMode | undefined {
  if (value === 'agentic' || value === 'direct-diff') {
    return value;
  }
  return undefined;
}

function parseCommitOutputOptions(
  value: unknown,
): CommitOutputOptions | undefined {
  if (typeof value === 'undefined') {
    return undefined;
  }
  return normalizeCommitOutputOptions(value);
}

function parseHybridGenerationOptions(
  value: unknown,
): HybridGenerationOptions | undefined {
  if (typeof value === 'undefined') {
    return undefined;
  }
  return normalizeHybridGenerationOptions(value);
}

function getCurrentLanguage(context: vscode.ExtensionContext) {
  const displayLanguage = normalizeDisplayLanguage(
    context.globalState.get(DISPLAY_LANGUAGE_STATE_KEY),
  );
  return resolveEffectiveDisplayLanguage(displayLanguage, vscode.env.language);
}

function getCommitMessageLanguage(context: vscode.ExtensionContext) {
  return normalizeCommitMessageLanguage(
    context.globalState.get(
      COMMIT_MESSAGE_LANGUAGE_STATE_KEY,
      DEFAULT_COMMIT_MESSAGE_LANGUAGE,
    ),
  );
}

type ExtensionText = ReturnType<typeof getExtensionText>;
type GenerateCommitMessageOptions = Parameters<typeof generateCommitMessage>[0];
type GenerateResult = Awaited<ReturnType<typeof generateCommitMessage>>;
type GenerateRetryOverrides = Partial<
  Pick<
    GenerateCommitMessageOptions,
    'stageChanges' | 'proceedWithStagedOnly' | 'ignoreUntracked'
  >
>;
type GenerateRequest = (
  overrides: GenerateRetryOverrides,
) => Promise<GenerateResult>;

interface ParsedGenerateCommandArg {
  scm?: vscode.SourceControl;
  requestedGenerateMode?: GenerateMode;
  requestedCommitOutputOptions?: CommitOutputOptions;
  requestedHybridGenerationOptions?: HybridGenerationOptions;
}

type RepositorySelectionResult =
  | { status: 'selected'; repository: GitRepository }
  | { status: 'missing' }
  | { status: 'abort' };

interface ResolvedProviderContext {
  currentProviderRaw: string;
  llmProvider: APIProvider;
  isCustom: boolean;
  customProviderConfig?: CustomProviderConfig;
  customProviderId?: string;
}

const providerConsoleUrls: Record<APIProvider, string> = {
  google: 'https://aistudio.google.com/',
  openai: 'https://platform.openai.com/usage',
  anthropic: 'https://console.anthropic.com/',
  ollama: 'http://127.0.0.1:11434',
  grok: 'https://console.x.ai/',
  groq: 'https://console.groq.com/',
  openrouter: 'https://openrouter.ai/keys',
  deepseek: 'https://platform.deepseek.com/',
  qwen: 'https://dashscope.console.aliyun.com/',
};

function parseGenerateCommandArg(
  arg?: GenerateCommandArg,
): ParsedGenerateCommandArg {
  if (isSourceControl(arg)) {
    return { scm: arg };
  }
  if (!arg || typeof arg !== 'object') {
    return {};
  }
  return {
    scm: isSourceControl(arg.sourceControl) ? arg.sourceControl : undefined,
    requestedGenerateMode: parseGenerateMode(arg.generateMode),
    requestedCommitOutputOptions: parseCommitOutputOptions(
      arg.commitOutputOptions,
    ),
    requestedHybridGenerationOptions: parseHybridGenerationOptions(
      arg.hybridGenerationOptions,
    ),
  };
}

function getGitApi(
  outputChannel: vscode.OutputChannel,
  text: ExtensionText,
): GitApi | null {
  const gitExtensionExports =
    vscode.extensions.getExtension<unknown>('vscode.git')?.exports;
  if (!isGitExtensionExports(gitExtensionExports)) {
    outputChannel.appendLine(text.output.gitExtensionMissing);
    vscode.window.showErrorMessage(text.notification.gitExtensionMissing);
    return null;
  }
  return gitExtensionExports.getAPI(1);
}

function findRepositoryFromScm(
  api: GitApi,
  scm: vscode.SourceControl,
): GitRepository | null {
  const scmUri = scm.rootUri?.toString();
  if (!scmUri) {
    return null;
  }
  return (
    api.repositories.find((repo) => repo.rootUri.toString() === scmUri) ?? null
  );
}

function findRepositoryFromActiveEditor(api: GitApi): {
  repository: GitRepository | null;
  hasActiveEditor: boolean;
} {
  const activeUri = vscode.window.activeTextEditor?.document.uri;
  if (!activeUri) {
    return { repository: null, hasActiveEditor: false };
  }
  if (typeof api.getRepository === 'function') {
    const repository = api.getRepository(activeUri);
    if (repository) {
      return { repository, hasActiveEditor: true };
    }
  }

  const activeUriString = activeUri.toString();
  const repository =
    api.repositories.find((repo) =>
      activeUriString.startsWith(repo.rootUri.toString()),
    ) ?? null;
  return { repository, hasActiveEditor: true };
}

function selectFallbackRepository(
  api: GitApi,
  outputChannel: vscode.OutputChannel,
  text: ExtensionText,
): RepositorySelectionResult {
  if (api.repositories.length === 1) {
    const repository = api.repositories[0];
    outputChannel.appendLine(
      text.output.selectedOnlyRepo(repository.rootUri.fsPath),
    );
    return { status: 'selected', repository };
  }
  if (api.repositories.length > 1) {
    outputChannel.appendLine(
      text.output.multiRepoNotDetermined(api.repositories.length),
    );
    vscode.window.showWarningMessage(text.notification.multiRepoWarning);
    return { status: 'abort' };
  }
  outputChannel.appendLine(text.output.noRepoInApi);
  return { status: 'missing' };
}

function resolveTargetRepository(
  api: GitApi,
  scm: vscode.SourceControl | undefined,
  outputChannel: vscode.OutputChannel,
  text: ExtensionText,
): RepositorySelectionResult {
  if (scm) {
    const repository = findRepositoryFromScm(api, scm);
    if (repository) {
      outputChannel.appendLine(
        text.output.selectedRepoFromScm(repository.rootUri.fsPath),
      );
      return { status: 'selected', repository };
    }
  }

  const fromActiveEditor = findRepositoryFromActiveEditor(api);
  if (fromActiveEditor.repository) {
    outputChannel.appendLine(
      text.output.selectedRepoFromEditor(
        fromActiveEditor.repository.rootUri.fsPath,
      ),
    );
    return { status: 'selected', repository: fromActiveEditor.repository };
  }
  if (fromActiveEditor.hasActiveEditor) {
    outputChannel.appendLine(text.output.noRepoMatchedActiveEditor);
  } else {
    outputChannel.appendLine(text.output.noActiveEditorForRepoSelection);
  }
  return selectFallbackRepository(api, outputChannel, text);
}

function resolveProviderContext(
  context: vscode.ExtensionContext,
): ResolvedProviderContext {
  const currentProviderRaw =
    context.globalState.get<string>('CURRENT_PROVIDER') ?? DEFAULT_PROVIDER;
  if (!isCustomProvider(currentProviderRaw)) {
    return {
      currentProviderRaw,
      llmProvider: currentProviderRaw as APIProvider,
      isCustom: false,
    };
  }

  const customProviderId = getCustomProviderId(currentProviderRaw);
  const customProviders = normalizeCustomProviders(
    context.globalState.get<unknown>(CUSTOM_PROVIDERS_STATE_KEY),
  ).providers;
  const customProviderConfig = customProviders.find(
    (provider) => provider.id === customProviderId,
  );
  return {
    currentProviderRaw,
    llmProvider: 'openai',
    isCustom: true,
    customProviderConfig,
    customProviderId,
  };
}

function resolveRequestedGenerateMode(
  context: vscode.ExtensionContext,
  requestedGenerateMode: GenerateMode | undefined,
): GenerateMode {
  return resolveGenerateMode(
    context.globalState.get<GenerateMode>('GENERATE_MODE'),
    requestedGenerateMode,
  );
}

function resolveCommitOutputOptions(
  context: vscode.ExtensionContext,
  requestedCommitOutputOptions: CommitOutputOptions | undefined,
): CommitOutputOptions {
  const savedCommitOutputOptions = normalizeCommitOutputOptions(
    context.globalState.get<CommitOutputOptions>('COMMIT_OUTPUT_OPTIONS') ??
      DEFAULT_COMMIT_OUTPUT_OPTIONS,
  );
  return requestedCommitOutputOptions ?? savedCommitOutputOptions;
}

function resolveHybridGenerationOptions(
  context: vscode.ExtensionContext,
  requestedHybridGenerationOptions: HybridGenerationOptions | undefined,
): HybridGenerationOptions {
  const savedHybridGenerationOptions = normalizeHybridGenerationOptions(
    context.globalState.get<HybridGenerationOptions>(
      HYBRID_GENERATION_OPTIONS_STATE_KEY,
    ) ?? DEFAULT_HYBRID_GENERATION_OPTIONS,
  );
  return requestedHybridGenerationOptions ?? savedHybridGenerationOptions;
}

function readScmDraftCommitMessage(
  repository: GitRepository,
  hybridGenerationOptions: HybridGenerationOptions,
): string | undefined {
  if (!hybridGenerationOptions.enabled) {
    return undefined;
  }
  const draft = repository.inputBox.value.trim();
  return draft.length > 0 ? draft : undefined;
}

function resolveMaxAgentSteps(
  context: vscode.ExtensionContext,
): number | undefined {
  const savedMaxAgentSteps = normalizeMaxAgentStepsValue(
    context.globalState.get<number | string | null>(MAX_AGENT_STEPS_STATE_KEY),
  );
  return savedMaxAgentSteps > 0 ? savedMaxAgentSteps : undefined;
}

async function resolveProviderApiKey(
  context: vscode.ExtensionContext,
  providerContext: ResolvedProviderContext,
): Promise<string | undefined> {
  if (providerContext.isCustom && providerContext.customProviderId) {
    return context.secrets.get(
      getCustomProviderStorageKey(providerContext.customProviderId),
    );
  }
  return context.secrets.get(API_KEY_STORAGE_KEYS[providerContext.llmProvider]);
}

function getProviderDisplayName(
  providerContext: ResolvedProviderContext,
): string {
  if (providerContext.isCustom && providerContext.customProviderConfig) {
    return providerContext.customProviderConfig.name;
  }
  return PROVIDER_DISPLAY_NAMES[providerContext.llmProvider];
}

function resolveSavedModel(
  context: vscode.ExtensionContext,
  providerContext: ResolvedProviderContext,
): string | undefined {
  if (providerContext.isCustom && providerContext.customProviderId) {
    return context.globalState.get<string>(
      `CUSTOM_${providerContext.customProviderId}_MODEL`,
    );
  }
  return context.globalState.get<string>(
    `${providerContext.llmProvider.toUpperCase()}_MODEL`,
  );
}

function logGenerationConfig(
  outputChannel: vscode.OutputChannel,
  text: ExtensionText,
  providerDisplayName: string,
  currentGenerateMode: GenerateMode,
  currentCommitOutputOptions: CommitOutputOptions,
): void {
  outputChannel.appendLine(text.output.usingProvider(providerDisplayName));
  outputChannel.appendLine(text.output.usingGenerateMode(currentGenerateMode));
  outputChannel.appendLine(
    text.output.usingCommitOutputOptions(
      JSON.stringify(currentCommitOutputOptions),
    ),
  );
}

async function ensureProviderApiKey(
  apiKey: string | undefined,
  providerContext: ResolvedProviderContext,
  providerDisplayName: string,
  text: ExtensionText,
  outputChannel: vscode.OutputChannel,
): Promise<boolean> {
  if (apiKey || providerContext.llmProvider === 'ollama') {
    return true;
  }

  outputChannel.appendLine(
    text.output.missingApiKeyWarning(providerDisplayName),
  );
  const setKeyAction = text.notification.configureApiKeyAction;
  const result = await vscode.window.showWarningMessage(
    text.notification.apiKeyMissing(providerDisplayName),
    setKeyAction,
  );
  if (result === setKeyAction) {
    await vscode.commands.executeCommand('commit-copilot.view.focus');
  }
  return false;
}

async function ensureCustomModelSelection(
  providerContext: ResolvedProviderContext,
  savedModel: string | undefined,
  language: ReturnType<typeof getCurrentLanguage>,
): Promise<boolean> {
  if (!providerContext.isCustom || savedModel) {
    return true;
  }
  vscode.window.showWarningMessage(getModelNameRequiredText(language));
  await vscode.commands.executeCommand('commit-copilot.view.focus');
  return false;
}

function createBaseGenerateOptions(args: {
  repository: GitRepository;
  providerContext: ResolvedProviderContext;
  apiKey: string | undefined;
  currentGenerateMode: GenerateMode;
  currentCommitOutputOptions: CommitOutputOptions;
  maxAgentSteps: number | undefined;
  draftCommitMessage: string | undefined;
  savedModel: string | undefined;
  cancellationSource: vscode.CancellationTokenSource;
  language: ReturnType<typeof getCurrentLanguage>;
  commitMessageLanguage: ReturnType<typeof getCommitMessageLanguage>;
  outputChannel: vscode.OutputChannel;
  progress: vscode.Progress<{ message?: string; increment?: number }>;
}): GenerateCommitMessageOptions {
  const reportProgress = (message: string, increment?: number) => {
    args.outputChannel.appendLine(message);
    args.progress.report({ message, increment });
  };
  return {
    repository: args.repository,
    provider: args.providerContext.llmProvider,
    apiKey: args.apiKey ?? '',
    baseUrl: args.providerContext.customProviderConfig?.baseUrl,
    apiFormat: args.providerContext.customProviderConfig?.apiFormat,
    maxTokens: args.providerContext.customProviderConfig?.maxTokens,
    generateMode: args.currentGenerateMode,
    commitOutputOptions: args.currentCommitOutputOptions,
    maxAgentSteps: args.maxAgentSteps,
    draftCommitMessage: args.draftCommitMessage,
    model: args.savedModel,
    onProgress: reportProgress,
    cancellationToken: args.cancellationSource.token,
    language: args.language,
    commitMessageLanguage: args.commitMessageLanguage,
  };
}

function createGenerateRequest(
  baseOptions: GenerateCommitMessageOptions,
): GenerateRequest {
  return (overrides: GenerateRetryOverrides) =>
    generateCommitMessage({ ...baseOptions, ...overrides });
}

async function resolveMixedChangesResult(
  result: GenerateResult,
  requestGeneration: GenerateRequest,
  text: ExtensionText,
): Promise<GenerateResult | null> {
  if (result.error?.exitCode !== EXIT_CODES.MIXED_CHANGES) {
    return result;
  }
  const selection = await vscode.window.showInformationMessage(
    text.notification.mixedChangesQuestion,
    text.notification.stageAllAndGenerate,
    text.notification.proceedStagedOnly,
    text.notification.cancel,
  );
  if (selection === text.notification.stageAllAndGenerate) {
    return requestGeneration({ stageChanges: true });
  }
  if (selection === text.notification.proceedStagedOnly) {
    return requestGeneration({
      stageChanges: false,
      proceedWithStagedOnly: true,
    });
  }
  return null;
}

async function resolveUntrackedChangesResult(
  result: GenerateResult,
  requestGeneration: GenerateRequest,
  text: ExtensionText,
): Promise<GenerateResult | null> {
  if (result.error?.exitCode === EXIT_CODES.NO_CHANGES_BUT_UNTRACKED) {
    const selection = await vscode.window.showInformationMessage(
      text.notification.noStagedButUntrackedQuestion,
      text.notification.stageAndGenerateAll,
      text.notification.generateTrackedOnly,
    );
    if (selection === text.notification.stageAndGenerateAll) {
      return requestGeneration({ stageChanges: true });
    }
    if (selection === text.notification.generateTrackedOnly) {
      return requestGeneration({ stageChanges: false, ignoreUntracked: true });
    }
    return result;
  }

  if (result.error?.exitCode !== EXIT_CODES.NO_TRACKED_CHANGES_BUT_UNTRACKED) {
    return result;
  }
  const selection = await vscode.window.showInformationMessage(
    text.notification.onlyUntrackedQuestion,
    text.notification.stageAndTrack,
    text.notification.cancel,
  );
  if (selection === text.notification.stageAndTrack) {
    return requestGeneration({ stageChanges: true });
  }
  return null;
}

async function generateWithRetryPrompts(
  requestGeneration: GenerateRequest,
  text: ExtensionText,
): Promise<GenerateResult | null> {
  const initialResult = await requestGeneration({ stageChanges: false });
  const mixedResolved = await resolveMixedChangesResult(
    initialResult,
    requestGeneration,
    text,
  );
  if (!mixedResolved) {
    return null;
  }
  return resolveUntrackedChangesResult(mixedResolved, requestGeneration, text);
}

async function handleApiKeyError(
  errorInfo: ReturnType<typeof getLocalizedErrorInfo>,
  errorMessage: string,
  text: ExtensionText,
): Promise<void> {
  const action = await vscode.window.showErrorMessage(
    `${errorInfo.title}: ${errorMessage}`,
    text.notification.configureApiKeyAction,
  );
  if (action === text.notification.configureApiKeyAction) {
    await vscode.commands.executeCommand('commit-copilot.view.focus');
  }
}

async function handleQuotaExceededError(args: {
  errorInfo: ReturnType<typeof getLocalizedErrorInfo>;
  errorMessage: string;
  text: ExtensionText;
  providerContext: ResolvedProviderContext;
}): Promise<void> {
  const action = await vscode.window.showErrorMessage(
    `${args.errorInfo.title}: ${args.errorMessage}`,
    args.text.notification.viewProviderConsoleAction,
  );
  if (action !== args.text.notification.viewProviderConsoleAction) {
    return;
  }
  const url =
    args.providerContext.isCustom && args.providerContext.customProviderConfig
      ? args.providerContext.customProviderConfig.baseUrl
      : providerConsoleUrls[args.providerContext.llmProvider];
  await vscode.env.openExternal(vscode.Uri.parse(url));
}

function isApiKeyExitCode(exitCode: number): boolean {
  return (
    exitCode === EXIT_CODES.API_KEY_MISSING ||
    exitCode === EXIT_CODES.API_KEY_INVALID
  );
}

function isIgnoredNoChangeExitCode(exitCode: number): boolean {
  return (
    exitCode === EXIT_CODES.NO_CHANGES_BUT_UNTRACKED ||
    exitCode === EXIT_CODES.NO_TRACKED_CHANGES_BUT_UNTRACKED
  );
}

function getUserFacingErrorMessage(
  language: ReturnType<typeof getCurrentLanguage>,
  error: CommitCopilotError,
): string {
  return (
    getLocalizedCommitCopilotErrorMessage(language, error) ?? error.message
  );
}

function getUserFacingErrorNotification(args: {
  language: ReturnType<typeof getCurrentLanguage>;
  error: CommitCopilotError;
  errorInfo: ReturnType<typeof getLocalizedErrorInfo>;
}): string {
  const localizedMessage = getLocalizedCommitCopilotErrorMessage(
    args.language,
    args.error,
  );
  if (localizedMessage) {
    return localizedMessage;
  }
  return `${args.errorInfo.title}: ${args.error.message}. ${
    args.errorInfo.action ?? ''
  }`;
}

async function handleGenerationError(args: {
  result: GenerateResult;
  outputChannel: vscode.OutputChannel;
  text: ExtensionText;
  language: ReturnType<typeof getCurrentLanguage>;
  providerContext: ResolvedProviderContext;
}): Promise<void> {
  if (!args.result.error) {
    return;
  }
  const { error } = args.result;
  args.outputChannel.appendLine(
    args.text.output.generationError(error.errorCode, error.message),
  );
  const errorInfo = getLocalizedErrorInfo(args.language, error.exitCode);
  const userFacingErrorMessage = getUserFacingErrorMessage(
    args.language,
    error,
  );
  if (isApiKeyExitCode(error.exitCode)) {
    await handleApiKeyError(errorInfo, userFacingErrorMessage, args.text);
    return;
  }
  if (error.exitCode === EXIT_CODES.QUOTA_EXCEEDED) {
    await handleQuotaExceededError({
      errorInfo,
      errorMessage: userFacingErrorMessage,
      text: args.text,
      providerContext: args.providerContext,
    });
    return;
  }
  if (error.exitCode === EXIT_CODES.NO_CHANGES) {
    vscode.window.showInformationMessage(args.text.notification.noChanges);
    return;
  }
  if (isIgnoredNoChangeExitCode(error.exitCode)) {
    return;
  }
  vscode.window.showErrorMessage(
    getUserFacingErrorNotification({
      language: args.language,
      error,
      errorInfo,
    }),
  );
}

async function applyGenerationResult(args: {
  result: GenerateResult;
  repository: GitRepository;
  outputChannel: vscode.OutputChannel;
  text: ExtensionText;
  language: ReturnType<typeof getCurrentLanguage>;
  providerContext: ResolvedProviderContext;
}): Promise<void> {
  if (args.result.success && args.result.message) {
    args.outputChannel.appendLine(
      args.text.output.generatedMessage(args.result.message),
    );
    args.repository.inputBox.value = args.result.message;
    await vscode.commands.executeCommand('workbench.view.scm');
    vscode.window.showInformationMessage(
      args.text.notification.commitGenerated,
    );
    return;
  }
  await handleGenerationError({
    result: args.result,
    outputChannel: args.outputChannel,
    text: args.text,
    language: args.language,
    providerContext: args.providerContext,
  });
}

async function runGenerationProgress(args: {
  progress: vscode.Progress<{ message?: string; increment?: number }>;
  progressToken: vscode.CancellationToken;
  outputChannel: vscode.OutputChannel;
  text: ExtensionText;
  repository: GitRepository;
  savedModel: string | undefined;
  providerContext: ResolvedProviderContext;
  apiKey: string | undefined;
  currentGenerateMode: GenerateMode;
  currentCommitOutputOptions: CommitOutputOptions;
  maxAgentSteps: number | undefined;
  draftCommitMessage: string | undefined;
  cancellationSource: vscode.CancellationTokenSource;
  language: ReturnType<typeof getCurrentLanguage>;
  commitMessageLanguage: ReturnType<typeof getCommitMessageLanguage>;
}): Promise<void> {
  const cancelSubscription = args.progressToken.onCancellationRequested(() => {
    args.outputChannel.appendLine(args.text.output.cancelRequestedFromProgress);
    args.cancellationSource.cancel();
  });

  args.outputChannel.appendLine(args.text.output.callingGenerateCommitMessage);
  args.outputChannel.appendLine(
    args.text.output.repositoryPath(args.repository.rootUri.fsPath),
  );
  if (args.savedModel) {
    args.outputChannel.appendLine(args.text.output.usingModel(args.savedModel));
  }

  const baseOptions = createBaseGenerateOptions({
    repository: args.repository,
    providerContext: args.providerContext,
    apiKey: args.apiKey,
    currentGenerateMode: args.currentGenerateMode,
    currentCommitOutputOptions: args.currentCommitOutputOptions,
    maxAgentSteps: args.maxAgentSteps,
    draftCommitMessage: args.draftCommitMessage,
    savedModel: args.savedModel,
    cancellationSource: args.cancellationSource,
    language: args.language,
    commitMessageLanguage: args.commitMessageLanguage,
    outputChannel: args.outputChannel,
    progress: args.progress,
  });
  const requestGeneration = createGenerateRequest(baseOptions);

  try {
    const result = await generateWithRetryPrompts(requestGeneration, args.text);
    if (!result || result.error?.exitCode === EXIT_CODES.CANCELLED) {
      return;
    }
    await applyGenerationResult({
      result,
      repository: args.repository,
      outputChannel: args.outputChannel,
      text: args.text,
      language: args.language,
      providerContext: args.providerContext,
    });
  } finally {
    cancelSubscription.dispose();
  }
}

function handleUnexpectedGenerationError(args: {
  error: unknown;
  cancellationSource: vscode.CancellationTokenSource;
  text: ExtensionText;
  outputChannel: vscode.OutputChannel;
}): void {
  const isCancellationError =
    args.error instanceof CommitCopilotError &&
    args.error.exitCode === EXIT_CODES.CANCELLED;
  if (
    isCancellationError ||
    args.cancellationSource.token.isCancellationRequested
  ) {
    vscode.window.showInformationMessage(
      args.text.notification.generationCanceled,
    );
    return;
  }
  const errorMessage =
    args.error instanceof Error ? args.error.message : String(args.error);
  args.outputChannel.appendLine(args.text.output.unexpectedError(errorMessage));
  vscode.window.showErrorMessage(
    `${args.text.notification.failedPrefix}: ${errorMessage}`,
  );
}

async function finalizeGeneration(
  cancellationSource: vscode.CancellationTokenSource,
): Promise<void> {
  if (currentGenerationCancellationSource === cancellationSource) {
    currentGenerationCancellationSource = null;
  }
  cancellationSource.dispose();
  GenerationStateManager.setGenerating(false);
  await vscode.commands.executeCommand(
    'setContext',
    'commit-copilot.isGenerating',
    false,
  );
}

async function executeGenerateCommand(
  arg: GenerateCommandArg | undefined,
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
): Promise<void> {
  const language = getCurrentLanguage(context);
  const commitMessageLanguage = getCommitMessageLanguage(context);
  const text = getExtensionText(language);
  if (GenerationStateManager.isGenerating) {
    outputChannel.appendLine(text.output.generationIgnored);
    return;
  }

  const cancellationSource = new vscode.CancellationTokenSource();
  currentGenerationCancellationSource = cancellationSource;
  GenerationStateManager.setGenerating(true);
  await vscode.commands.executeCommand(
    'setContext',
    'commit-copilot.isGenerating',
    true,
  );

  try {
    outputChannel.appendLine('='.repeat(generationLogSeparatorWidth));
    outputChannel.appendLine(
      text.output.generationStart(new Date().toISOString()),
    );

    const parsedArg = parseGenerateCommandArg(arg);
    const api = getGitApi(outputChannel, text);
    if (!api) {
      return;
    }

    const repositoryResult = resolveTargetRepository(
      api,
      parsedArg.scm,
      outputChannel,
      text,
    );
    if (repositoryResult.status === 'abort') {
      return;
    }
    if (repositoryResult.status === 'missing') {
      vscode.window.showErrorMessage(text.notification.repoNotFound);
      return;
    }

    const providerContext = resolveProviderContext(context);
    const currentGenerateMode = resolveRequestedGenerateMode(
      context,
      parsedArg.requestedGenerateMode,
    );
    const currentCommitOutputOptions = resolveCommitOutputOptions(
      context,
      parsedArg.requestedCommitOutputOptions,
    );
    const currentHybridGenerationOptions = resolveHybridGenerationOptions(
      context,
      parsedArg.requestedHybridGenerationOptions,
    );
    const draftCommitMessage = readScmDraftCommitMessage(
      repositoryResult.repository,
      currentHybridGenerationOptions,
    );
    const maxAgentSteps = resolveMaxAgentSteps(context);
    const apiKey = await resolveProviderApiKey(context, providerContext);
    const providerDisplayName = getProviderDisplayName(providerContext);

    logGenerationConfig(
      outputChannel,
      text,
      providerDisplayName,
      currentGenerateMode,
      currentCommitOutputOptions,
    );

    const hasApiKey = await ensureProviderApiKey(
      apiKey,
      providerContext,
      providerDisplayName,
      text,
      outputChannel,
    );
    if (!hasApiKey) {
      return;
    }

    const savedModel = resolveSavedModel(context, providerContext);
    const hasCustomModel = await ensureCustomModelSelection(
      providerContext,
      savedModel,
      language,
    );
    if (!hasCustomModel) {
      return;
    }

    const progressTitle =
      providerContext.llmProvider === 'ollama'
        ? PROVIDER_DISPLAY_NAMES.ollama
        : providerDisplayName;
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: progressTitle,
        cancellable: true,
      },
      (progress, progressToken) =>
        runGenerationProgress({
          progress,
          progressToken,
          outputChannel,
          text,
          repository: repositoryResult.repository,
          savedModel,
          providerContext,
          apiKey,
          currentGenerateMode,
          currentCommitOutputOptions,
          maxAgentSteps,
          draftCommitMessage,
          cancellationSource,
          language,
          commitMessageLanguage,
        }),
    );
    if (cancellationSource.token.isCancellationRequested) {
      vscode.window.showInformationMessage(
        text.notification.generationCanceled,
      );
    }
  } catch (error) {
    handleUnexpectedGenerationError({
      error,
      cancellationSource,
      text,
      outputChannel,
    });
  } finally {
    await finalizeGeneration(cancellationSource);
  }
}

export function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel(
    'Commit-Copilot Debug',
  );
  context.subscriptions.push(outputChannel);

  const provider = new MainViewProvider(context.extensionUri, context);
  void provider.migrateCustomProviders();
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      MainViewProvider.viewType,
      provider,
    ),
  );

  const openSettingsDisposable = vscode.commands.registerCommand(
    'commit-copilot.openSettings',
    async () => {
      await vscode.commands.executeCommand('commit-copilot.view.focus');
      provider.openSettingsView();
    },
  );

  const openGitHubDisposable = vscode.commands.registerCommand(
    'commit-copilot.openGitHub',
    async () => {
      await vscode.env.openExternal(
        vscode.Uri.parse('https://github.com/JeremySu0818/Commit-Copilot'),
      );
    },
  );

  const generateDisposable = vscode.commands.registerCommand(
    'commit-copilot.generate',
    async (arg?: GenerateCommandArg) => {
      await executeGenerateCommand(arg, context, outputChannel);
    },
  );

  const cancelDisposable = vscode.commands.registerCommand(
    'commit-copilot.cancelGeneration',
    () => {
      if (currentGenerationCancellationSource) {
        currentGenerationCancellationSource.cancel();
      }
    },
  );

  const openAboutDisposable = vscode.commands.registerCommand(
    'commit-copilot.openAbout',
    async () => {
      await vscode.commands.executeCommand('commit-copilot.view.focus');
      provider.openAboutView();
    },
  );

  context.subscriptions.push(openSettingsDisposable);
  context.subscriptions.push(openGitHubDisposable);
  context.subscriptions.push(openAboutDisposable);
  context.subscriptions.push(generateDisposable);
  context.subscriptions.push(cancelDisposable);

  // Version check & Update notes flow
  const lastVersionKey = 'LAST_VERSION';
  const updateInfoShownKey = 'UPDATE_INFO_SHOWN';

  const packageJson = context.extension.packageJSON as Record<string, unknown>;
  const currentVersion =
    typeof packageJson.version === 'string' ? packageJson.version : '';
  const lastVersion = context.globalState.get<string>(lastVersionKey);

  const semverGt = (v1: string, v2: string): boolean => {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return true;
      if (p1 < p2) return false;
    }
    return false;
  };

  if (!lastVersion || semverGt(currentVersion, lastVersion)) {
    void context.globalState.update(lastVersionKey, currentVersion);
    void context.globalState.update(updateInfoShownKey, false);
  }

  const updateInfoShown =
    context.globalState.get<boolean>(updateInfoShownKey) ?? false;
  if (!updateInfoShown) {
    void provider.showUpdateInfo().then(() => {
      void context.globalState.update(updateInfoShownKey, true);
    });
  }
}

let currentGenerationCancellationSource: vscode.CancellationTokenSource | null =
  null;

export function deactivate(): void {
  currentGenerationCancellationSource = null;
}
