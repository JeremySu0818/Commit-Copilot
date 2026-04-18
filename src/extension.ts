import * as vscode from 'vscode';

import {
  forcePushWithLease,
  generateCommitMessage,
  generateHistoricalCommitMessage,
  listRecentCommitsForRewrite,
  rewriteHistoricalCommitMessage,
  EXIT_CODES,
  CommitCopilotError,
  GitRepository,
  RewriteCommitEntry,
} from './commit-copilot';
import {
  DISPLAY_LANGUAGE_STATE_KEY,
  getExtensionText,
  getLocalizedErrorInfo,
  getModelNameRequiredText,
  normalizeDisplayLanguage,
  resolveEffectiveDisplayLanguage,
} from './i18n';
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
import { SidePanelProvider } from './side-panel-provider';
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
const rewriteCommitPickLimit = 100;
const pushWithLeaseCommandId = 'git.pushForceWithLease';
const pushWithLeaseConfirmAction = 'Push with Lease';

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

function isCommandUnavailableError(error: unknown, commandId: string): boolean {
  const message = (error instanceof Error ? error.message : String(error))
    .trim()
    .toLowerCase();
  const normalizedCommandId = commandId.toLowerCase();
  return (
    message.includes(normalizedCommandId) &&
    (message.includes('not found') ||
      message.includes('not available') ||
      message.includes('command') ||
      message.includes('unknown'))
  );
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
  currentProvider: APIProvider;
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

function toRewriteCommitItemLabel(entry: RewriteCommitEntry): string {
  const subject = entry.subject.trim();
  const renderedSubject = subject.length > 0 ? subject : '(no subject)';
  return `${entry.shortHash} ${renderedSubject}`;
}

function toRewriteCommitDescription(entry: RewriteCommitEntry): string {
  if (entry.parentHashes.length === 0) {
    return 'root commit';
  }
  if (entry.parentHashes.length > 1) {
    return 'merge commit';
  }
  return `parent ${entry.parentHashes[0].slice(0, rewriteCommitParentHashDisplayLength)}`;
}

async function selectRewriteCommit(
  repository: GitRepository,
): Promise<RewriteCommitEntry | null> {
  const commits = await listRecentCommitsForRewrite(
    repository,
    rewriteCommitPickLimit,
  );
  const candidates = commits.filter((entry) => entry.parentHashes.length <= 1);
  if (candidates.length === 0) {
    vscode.window.showWarningMessage(
      'No non-merge commits found in current branch history.',
    );
    return null;
  }

  const pickItems = candidates.map((entry) => ({
    label: toRewriteCommitItemLabel(entry),
    description: toRewriteCommitDescription(entry),
    entry,
  }));

  const selection = await vscode.window.showQuickPick(pickItems, {
    title: 'Select Commit to Rewrite',
    placeHolder: 'Choose a commit from current branch history',
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
      currentProvider: currentProviderRaw as APIProvider,
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
    currentProvider: 'openai',
    isCustom: true,
    customProviderConfig,
    customProviderId,
  };
}

function resolveGenerateMode(
  context: vscode.ExtensionContext,
  currentProvider: APIProvider,
  requestedGenerateMode: GenerateMode | undefined,
): GenerateMode {
  const savedGenerateMode =
    context.globalState.get<GenerateMode>('GENERATE_MODE') ??
    DEFAULT_GENERATE_MODE;
  if (currentProvider === 'ollama') {
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
  return context.secrets.get(
    API_KEY_STORAGE_KEYS[providerContext.currentProvider],
  );
}

function getProviderDisplayName(
  providerContext: ResolvedProviderContext,
): string {
  if (providerContext.isCustom && providerContext.customProviderConfig) {
    return providerContext.customProviderConfig.name;
  }
  return PROVIDER_DISPLAY_NAMES[providerContext.currentProvider];
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
    `${providerContext.currentProvider.toUpperCase()}_MODEL`,
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
  if (apiKey || providerContext.currentProvider === 'ollama') {
    return true;
  }

  outputChannel.appendLine(
    text.output.missingApiKeyWarning(providerContext.currentProvider),
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
    provider: args.providerContext.currentProvider,
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
      : providerConsoleUrls[args.providerContext.currentProvider];
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
  if (isApiKeyExitCode(error.exitCode)) {
    await handleApiKeyError(errorInfo, error.message, args.text);
    return;
  }
  if (error.exitCode === EXIT_CODES.QUOTA_EXCEEDED) {
    await handleQuotaExceededError({
      errorInfo,
      errorMessage: error.message,
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
    `${errorInfo.title}: ${error.message}. ${errorInfo.action ?? ''}`,
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
  sidePanelProvider: SidePanelProvider,
): Promise<void> {
  const language = getCurrentLanguage(context);
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
      `[${new Date().toISOString()}] Starting commit-copilot rewrite generation...`,
    );

    const api = getGitApi(outputChannel, text);
    if (!api) {
      return;
    }

    const repositoryResult = resolveTargetRepository(
      api,
      undefined,
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

    const targetCommit = await selectRewriteCommit(repositoryResult.repository);
    if (!targetCommit) {
      return;
    }

    const providerContext = resolveProviderContext(context);
    const currentGenerateMode = resolveGenerateMode(
      context,
      providerContext.currentProvider,
      'agentic',
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

    let generatedMessage = '';
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Rewrite (${providerDisplayName})`,
        cancellable: true,
      },
      async (progress, progressToken) => {
        const cancelSubscription = progressToken.onCancellationRequested(() => {
          outputChannel.appendLine(
            '[Rewrite] Cancellation requested from progress UI.',
          );
          cancellationSource.cancel();
        });
        try {
          progress.report({
            message: `Analyzing commit ${targetCommit.shortHash}...`,
          });
          const rewriteGenerationResult = await generateHistoricalCommitMessage(
            {
              repository: repositoryResult.repository,
              commitHash: targetCommit.hash,
              provider: providerContext.currentProvider,
              apiKey: apiKey ?? '',
              baseUrl: providerContext.customProviderConfig?.baseUrl,
              model: savedModel,
              generateMode: currentGenerateMode,
              commitOutputOptions: currentCommitOutputOptions,
              maxAgentSteps,
              language,
              cancellationToken: cancellationSource.token,
              onProgress: (message, increment) => {
                outputChannel.appendLine(`[Rewrite] ${message}`);
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

    const rewrittenMessage =
      await sidePanelProvider.requestRewriteEditorMessage({
        targetCommitShortHash: targetCommit.shortHash,
        generatedMessage,
        cancellationToken: cancellationSource.token,
      });
    if (typeof rewrittenMessage !== 'string') {
      return;
    }
    if (rewrittenMessage.trim().length === 0) {
      vscode.window.showErrorMessage('Commit message cannot be empty.');
      return;
    }

    const normalizedRewrittenMessage = rewrittenMessage.replace(/\r\n/g, '\n');
    const rewriteApplyResult: RewriteApplyResult =
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Rewriting ${targetCommit.shortHash}`,
          cancellable: false,
        },
        async (progress) => {
          progress.report({ message: 'Rewriting commit history...' });
          return rewriteHistoricalCommitMessage({
            repository: repositoryResult.repository,
            commitHash: targetCommit.hash,
            newMessage: normalizedRewrittenMessage,
          });
        },
      );

    if (!rewriteApplyResult.success) {
      const message =
        rewriteApplyResult.error?.message ??
        'Failed to rewrite commit history.';
      outputChannel.appendLine(`[Rewrite] ${message}`);
      vscode.window.showErrorMessage(message);
      return;
    }

    outputChannel.appendLine(
      `[Rewrite] Commit rewritten: ${targetCommit.hash} -> ${rewriteApplyResult.replacementCommitHash ?? 'updated'}`,
    );
    vscode.window.showInformationMessage(
      `Commit ${targetCommit.shortHash} message rewritten.`,
    );

    await promptAndForcePushWithLease(
      repositoryResult.repository,
      outputChannel,
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

async function promptAndForcePushWithLease(
  repository: GitRepository,
  outputChannel: vscode.OutputChannel,
): Promise<void> {
  const stateRecord = repository.state as unknown;
  const state = isRecord(stateRecord) ? stateRecord : {};
  const headValue = state.HEAD;
  const head = isRecord(headValue) ? headValue : {};
  if (head.detached === true) {
    vscode.window.showWarningMessage(
      'Commit history was rewritten, but force push with lease is unavailable in detached HEAD state.',
    );
    return;
  }

  const pushTargetLabel = getPushTargetLabel(repository);
  const selection = await vscode.window.showWarningMessage(
    `History rewritten. Force push with lease to ${pushTargetLabel}?`,
    { modal: true },
    pushWithLeaseConfirmAction,
  );
  if (selection !== pushWithLeaseConfirmAction) {
    return;
  }

  try {
    try {
      await runForcePushWithLeaseCommand(repository);
    } catch (error) {
      if (!isCommandUnavailableError(error, pushWithLeaseCommandId)) {
        throw error;
      }
      await runForcePushWithLeaseCli(repository);
    }

    const successMessage = `Force push with lease completed: ${pushTargetLabel}.`;
    outputChannel.appendLine(`[Rewrite] ${successMessage}`);
    vscode.window.showInformationMessage(successMessage);
  } catch (error) {
    const rawErrorMessage =
      error instanceof Error ? error.message : String(error);
    const message = `Force push with lease failed: ${rawErrorMessage}`;
    outputChannel.appendLine(`[Rewrite] ${message}`);
    vscode.window.showErrorMessage(message);
  }
}

async function runForcePushWithLeaseCommand(
  repository: GitRepository,
): Promise<void> {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Pushing with lease',
      cancellable: false,
    },
    async () => {
      await vscode.commands.executeCommand(pushWithLeaseCommandId, repository);
    },
  );
}

async function runForcePushWithLeaseCli(
  repository: GitRepository,
): Promise<void> {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Pushing with lease',
      cancellable: false,
    },
    async () => {
      await forcePushWithLease(repository.rootUri.fsPath);
    },
  );
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
    const currentGenerateMode = resolveGenerateMode(
      context,
      providerContext.currentProvider,
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
      providerContext.currentProvider === 'ollama'
        ? 'Ollama'
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

  const provider = new SidePanelProvider(context.extensionUri, context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SidePanelProvider.viewType,
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
