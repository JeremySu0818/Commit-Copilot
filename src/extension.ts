import * as vscode from 'vscode';

import {
  ensureSafeRewritePreflight,
  forcePushWithCurrentLease,
  forcePushWithExplicitLease,
  generateCommitMessage,
  generateHistoricalCommitMessage,
  listRecentCommitsForRewrite,
  readLiveRemoteHeadHash,
  readRemoteTrackingHash,
  readUpstreamRef,
  rewriteHistoricalCommitMessage,
  EXIT_CODES,
  CommitCopilotError,
  GitRepository,
  RewriteCommitEntry,
} from './commit-copilot';
import {
  DISPLAY_LANGUAGE_STATE_KEY,
  getExtensionText,
  getLocalizedCommitCopilotErrorMessage,
  getLocalizedErrorInfo,
  getModelNameRequiredText,
  normalizeDisplayLanguage,
  resolveEffectiveDisplayLanguage,
} from './i18n';
import { MainViewProvider } from './main-view-provider';
import {
  APIProvider,
  API_KEY_STORAGE_KEYS,
  CommitOutputOptions,
  CustomProviderConfig,
  CUSTOM_PROVIDERS_STATE_KEY,
  DEFAULT_COMMIT_OUTPUT_OPTIONS,
  DEFAULT_GENERATE_MODE,
  DEFAULT_PROVIDER,
  GenerateMode,
  MAX_AGENT_STEPS_STATE_KEY,
  PROVIDER_DISPLAY_NAMES,
  isCustomProvider,
  getCustomProviderId,
  getCustomProviderStorageKey,
  normalizeCommitOutputOptions,
  normalizeMaxAgentStepsValue,
} from './models';
import {
  buildManualRewriteRecoveryCommands,
  isCommandUnavailableError,
  isCredentialOrPromptError,
  isLeaseConflictError,
} from './rewrite-git-recovery';
import { GenerationStateManager } from './state';

type GenerateCommandArg =
  | vscode.SourceControl
  | {
      sourceControl?: vscode.SourceControl;
      generateMode?: GenerateMode;
      commitOutputOptions?: CommitOutputOptions;
    };

interface GitApi {
  repositories: GitRepository[];
  getRepository?(uri: vscode.Uri): GitRepository | null;
}

interface GitExtensionExports {
  getAPI(version: 1): GitApi;
}

const generationLogSeparatorWidth = 50;
const rewriteCommitParentHashDisplayLength = 7;
const rewriteLogPrefix = '[Rewrite]';
const pushWithLeaseCommandId = 'git.pushForceWithLease';

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

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function parseCommitOutputOptions(
  value: unknown,
): CommitOutputOptions | undefined {
  if (typeof value === 'undefined') {
    return undefined;
  }
  return normalizeCommitOutputOptions(value);
}

function getCurrentLanguage(context: vscode.ExtensionContext) {
  const displayLanguage = normalizeDisplayLanguage(
    context.globalState.get(DISPLAY_LANGUAGE_STATE_KEY),
  );
  return resolveEffectiveDisplayLanguage(displayLanguage, vscode.env.language);
}

type ExtensionText = ReturnType<typeof getExtensionText>;
type GenerateCommitMessageOptions = Parameters<typeof generateCommitMessage>[0];
type GenerateResult = Awaited<ReturnType<typeof generateCommitMessage>>;
type RewriteGenerateResult = Awaited<
  ReturnType<typeof generateHistoricalCommitMessage>
>;
type RewriteApplyResult = Awaited<
  ReturnType<typeof rewriteHistoricalCommitMessage>
>;
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

function toRewriteCommitItemLabel(
  entry: RewriteCommitEntry,
  text: ExtensionText,
): string {
  const subject = entry.subject.trim();
  const renderedSubject =
    subject.length > 0 ? subject : text.notification.rewriteCommitNoSubject;
  return `${entry.shortHash} ${renderedSubject}`;
}

function toRewriteCommitDescription(
  entry: RewriteCommitEntry,
  text: ExtensionText,
): string {
  if (entry.parentHashes.length === 0) {
    return text.notification.rewriteCommitRootDescription;
  }
  if (entry.parentHashes.length > 1) {
    return text.notification.rewriteCommitMergeDescription;
  }
  return text.notification.rewriteCommitParentDescription(
    entry.parentHashes[0].slice(0, rewriteCommitParentHashDisplayLength),
  );
}

async function selectRewriteCommit(
  repository: GitRepository,
  text: ExtensionText,
): Promise<RewriteCommitEntry | null> {
  const commits = await listRecentCommitsForRewrite(repository);
  const candidates = commits.filter((entry) => entry.parentHashes.length <= 1);
  if (candidates.length === 0) {
    vscode.window.showWarningMessage(
      text.notification.rewriteNoNonMergeCommits,
    );
    return null;
  }

  const pickItems = candidates.map((entry) => ({
    label: toRewriteCommitItemLabel(entry, text),
    description: toRewriteCommitDescription(entry, text),
    entry,
  }));

  const selection = await vscode.window.showQuickPick(pickItems, {
    title: text.notification.rewriteCommitSelectTitle,
    placeHolder: text.notification.rewriteCommitSelectPlaceholder,
    matchOnDescription: true,
  });
  return selection?.entry ?? null;
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
  const customProviders =
    context.globalState.get<CustomProviderConfig[]>(
      CUSTOM_PROVIDERS_STATE_KEY,
    ) ?? [];
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

function resolveGenerateMode(
  context: vscode.ExtensionContext,
  llmProvider: APIProvider,
  requestedGenerateMode: GenerateMode | undefined,
): GenerateMode {
  const savedGenerateMode =
    context.globalState.get<GenerateMode>('GENERATE_MODE') ??
    DEFAULT_GENERATE_MODE;
  if (llmProvider === 'ollama') {
    return 'direct-diff';
  }
  return requestedGenerateMode ?? savedGenerateMode;
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
  savedModel: string | undefined;
  cancellationSource: vscode.CancellationTokenSource;
  language: ReturnType<typeof getCurrentLanguage>;
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
    generateMode: args.currentGenerateMode,
    commitOutputOptions: args.currentCommitOutputOptions,
    maxAgentSteps: args.maxAgentSteps,
    model: args.savedModel,
    onProgress: reportProgress,
    cancellationToken: args.cancellationSource.token,
    language: args.language,
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

async function resolveRewriteGeneratedMessage(args: {
  result: RewriteGenerateResult;
  outputChannel: vscode.OutputChannel;
  text: ExtensionText;
  language: ReturnType<typeof getCurrentLanguage>;
  providerContext: ResolvedProviderContext;
}): Promise<string | null> {
  if (args.result.success && args.result.message) {
    return args.result.message;
  }
  await handleGenerationError({
    result: args.result,
    outputChannel: args.outputChannel,
    text: args.text,
    language: args.language,
    providerContext: args.providerContext,
  });
  return null;
}

async function getRewriteWorkspaceDirtyMessage(
  repository: GitRepository,
  text: ExtensionText,
): Promise<string | null> {
  await repository.status();
  const hasUnstagedChanges = repository.state.workingTreeChanges.length > 0;
  const hasStagedChanges = repository.state.indexChanges.length > 0;

  if (!hasUnstagedChanges && !hasStagedChanges) {
    return null;
  }

  if (hasStagedChanges && hasUnstagedChanges) {
    return text.notification.rewriteWorkspaceDirtyBoth;
  }
  if (hasStagedChanges) {
    return text.notification.rewriteWorkspaceDirtyStaged;
  }
  return text.notification.rewriteWorkspaceDirtyUnstaged;
}

async function resolveRewriteRepositoryOrAbort(args: {
  outputChannel: vscode.OutputChannel;
  text: ExtensionText;
}): Promise<GitRepository | null> {
  const api = getGitApi(args.outputChannel, args.text);
  if (!api) {
    return null;
  }

  const repositoryResult = resolveTargetRepository(
    api,
    undefined,
    args.outputChannel,
    args.text,
  );
  if (repositoryResult.status === 'abort') {
    return null;
  }
  if (repositoryResult.status === 'missing') {
    vscode.window.showErrorMessage(args.text.notification.repoNotFound);
    return null;
  }

  const dirtyWorkspaceMessage = await getRewriteWorkspaceDirtyMessage(
    repositoryResult.repository,
    args.text,
  );
  if (dirtyWorkspaceMessage) {
    args.outputChannel.appendLine(
      `${rewriteLogPrefix} ${dirtyWorkspaceMessage}`,
    );
    vscode.window.showInformationMessage(dirtyWorkspaceMessage);
    return null;
  }

  return repositoryResult.repository;
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
  cancellationSource: vscode.CancellationTokenSource;
  language: ReturnType<typeof getCurrentLanguage>;
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
    savedModel: args.savedModel,
    cancellationSource: args.cancellationSource,
    language: args.language,
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

async function executeRewriteCommand(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
  mainViewProvider: MainViewProvider,
): Promise<void> {
  const language = getCurrentLanguage(context);
  const text = getExtensionText(language);
  if (!GenerationStateManager.tryStart()) {
    outputChannel.appendLine(text.output.generationIgnored);
    return;
  }
  const cancellationSource = new vscode.CancellationTokenSource();
  currentGenerationCancellationSource = cancellationSource;

  try {
    await vscode.commands.executeCommand(
      'setContext',
      'commit-copilot.isGenerating',
      true,
    );

    const providerContext = resolveProviderContext(context);
    const currentGenerateMode = resolveGenerateMode(
      context,
      providerContext.llmProvider,
      undefined,
    );
    const currentCommitOutputOptions = resolveCommitOutputOptions(
      context,
      undefined,
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

    const repository = await resolveRewriteRepositoryOrAbort({
      outputChannel,
      text,
    });
    if (!repository) {
      return;
    }
    const preflightPassed = await ensureRewritePreflightSafety({
      repository,
      outputChannel,
      text,
      language,
    });
    if (!preflightPassed) {
      return;
    }

    outputChannel.appendLine('='.repeat(generationLogSeparatorWidth));
    outputChannel.appendLine(
      text.output.rewriteStart(new Date().toISOString()),
    );

    const targetCommit = await selectRewriteCommit(repository, text);
    if (!targetCommit) {
      return;
    }

    let generatedMessage = '';
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: text.notification.rewriteProgressTitle(providerDisplayName),
        cancellable: true,
      },
      async (progress, progressToken) => {
        const cancelSubscription = progressToken.onCancellationRequested(() => {
          outputChannel.appendLine(
            `${rewriteLogPrefix} ${text.output.rewriteCancelRequestedFromProgress}`,
          );
          cancellationSource.cancel();
        });
        try {
          progress.report({
            message: text.notification.rewriteAnalyzingCommit(
              targetCommit.shortHash,
            ),
          });
          const rewriteGenerationResult = await generateHistoricalCommitMessage(
            {
              repository,
              commitHash: targetCommit.hash,
              provider: providerContext.llmProvider,
              apiKey: apiKey ?? '',
              baseUrl: providerContext.customProviderConfig?.baseUrl,
              model: savedModel,
              generateMode: currentGenerateMode,
              commitOutputOptions: currentCommitOutputOptions,
              maxAgentSteps,
              language,
              cancellationToken: cancellationSource.token,
              onProgress: (message, increment) => {
                outputChannel.appendLine(`${rewriteLogPrefix} ${message}`);
                progress.report({ message, increment });
              },
            },
          );
          if (
            rewriteGenerationResult.error?.exitCode === EXIT_CODES.CANCELLED ||
            cancellationSource.token.isCancellationRequested
          ) {
            return;
          }

          const resolvedMessage = await resolveRewriteGeneratedMessage({
            result: rewriteGenerationResult,
            outputChannel,
            text,
            language,
            providerContext,
          });
          if (resolvedMessage) {
            generatedMessage = resolvedMessage;
          }
        } finally {
          cancelSubscription.dispose();
        }
      },
    );

    if (cancellationSource.token.isCancellationRequested) {
      vscode.window.showInformationMessage(
        text.notification.generationCanceled,
      );
      return;
    }
    if (generatedMessage.trim().length === 0) {
      return;
    }

    const rewrittenMessage = await mainViewProvider.requestRewriteEditorMessage(
      {
        targetCommitShortHash: targetCommit.shortHash,
        generatedMessage,
        cancellationToken: cancellationSource.token,
      },
    );
    if (typeof rewrittenMessage !== 'string') {
      vscode.window.showInformationMessage(text.notification.rewriteCanceled);
      return;
    }
    if (rewrittenMessage.trim().length === 0) {
      vscode.window.showErrorMessage(
        text.notification.commitMessageCannotBeEmpty,
      );
      return;
    }

    const normalizedRewrittenMessage = rewrittenMessage.replace(/\r\n/g, '\n');
    const rewriteApplyResult: RewriteApplyResult =
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: text.notification.rewriteApplyingTitle(targetCommit.shortHash),
          cancellable: false,
        },
        async (progress) => {
          progress.report({
            message: text.notification.rewriteApplyingProgress,
          });
          return rewriteHistoricalCommitMessage({
            repository,
            commitHash: targetCommit.hash,
            newMessage: normalizedRewrittenMessage,
          });
        },
      );

    if (!rewriteApplyResult.success) {
      const rawMessage =
        rewriteApplyResult.error?.message ??
        text.notification.rewriteFailedHistory;
      const message = rewriteApplyResult.error
        ? (getLocalizedCommitCopilotErrorMessage(
            language,
            rewriteApplyResult.error,
          ) ?? text.notification.rewriteFailedHistory)
        : text.notification.rewriteFailedHistory;
      outputChannel.appendLine(`${rewriteLogPrefix} ${rawMessage}`);
      vscode.window.showErrorMessage(message);
      return;
    }

    outputChannel.appendLine(
      `${rewriteLogPrefix} ${text.output.rewriteCommitRewritten(
        targetCommit.hash,
        rewriteApplyResult.replacementCommitHash ?? 'updated',
      )}`,
    );
    vscode.window.showInformationMessage(
      text.notification.rewriteCommitMessageRewritten(targetCommit.shortHash),
    );

    await promptAndForcePushWithLease(
      repository,
      outputChannel,
      text,
      rewriteApplyResult.previousRemoteTrackingHash,
    );
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

async function ensureRewritePreflightSafety(params: {
  repository: GitRepository;
  outputChannel: vscode.OutputChannel;
  text: ExtensionText;
  language: ReturnType<typeof getCurrentLanguage>;
}): Promise<boolean> {
  try {
    await ensureSafeRewritePreflight(params.repository.rootUri.fsPath);
    return true;
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : String(error);
    const localizedMessage =
      error instanceof CommitCopilotError
        ? (getLocalizedCommitCopilotErrorMessage(params.language, error) ??
          rawMessage)
        : rawMessage;
    params.outputChannel.appendLine(`${rewriteLogPrefix} ${rawMessage}`);
    vscode.window.showErrorMessage(localizedMessage);
    return false;
  }
}

function getPushTargetLabel(repository: GitRepository): string {
  const stateRecord = repository.state as unknown;
  const state = isRecord(stateRecord) ? stateRecord : {};
  const headValue = state.HEAD;
  const head = isRecord(headValue) ? headValue : {};
  const upstreamValue = head.upstream;
  const upstream = isRecord(upstreamValue) ? upstreamValue : {};
  const branchName = asString(head.name) ?? '';
  const upstreamRemote = asString(upstream.remote) ?? '';
  const upstreamName = asString(upstream.name) ?? '';
  if (upstreamRemote && upstreamName) {
    return `${upstreamRemote}/${upstreamName}`;
  }
  if (branchName) {
    return branchName;
  }
  return repository.rootUri.fsPath;
}

async function buildLeaseRecoveryCommands(
  repository: GitRepository,
  previousRemoteTrackingHash?: string,
): Promise<string[]> {
  const upstreamRef = await readUpstreamRef(repository.rootUri.fsPath);
  const stateRecord = repository.state as unknown;
  const state = isRecord(stateRecord) ? stateRecord : {};
  const headValue = state.HEAD;
  const head = isRecord(headValue) ? headValue : {};
  const branchName = asString(head.name) ?? '';
  return buildManualRewriteRecoveryCommands({
    upstreamRef,
    branchName,
    previousRemoteTrackingHash,
  });
}

type ForcePushLeaseMode =
  | { kind: 'explicit'; expectedRemoteRefHash?: string }
  | { kind: 'current' };

async function refreshRepositoryStatus(
  repository: GitRepository,
): Promise<void> {
  try {
    await repository.status();
  } catch {
    return;
  }
}

function notifyRewriteForcePushSuccess(params: {
  outputChannel: vscode.OutputChannel;
  text: ExtensionText;
  pushTargetLabel: string;
}): void {
  const successMessage = params.text.notification.rewriteForcePushCompleted(
    params.pushTargetLabel,
  );
  params.outputChannel.appendLine(`${rewriteLogPrefix} ${successMessage}`);
  vscode.window.showInformationMessage(successMessage);
}

async function handleRewriteForcePushFailure(params: {
  repository: GitRepository;
  outputChannel: vscode.OutputChannel;
  text: ExtensionText;
  pushTargetLabel: string;
  rawErrorMessage: string;
  expectedRemoteRefHash?: string;
}): Promise<void> {
  if (
    isLeaseConflictError(params.rawErrorMessage) &&
    (await tryRetryWithCurrentLeaseAfterConfirmedRemoteMatch({
      repository: params.repository,
      outputChannel: params.outputChannel,
      text: params.text,
      expectedRemoteRefHash: params.expectedRemoteRefHash,
    }))
  ) {
    notifyRewriteForcePushSuccess({
      outputChannel: params.outputChannel,
      text: params.text,
      pushTargetLabel: params.pushTargetLabel,
    });
    return;
  }

  const message = params.text.notification.rewriteForcePushFailed(
    params.rawErrorMessage,
  );
  params.outputChannel.appendLine(`${rewriteLogPrefix} ${message}`);
  if (isLeaseConflictError(params.rawErrorMessage)) {
    params.outputChannel.appendLine(
      `${rewriteLogPrefix} ${params.text.output.rewriteLeaseProtectionBlocked}`,
    );
    params.outputChannel.appendLine(
      `${rewriteLogPrefix} ${params.text.output.rewriteSuggestedRecoverySteps}`,
    );
    const commands = await buildLeaseRecoveryCommands(
      params.repository,
      params.expectedRemoteRefHash,
    );
    for (const command of commands) {
      params.outputChannel.appendLine(
        `${rewriteLogPrefix} ${params.text.output.rewriteRecoveryCommand(command)}`,
      );
    }
    params.outputChannel.appendLine(
      `${rewriteLogPrefix} ${params.text.output.rewriteResolveConflictsContinueRebase}`,
    );
  }
  vscode.window.showErrorMessage(message);
}

async function promptAndForcePushWithLease(
  repository: GitRepository,
  outputChannel: vscode.OutputChannel,
  text: ExtensionText,
  expectedRemoteRefHash?: string,
): Promise<void> {
  const stateRecord = repository.state as unknown;
  const state = isRecord(stateRecord) ? stateRecord : {};
  const headValue = state.HEAD;
  const head = isRecord(headValue) ? headValue : {};
  if (head.detached === true) {
    vscode.window.showWarningMessage(
      text.notification.rewriteDetachedHeadPushUnavailable,
    );
    return;
  }

  const pushTargetLabel = getPushTargetLabel(repository);
  const selection = await vscode.window.showWarningMessage(
    text.notification.rewriteForcePushPrompt(pushTargetLabel),
    { modal: true },
    text.notification.pushWithLeaseConfirmAction,
  );
  if (selection !== text.notification.pushWithLeaseConfirmAction) {
    return;
  }

  try {
    await runForcePushWithLeasePreferCli({
      repository,
      outputChannel,
      text,
      leaseMode: { kind: 'explicit', expectedRemoteRefHash },
    });
    notifyRewriteForcePushSuccess({ outputChannel, text, pushTargetLabel });
  } catch (error) {
    const rawErrorMessage =
      error instanceof Error ? error.message : String(error);
    await handleRewriteForcePushFailure({
      repository,
      outputChannel,
      text,
      pushTargetLabel,
      rawErrorMessage,
      expectedRemoteRefHash,
    });
  }
}

async function runForcePushWithLeaseCli(params: {
  repository: GitRepository;
  text: ExtensionText;
  leaseMode: ForcePushLeaseMode;
}): Promise<void> {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: params.text.notification.pushingWithLease,
      cancellable: false,
    },
    async () => {
      if (params.leaseMode.kind === 'explicit') {
        await forcePushWithExplicitLease(
          params.repository.rootUri.fsPath,
          params.leaseMode.expectedRemoteRefHash,
        );
      } else {
        await forcePushWithCurrentLease(params.repository.rootUri.fsPath);
      }
    },
  );
  await refreshRepositoryStatus(params.repository);
}

async function runForcePushWithLeaseCommand(params: {
  repository: GitRepository;
  text: ExtensionText;
}): Promise<void> {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: params.text.notification.pushingWithLease,
      cancellable: false,
    },
    async () => {
      await vscode.commands.executeCommand(
        pushWithLeaseCommandId,
        params.repository,
      );
    },
  );
  await refreshRepositoryStatus(params.repository);
}

async function verifyImplicitLeaseFallbackIsStillSafe(params: {
  repository: GitRepository;
  expectedRemoteRefHash?: string;
}): Promise<boolean> {
  const normalizedExpectedHash = params.expectedRemoteRefHash?.trim() ?? '';
  if (!normalizedExpectedHash) {
    return true;
  }
  const upstreamRef = await readUpstreamRef(params.repository.rootUri.fsPath);
  if (!upstreamRef) {
    return false;
  }
  const currentRemoteTrackingHash = await readRemoteTrackingHash(
    params.repository.rootUri.fsPath,
    upstreamRef,
  );
  return currentRemoteTrackingHash === normalizedExpectedHash;
}

async function tryRetryWithCurrentLeaseAfterConfirmedRemoteMatch(params: {
  repository: GitRepository;
  outputChannel: vscode.OutputChannel;
  text: ExtensionText;
  expectedRemoteRefHash?: string;
}): Promise<boolean> {
  const normalizedExpectedHash = params.expectedRemoteRefHash?.trim() ?? '';
  if (!normalizedExpectedHash) {
    return false;
  }

  const upstreamRef = await readUpstreamRef(params.repository.rootUri.fsPath);
  if (!upstreamRef) {
    return false;
  }

  const liveRemoteHeadHash = await readLiveRemoteHeadHash(
    params.repository.rootUri.fsPath,
    upstreamRef,
  );
  if (liveRemoteHeadHash !== normalizedExpectedHash) {
    return false;
  }

  try {
    await runForcePushWithLeasePreferCli({
      repository: params.repository,
      outputChannel: params.outputChannel,
      text: params.text,
      leaseMode: { kind: 'current' },
    });
    return true;
  } catch {
    return false;
  }
}

async function runForcePushWithLeasePreferCli(params: {
  repository: GitRepository;
  outputChannel: vscode.OutputChannel;
  text: ExtensionText;
  leaseMode: ForcePushLeaseMode;
}): Promise<void> {
  try {
    await runForcePushWithLeaseCli({
      repository: params.repository,
      text: params.text,
      leaseMode: params.leaseMode,
    });
    return;
  } catch (error) {
    const rawErrorMessage =
      error instanceof Error ? error.message : String(error);
    if (!isCredentialOrPromptError(rawErrorMessage)) {
      throw error;
    }

    const fallbackIsSafe =
      params.leaseMode.kind === 'explicit'
        ? await verifyImplicitLeaseFallbackIsStillSafe({
            repository: params.repository,
            expectedRemoteRefHash: params.leaseMode.expectedRemoteRefHash,
          })
        : true;
    if (!fallbackIsSafe) {
      params.outputChannel.appendLine(
        `${rewriteLogPrefix} ${params.text.output.rewriteVscodeFallbackSkippedLeaseChanged}`,
      );
      throw new Error(
        'force-with-lease stale info: remote tracking ref changed before VS Code fallback',
      );
    }

    params.outputChannel.appendLine(
      `${rewriteLogPrefix} ${params.text.output.rewriteCliAuthFailedUsingVscodeFallback}`,
    );
    try {
      await runForcePushWithLeaseCommand({
        repository: params.repository,
        text: params.text,
      });
    } catch (fallbackError) {
      if (isCommandUnavailableError(fallbackError, pushWithLeaseCommandId)) {
        throw error;
      }
      throw fallbackError;
    }
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
  GenerationStateManager.finish();
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
  const text = getExtensionText(language);
  if (!GenerationStateManager.tryStart()) {
    outputChannel.appendLine(text.output.generationIgnored);
    return;
  }

  const cancellationSource = new vscode.CancellationTokenSource();
  currentGenerationCancellationSource = cancellationSource;

  try {
    await vscode.commands.executeCommand(
      'setContext',
      'commit-copilot.isGenerating',
      true,
    );
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
    const currentGenerateMode = resolveGenerateMode(
      context,
      providerContext.llmProvider,
      parsedArg.requestedGenerateMode,
    );
    const currentCommitOutputOptions = resolveCommitOutputOptions(
      context,
      parsedArg.requestedCommitOutputOptions,
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
      providerContext.llmProvider === 'ollama' ? 'Ollama' : providerDisplayName;
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
          cancellationSource,
          language,
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
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      MainViewProvider.viewType,
      provider,
    ),
  );

  const openLanguageSettingsDisposable = vscode.commands.registerCommand(
    'commit-copilot.openLanguageSettings',
    async () => {
      await vscode.commands.executeCommand('commit-copilot.view.focus');
      provider.openLanguageSettingsView();
    },
  );

  const generateDisposable = vscode.commands.registerCommand(
    'commit-copilot.generate',
    async (arg?: GenerateCommandArg) => {
      await executeGenerateCommand(arg, context, outputChannel);
    },
  );

  const rewriteDisposable = vscode.commands.registerCommand(
    'commit-copilot.rewriteCommitMessage',
    async () => {
      await executeRewriteCommand(context, outputChannel, provider);
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

  context.subscriptions.push(openLanguageSettingsDisposable);
  context.subscriptions.push(generateDisposable);
  context.subscriptions.push(rewriteDisposable);
  context.subscriptions.push(cancelDisposable);
}

let currentGenerationCancellationSource: vscode.CancellationTokenSource | null =
  null;

export function deactivate(): void {
  currentGenerationCancellationSource = null;
}
