import { randomBytes } from 'crypto';

import * as vscode from 'vscode';

import {
  COMMIT_MESSAGE_LANGUAGE_OPTIONS,
  COMMIT_MESSAGE_LANGUAGE_STATE_KEY,
  DEFAULT_COMMIT_MESSAGE_LANGUAGE,
  DISPLAY_LANGUAGE_OPTIONS,
  DISPLAY_LANGUAGE_STATE_KEY,
  DisplayLanguage,
  EffectiveDisplayLanguage,
  WEBVIEW_LANGUAGE_PACKS,
  getDisplayLanguageLabel,
  getMainViewText,
  normalizeDisplayLanguage,
  normalizeCommitMessageLanguage,
  resolveEffectiveDisplayLanguage,
} from './i18n';
import {
  MainViewScreen,
  WebviewBootstrapData,
} from './main-view-webview-bootstrap';
import {
  APIProvider,
  CommitOutputOptions,
  CustomProviderConfig,
  ModelConfig,
  CUSTOM_PROVIDERS_STATE_KEY,
  CUSTOM_PROVIDER_PREFIX,
  DEFAULT_COMMIT_OUTPUT_OPTIONS,
  DEFAULT_GENERATE_MODE,
  DEFAULT_HYBRID_GENERATION_OPTIONS,
  MAX_AGENT_STEPS_STATE_KEY,
  PROVIDER_DISPLAY_NAMES,
  GENERATE_MODE_DISPLAY_NAMES,
  GenerateMode,
  HybridGenerationOptions,
  HYBRID_GENERATION_OPTIONS_STATE_KEY,
  MODELS_BY_PROVIDER,
  DEFAULT_MODELS,
  DEFAULT_PROVIDER,
  API_KEY_STORAGE_KEYS,
  OLLAMA_DEFAULT_HOST,
  fetchOpenRouterModels,
  fetchQwenModels,
  isCustomProvider,
  getCustomProviderId,
  getCustomProviderStorageKey,
  getCustomProviderModelsStorageKey,
  normalizeCommitOutputOptions,
  normalizeHybridGenerationOptions,
  normalizeMaxAgentStepsValue,
  resolveDefaultModel,
} from './models';
import { GenerationStateManager, ValidationStateManager } from './state';

type UnknownRecord = Record<string, unknown>;
type MessageHandler = (message: IncomingMessage) => void | Promise<void>;
type WebviewWarningMessageKey = 'modelNameRequired';
const badRequestStatus = 400;
const unauthorizedStatus = 401;
const forbiddenStatus = 403;
const tooManyRequestsStatus = 429;
const nonceByteLength = 16;
const LEGACY_OLLAMA_BUILTIN_MODEL_IDS = new Set([
  'gemma3:1b',
  'gemma3:4b',
  'gemma3:12b',
  'gemma3:27b',
  'gpt-oss:20b',
  'gpt-oss:120b',
  'llama3.3:8b',
  'llama3.3:70b',
  'phi4:14b',
  'mistral:7b',
]);

interface IncomingMessage extends UnknownRecord {
  type: string;
}

interface GitUpstreamRef {
  remote?: string;
  name?: string;
}

interface GitHeadState {
  name?: string;
  detached?: boolean;
  upstream?: GitUpstreamRef;
}

interface GitRepositoryState {
  workingTreeChanges: unknown[];
  indexChanges: unknown[];
  untrackedChanges: unknown[];
  HEAD?: GitHeadState;
  onDidChange(listener: () => void): vscode.Disposable;
}

interface GitRepository {
  rootUri: vscode.Uri;
  state: GitRepositoryState;
}

interface GitApi {
  repositories: GitRepository[];
  getRepository?(uri: vscode.Uri): GitRepository | null;
  state?: string;
  onDidChangeState?(listener: (state: string) => void): vscode.Disposable;
  onDidOpenRepository?(
    listener: (repo: GitRepository) => void,
  ): vscode.Disposable;
}

interface GitExtensionExports {
  getAPI(version: 1): GitApi;
}

interface OllamaTagsResponse {
  models?: unknown[];
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asMessage(data: unknown): IncomingMessage | null {
  if (!isRecord(data) || typeof data.type !== 'string') {
    return null;
  }
  return data as IncomingMessage;
}

function isGitExtensionExports(value: unknown): value is GitExtensionExports {
  return isRecord(value) && typeof value.getAPI === 'function';
}

function toOllamaModelConfig(value: unknown): ModelConfig | null {
  if (!isRecord(value)) {
    return null;
  }
  const name = asString(value.name);
  const model = asString(value.model);
  const id = name && name.length > 0 ? name : model;
  if (!id || id.length === 0) {
    return null;
  }
  return { id, alias: id };
}

function isAPIProvider(value: string): value is APIProvider {
  return value in API_KEY_STORAGE_KEYS;
}

function toProvider(value: unknown): string {
  return asString(value) ?? DEFAULT_PROVIDER;
}

function toStoredModel(value: unknown): string {
  return asString(value) ?? '';
}

function isWebviewWarningMessageKey(
  value: string | undefined,
): value is WebviewWarningMessageKey {
  return value === 'modelNameRequired';
}

export class MainViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'commit-copilot.view';
  private _view?: vscode.WebviewView;
  private _currentScreen: MainViewScreen = 'main';

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext,
  ) {
    this.updateCurrentScreen('main');
  }

  private updateCurrentScreen(screen: unknown): void {
    const normalizedScreen: MainViewScreen =
      screen === 'settings' || screen === 'addProvider' || screen === 'addModel'
        ? screen
        : 'main';
    this._currentScreen = normalizedScreen;
    void vscode.commands.executeCommand(
      'setContext',
      'commit-copilot.currentScreen',
      normalizedScreen,
    );
  }

  public openLanguageSettingsView() {
    this.updateCurrentScreen('settings');
    if (this._view) {
      this._view.show(true);
      this._view.webview.postMessage({ type: 'openSettingsView' });
    }
  }

  private getCustomProviders(): CustomProviderConfig[] {
    return (
      this._context.globalState.get<CustomProviderConfig[]>(
        CUSTOM_PROVIDERS_STATE_KEY,
      ) ?? []
    );
  }

  private getCustomProviderModelStorageKey(customId: string): string {
    return `CUSTOM_${customId}_MODEL`;
  }

  private getSavedCustomProviderModel(customId: string): string {
    return (
      this._context.globalState.get<string>(
        this.getCustomProviderModelStorageKey(customId),
      ) ?? ''
    );
  }

  private getBuiltInProviderModelStorageKey(provider: APIProvider): string {
    return `${provider.toUpperCase()}_MODEL`;
  }

  private getSavedBuiltInProviderModel(provider: APIProvider): string {
    return (
      this._context.globalState.get<string>(
        this.getBuiltInProviderModelStorageKey(provider),
      ) ?? ''
    );
  }

  private getBuiltInProviderModelsStorageKey(provider: APIProvider): string {
    return `${provider.toUpperCase()}_MODELS`;
  }

  private async getSanitizedOllamaManualModels(): Promise<ModelConfig[]> {
    const storageKey = this.getBuiltInProviderModelsStorageKey('ollama');
    const raw = this._context.globalState.get<unknown>(storageKey);
    const source = Array.isArray(raw) ? raw : [];
    const seenIds = new Set<string>();
    const sanitized: ModelConfig[] = [];

    for (const item of source) {
      if (!isRecord(item)) {
        continue;
      }
      const id = asString(item.id)?.trim();
      if (!id || seenIds.has(id)) {
        continue;
      }
      if (LEGACY_OLLAMA_BUILTIN_MODEL_IDS.has(id)) {
        continue;
      }
      const alias = asString(item.alias)?.trim() ?? id;
      sanitized.push({ id, alias });
      seenIds.add(id);
    }

    if (
      !Array.isArray(raw) ||
      source.length !== sanitized.length ||
      source.some((item, index) => {
        const model = sanitized[index];
        if (!isRecord(item)) {
          return true;
        }
        return item.id !== model.id || item.alias !== model.alias;
      })
    ) {
      await this._context.globalState.update(storageKey, sanitized);
    }

    return sanitized;
  }

  private includeModelIfMissing(
    models: ModelConfig[],
    modelId: string,
  ): ModelConfig[] {
    if (!modelId || models.some((model) => model.id === modelId)) {
      return models;
    }
    return [...models, { id: modelId, alias: modelId }];
  }

  private async saveCustomProviders(
    providers: CustomProviderConfig[],
  ): Promise<void> {
    await this._context.globalState.update(
      CUSTOM_PROVIDERS_STATE_KEY,
      providers,
    );
  }

  private getVSCodeLanguage(): string | undefined {
    const host = vscode as unknown as {
      env?: {
        language?: unknown;
      };
    };
    return asString(host.env?.language);
  }

  private getDisplayLanguage(): DisplayLanguage {
    const context = this._context as unknown as {
      globalState?: {
        get?(key: string): unknown;
      };
    };
    const storedLanguage =
      typeof context.globalState?.get === 'function'
        ? context.globalState.get(DISPLAY_LANGUAGE_STATE_KEY)
        : undefined;
    return normalizeDisplayLanguage(storedLanguage);
  }

  private getEffectiveDisplayLanguage(): EffectiveDisplayLanguage {
    return resolveEffectiveDisplayLanguage(
      this.getDisplayLanguage(),
      this.getVSCodeLanguage(),
    );
  }

  private getCommitMessageLanguage(): EffectiveDisplayLanguage {
    return normalizeCommitMessageLanguage(
      this._context.globalState.get(
        COMMIT_MESSAGE_LANGUAGE_STATE_KEY,
        DEFAULT_COMMIT_MESSAGE_LANGUAGE,
      ),
    );
  }

  private getWebviewLanguagePayload() {
    const displayLanguage = this.getDisplayLanguage();
    const effectiveLanguage = this.getEffectiveDisplayLanguage();
    return {
      displayLanguage,
      effectiveLanguage,
      vscodeLanguage: this.getVSCodeLanguage(),
      languageOptions: DISPLAY_LANGUAGE_OPTIONS,
    };
  }

  private extractValidationError(error: unknown): {
    status?: number;
    message: string;
  } {
    const status =
      typeof error === 'object' && error !== null && 'status' in error
        ? (error as { status?: number }).status
        : undefined;
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? (asString((error as { message?: unknown }).message) ?? '')
        : String(error);
    return { status, message };
  }

  private includesMessage(
    message: string,
    patterns: string[] | undefined,
  ): boolean {
    if (!patterns || patterns.length === 0) {
      return false;
    }
    const normalized = message.toLowerCase();
    return patterns.some((pattern) =>
      normalized.includes(pattern.toLowerCase()),
    );
  }

  private mapProviderValidationError(
    error: unknown,
    rules: {
      invalidStatusCodes: number[];
      invalidMessagePatterns?: string[];
      quotaStatusCodes?: number[];
      quotaMessagePatterns?: string[];
    },
  ): { valid: false; error: string } {
    const { status, message } = this.extractValidationError(error);
    const text = getMainViewText(this.getEffectiveDisplayLanguage());

    const isInvalidKey =
      (typeof status === 'number' &&
        rules.invalidStatusCodes.includes(status)) ||
      this.includesMessage(message, rules.invalidMessagePatterns);
    if (isInvalidKey) {
      return { valid: false, error: text.invalidApiKeyPrefix };
    }

    const quotaStatusCodes = rules.quotaStatusCodes ?? [tooManyRequestsStatus];
    const isQuotaExceeded =
      (typeof status === 'number' && quotaStatusCodes.includes(status)) ||
      this.includesMessage(message, rules.quotaMessagePatterns);
    if (isQuotaExceeded) {
      return { valid: false, error: text.quotaExceededPrefix };
    }

    if (typeof status === 'number') {
      return {
        valid: false,
        error: `${text.apiRequestFailedPrefix} (${String(status)})`,
      };
    }

    return { valid: false, error: text.connectionErrorPrefix };
  }

  private async validateGoogleApiKey(
    apiKey: string,
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const { GoogleGenAI: googleGenAIClientClass } =
        await import('@google/genai');
      const client = new googleGenAIClientClass({ apiKey });

      await client.models.list({ config: { pageSize: 1 } });
      return { valid: true };
    } catch (error) {
      return this.mapProviderValidationError(error, {
        invalidStatusCodes: [
          badRequestStatus,
          unauthorizedStatus,
          forbiddenStatus,
        ],
        invalidMessagePatterns: ['API key not valid', 'PERMISSION_DENIED'],
        quotaMessagePatterns: ['RESOURCE_EXHAUSTED', 'quota'],
      });
    }
  }

  private async validateOpenAIApiKey(
    apiKey: string,
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const openAIClientClass = (await import('openai')).default;
      const client = new openAIClientClass({ apiKey });

      await client.models.list();
      return { valid: true };
    } catch (error) {
      return this.mapProviderValidationError(error, {
        invalidStatusCodes: [unauthorizedStatus, forbiddenStatus],
        invalidMessagePatterns: ['Invalid API Key'],
      });
    }
  }

  private async validateAnthropicApiKey(
    apiKey: string,
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const anthropicClientClass = (await import('@anthropic-ai/sdk')).default;
      const client = new anthropicClientClass({ apiKey });

      await client.models.list({ limit: 1 });
      return { valid: true };
    } catch (error) {
      return this.mapProviderValidationError(error, {
        invalidStatusCodes: [unauthorizedStatus, forbiddenStatus],
        invalidMessagePatterns: ['invalid_api_key'],
        quotaMessagePatterns: ['rate_limit'],
      });
    }
  }

  private async validateOllamaHost(
    host: string,
  ): Promise<{ valid: boolean; error?: string }> {
    const text = getMainViewText(this.getEffectiveDisplayLanguage());
    try {
      const hostUrl = host || OLLAMA_DEFAULT_HOST;
      const response = await fetch(`${hostUrl}/api/tags`, {
        method: 'GET',
      });
      if (response.ok) {
        return { valid: true };
      }
      return {
        valid: false,
        error: text.cannotConnectOllamaAt(hostUrl),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        valid: false,
        error: text.cannotConnectOllama(errorMessage),
      };
    }
  }

  private async validateCustomProviderKey(
    apiKey: string,
    baseUrl: string,
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const openAIClientClass = (await import('openai')).default;
      const client = new openAIClientClass({ apiKey, baseURL: baseUrl });
      await client.models.list();
      return { valid: true };
    } catch (error) {
      return this.mapProviderValidationError(error, {
        invalidStatusCodes: [unauthorizedStatus, forbiddenStatus],
        invalidMessagePatterns: ['Invalid API Key', 'Unauthorized'],
      });
    }
  }

  private async validateOpenRouterApiKey(
    apiKey: string,
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/key', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });
      if (response.ok) {
        return { valid: true };
      }

      let message = '';
      try {
        message = await response.text();
      } catch {
        message = response.statusText;
      }

      return this.mapProviderValidationError(
        { status: response.status, message },
        {
          invalidStatusCodes: [unauthorizedStatus, forbiddenStatus],
          invalidMessagePatterns: ['invalid', 'unauthorized', 'forbidden'],
        },
      );
    } catch (error) {
      return this.mapProviderValidationError(error, {
        invalidStatusCodes: [unauthorizedStatus, forbiddenStatus],
        invalidMessagePatterns: ['invalid', 'unauthorized', 'forbidden'],
      });
    }
  }

  private async validateApiKey(
    provider: APIProvider,
    apiKey: string,
  ): Promise<{ valid: boolean; error?: string }> {
    switch (provider) {
      case 'google':
        return this.validateGoogleApiKey(apiKey);
      case 'openai':
        return this.validateOpenAIApiKey(apiKey);
      case 'anthropic':
        return this.validateAnthropicApiKey(apiKey);
      case 'ollama':
        return this.validateOllamaHost(apiKey);
      case 'grok':
        return this.validateCustomProviderKey(apiKey, 'https://api.x.ai/v1');
      case 'groq':
        return this.validateCustomProviderKey(
          apiKey,
          'https://api.groq.com/openai/v1',
        );
      case 'openrouter':
        return this.validateOpenRouterApiKey(apiKey);
      case 'deepseek':
        return this.validateCustomProviderKey(
          apiKey,
          'https://api.deepseek.com',
        );
      case 'qwen':
        return this.validateCustomProviderKey(
          apiKey,
          'https://dashscope.aliyuncs.com/compatible-mode/v1',
        );
      default:
        return {
          valid: false,
          error: getMainViewText(this.getEffectiveDisplayLanguage())
            .unknownProvider,
        };
    }
  }

  private async fetchCustomProviderModels(
    apiKey: string,
    baseUrl: string | undefined,
    customId: string,
  ): Promise<ModelConfig[]> {
    const customProviders = this.getCustomProviders();
    const cp = customProviders.find((candidate) => candidate.id === customId);
    const resolvedBaseUrl = baseUrl ?? cp?.baseUrl ?? '';

    const manualModels =
      this._context.globalState.get<ModelConfig[]>(
        getCustomProviderModelsStorageKey(customId),
      ) ?? [];

    let apiModels: ModelConfig[] = [];
    try {
      const openAIClientClass = (await import('openai')).default;
      const client = new openAIClientClass({
        apiKey,
        baseURL: resolvedBaseUrl,
      });
      const response = await client.models.list();
      const models: ModelConfig[] = [];
      for await (const model of response) {
        if (model.id) {
          models.push({ id: model.id, alias: model.id });
        }
      }
      models.sort((a, b) => a.id.localeCompare(b.id));
      apiModels = models;
    } catch (error) {
      console.error('Error fetching OpenAI-compatible provider models:', error);
    }

    const allModelIds = new Set(apiModels.map((m) => m.id));
    const merged = [...apiModels];
    for (const manual of manualModels) {
      if (!allModelIds.has(manual.id)) {
        merged.push(manual);
      }
    }
    return merged;
  }

  private async fetchOllamaModels(
    host: string | undefined,
  ): Promise<ModelConfig[]> {
    const manualModels = await this.getSanitizedOllamaManualModels();

    let apiModels: ModelConfig[] = [];
    const resolvedHost =
      host && host.length > 0 ? host.trim() : OLLAMA_DEFAULT_HOST;
    try {
      const response = await fetch(`${resolvedHost}/api/tags`, {
        method: 'GET',
      });
      if (response.ok) {
        const payload = (await response.json()) as OllamaTagsResponse;
        const rawModels = Array.isArray(payload.models) ? payload.models : [];
        const parsedModels = rawModels
          .map(toOllamaModelConfig)
          .filter((model): model is ModelConfig => model !== null)
          .sort((a, b) => a.id.localeCompare(b.id));
        apiModels = parsedModels;
      }
    } catch (error) {
      console.error('Error fetching Ollama models:', error);
    }

    const allModelIds = new Set(apiModels.map((m) => m.id));
    const merged = [...apiModels];
    for (const manual of manualModels) {
      if (!allModelIds.has(manual.id)) {
        merged.push(manual);
      }
    }
    return merged;
  }

  private async getBuiltInProviderModels(
    provider: APIProvider,
    apiKey?: string,
  ): Promise<ModelConfig[]> {
    if (provider === 'openrouter') {
      try {
        return await fetchOpenRouterModels(apiKey);
      } catch {
        return [];
      }
    }
    if (provider === 'qwen') {
      try {
        return await fetchQwenModels(apiKey);
      } catch {
        return [];
      }
    }
    if (provider === 'ollama') {
      return this.fetchOllamaModels(apiKey);
    }
    return MODELS_BY_PROVIDER[provider];
  }

  private includeBuiltInModelIfMissing(
    provider: APIProvider,
    models: ModelConfig[],
    modelId: string,
  ): ModelConfig[] {
    if (provider === 'openrouter' || provider === 'qwen') {
      return models;
    }
    return this.includeModelIfMissing(models, modelId);
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;
    this.updateCurrentScreen(this._currentScreen);
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    let isViewDisposed = false;
    const gitDisposables: vscode.Disposable[] = [];
    const observedRepos = new WeakSet<GitRepository>();

    const addGitDisposable = (disposable: vscode.Disposable | undefined) => {
      if (disposable) {
        gitDisposables.push(disposable);
      }
    };

    const disposeGitDisposables = () => {
      for (const disposable of gitDisposables.splice(0)) {
        try {
          disposable.dispose();
        } catch (error) {
          console.error(
            '[Commit-Copilot] Error disposing git listener:',
            error,
          );
        }
      }
    };

    const onGenerationStateChange = () => {
      this._view?.webview.postMessage({
        type: 'generationStatusUpdate',
        isGenerating: GenerationStateManager.isGenerating,
      });
    };
    GenerationStateManager.addListener(onGenerationStateChange);

    const onValidationStateChange = () => {
      this._view?.webview.postMessage({
        type: 'validationStatusUpdate',
        isValidating: ValidationStateManager.isValidating,
        provider: ValidationStateManager.validatingProvider,
      });
    };
    ValidationStateManager.addListener(onValidationStateChange);

    webviewView.onDidDispose(() => {
      isViewDisposed = true;
      GenerationStateManager.removeListener(onGenerationStateChange);
      ValidationStateManager.removeListener(onValidationStateChange);
      disposeGitDisposables();
      this.updateCurrentScreen('main');
      if (this._view === webviewView) {
        this._view = undefined;
      }
    });

    const getActiveGitApi = (): GitApi | null => {
      const gitExtension =
        vscode.extensions.getExtension<unknown>('vscode.git');
      if (!gitExtension?.isActive) {
        return null;
      }
      if (!isGitExtensionExports(gitExtension.exports)) {
        return null;
      }
      return gitExtension.exports.getAPI(1);
    };

    const selectTargetRepository = (git: GitApi): GitRepository | null => {
      const repos = git.repositories;
      if (repos.length === 0) {
        return null;
      }
      if (repos.length === 1) {
        return repos[0];
      }

      const activeUri = vscode.window.activeTextEditor?.document.uri;
      if (!activeUri) {
        return null;
      }

      if (typeof git.getRepository === 'function') {
        const resolved = git.getRepository(activeUri);
        if (resolved) {
          return resolved;
        }
      }

      const activeUriString = activeUri.toString();
      return (
        repos.find((repo) =>
          activeUriString.startsWith(repo.rootUri.toString()),
        ) ?? null
      );
    };

    const hasRepositoryChanges = (repo: GitRepository | null): boolean => {
      if (!repo) {
        return false;
      }
      return (
        repo.state.workingTreeChanges.length > 0 ||
        repo.state.indexChanges.length > 0 ||
        repo.state.untrackedChanges.length > 0
      );
    };

    const checkGitStatus = () => {
      if (isViewDisposed) {
        return;
      }
      try {
        const git = getActiveGitApi();
        if (!git) {
          return;
        }
        webviewView.webview.postMessage({
          type: 'repoUpdate',
          hasChanges: hasRepositoryChanges(selectTargetRepository(git)),
        });
      } catch (error) {
        console.error('[Commit-Copilot] Error checking git status:', error);
      }
    };

    const attachRepoStateListener = (repo: GitRepository) => {
      if (observedRepos.has(repo)) {
        return;
      }
      observedRepos.add(repo);
      addGitDisposable(
        repo.state.onDidChange(() => {
          checkGitStatus();
        }),
      );
    };

    const setupGitListeners = (git: GitApi) => {
      const setupRepoListeners = () => {
        git.repositories.forEach((repo) => {
          attachRepoStateListener(repo);
        });
        checkGitStatus();
      };

      setupRepoListeners();

      if (git.state !== 'initialized') {
        addGitDisposable(
          git.onDidChangeState?.((state) => {
            if (state === 'initialized') {
              setupRepoListeners();
            }
          }),
        );
      }

      addGitDisposable(
        git.onDidOpenRepository?.((repo) => {
          attachRepoStateListener(repo);
          checkGitStatus();
        }),
      );
    };

    try {
      const gitExtension =
        vscode.extensions.getExtension<unknown>('vscode.git');
      if (
        gitExtension &&
        gitExtension.isActive &&
        isGitExtensionExports(gitExtension.exports)
      ) {
        const git = gitExtension.exports.getAPI(1);
        setupGitListeners(git);
      } else if (gitExtension && !gitExtension.isActive) {
        void (async () => {
          try {
            await gitExtension.activate();
            if (this._view !== webviewView) {
              return;
            }
            if (!isGitExtensionExports(gitExtension.exports)) {
              return;
            }
            const git = gitExtension.exports.getAPI(1);
            setupGitListeners(git);
          } catch (err) {
            console.error(
              '[Commit-Copilot] Failed to activate git extension:',
              err,
            );
          }
        })();
      }
    } catch (error) {
      console.error('[Commit-Copilot] Error setting up git listeners:', error);
    }

    const postValidationResult = (
      provider: string,
      success: boolean,
      extra: Record<string, unknown> = {},
    ) => {
      this._view?.webview.postMessage({
        type: 'validationResult',
        success,
        provider,
        ...extra,
      });
    };

    const handleCustomProviderSaveKey = async (
      provider: string,
      apiKey: string,
      text: ReturnType<typeof getMainViewText>,
    ): Promise<void> => {
      const customId = getCustomProviderId(provider);
      const customProviders = this.getCustomProviders();
      const cp = customProviders.find((candidate) => candidate.id === customId);
      if (!cp) {
        postValidationResult(provider, false, { error: text.unknownProvider });
        return;
      }

      const validationResult = await this.validateCustomProviderKey(
        apiKey,
        cp.baseUrl,
      );
      if (!validationResult.valid) {
        vscode.window.showWarningMessage(
          `${text.validationFailedPrefix}: ${validationResult.error ?? text.unableToConnectFallback}`,
        );
        postValidationResult(provider, false, {
          error: validationResult.error,
        });
        return;
      }

      const storageKey = getCustomProviderStorageKey(customId);
      await this._context.secrets.store(storageKey, apiKey);
      const savedModel = this.getSavedCustomProviderModel(customId);
      const fetchedModels = await this.fetchCustomProviderModels(
        apiKey,
        cp.baseUrl,
        customId,
      );
      vscode.window.showInformationMessage(text.saveConfigSuccess(cp.name));
      postValidationResult(provider, true, {
        models: this.includeModelIfMissing(fetchedModels, savedModel),
        currentModel: savedModel,
      });
      this._view?.webview.postMessage({
        type: 'keyStatus',
        hasKey: true,
        provider,
      });
    };

    const handleBuiltInProviderSaveKey = async (
      provider: string,
      apiKey: string,
      text: ReturnType<typeof getMainViewText>,
    ): Promise<void> => {
      if (!isAPIProvider(provider)) {
        postValidationResult(provider, false, { error: text.unknownProvider });
        return;
      }

      const builtIn = provider;
      let resolvedApiValue = apiKey;
      if (builtIn === 'ollama' && apiKey.length === 0) {
        resolvedApiValue = OLLAMA_DEFAULT_HOST;
      }
      const validationResult = await this.validateApiKey(
        builtIn,
        resolvedApiValue,
      );
      if (!validationResult.valid) {
        vscode.window.showWarningMessage(
          `${text.validationFailedPrefix}: ${validationResult.error ?? text.unableToConnectFallback}`,
        );
        postValidationResult(provider, false, {
          error: validationResult.error,
        });
        return;
      }

      const storageKey = API_KEY_STORAGE_KEYS[builtIn];
      await this._context.secrets.store(storageKey, resolvedApiValue);
      vscode.window.showInformationMessage(
        text.saveConfigSuccess(PROVIDER_DISPLAY_NAMES[builtIn]),
      );
      const savedModel = this.getSavedBuiltInProviderModel(builtIn);
      const models = await this.getBuiltInProviderModels(
        builtIn,
        resolvedApiValue,
      );
      const currentModel = resolveDefaultModel(builtIn, models, savedModel);
      postValidationResult(provider, true, {
        models: this.includeBuiltInModelIfMissing(
          builtIn,
          models,
          currentModel,
        ),
        currentModel,
      });
      this._view?.webview.postMessage({
        type: 'keyStatus',
        hasKey: true,
        provider,
        ...(builtIn === 'ollama' ? { value: resolvedApiValue } : {}),
      });
    };

    const handleSaveKeyMessage = async (
      message: IncomingMessage,
    ): Promise<void> => {
      const text = getMainViewText(this.getEffectiveDisplayLanguage());
      const provider = toProvider(message.provider);
      const apiKey = asString(message.value) ?? '';
      if (!apiKey && provider !== 'ollama') {
        vscode.window.showErrorMessage(text.apiKeyCannotBeEmpty);
        postValidationResult(provider, false);
        return;
      }

      ValidationStateManager.setValidating(true, provider);
      this._view?.webview.postMessage({ type: 'validating', provider });
      try {
        if (isCustomProvider(provider)) {
          await handleCustomProviderSaveKey(provider, apiKey, text);
        } else {
          await handleBuiltInProviderSaveKey(provider, apiKey, text);
        }
      } catch {
        vscode.window.showErrorMessage(text.saveConfigFailed);
        postValidationResult(provider, false);
      } finally {
        ValidationStateManager.setValidating(false, null);
      }
    };

    const parseEditId = (value: unknown): string | null => {
      const editIdRaw = asString(value);
      return editIdRaw && editIdRaw.length > 0 ? editIdRaw : null;
    };

    const createCustomProviderBaseId = (name: string): string => {
      const normalized = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
      return normalized || 'provider';
    };

    const createUniqueCustomProviderId = (
      baseId: string,
      providers: CustomProviderConfig[],
    ): string => {
      const existingIds = new Set(providers.map((cp) => cp.id));
      let uniqueId = baseId;
      let counter = 1;
      while (existingIds.has(uniqueId)) {
        uniqueId = `${baseId}_${String(counter)}`;
        counter += 1;
      }
      return uniqueId;
    };

    const upsertCustomProvider = (
      providers: CustomProviderConfig[],
      payload: { name: string; baseUrl: string; editId: string | null },
    ): string => {
      if (payload.editId) {
        const id = payload.editId;
        const index = providers.findIndex((cp) => cp.id === id);
        if (index >= 0) {
          providers[index] = {
            id,
            name: payload.name,
            baseUrl: payload.baseUrl,
          };
        } else {
          providers.push({ id, name: payload.name, baseUrl: payload.baseUrl });
        }
        return id;
      }

      const baseId = createCustomProviderBaseId(payload.name);
      const id = createUniqueCustomProviderId(baseId, providers);
      providers.push({ id, name: payload.name, baseUrl: payload.baseUrl });
      return id;
    };

    const validateCustomProviderBeforeSave = async (
      payload: { apiKey: string; baseUrl: string; editId: string | null },
      text: ReturnType<typeof getMainViewText>,
    ): Promise<boolean> => {
      if (payload.editId && !payload.apiKey) {
        return true;
      }

      const validationResult = await this.validateCustomProviderKey(
        payload.apiKey,
        payload.baseUrl,
      );
      if (validationResult.valid) {
        return true;
      }
      this._view?.webview.postMessage({
        type: 'customProviderSaveFailed',
        error: validationResult.error ?? text.unableToConnectFallback,
      });
      return false;
    };

    const handleSaveCustomProviderMessage = async (
      message: IncomingMessage,
    ): Promise<void> => {
      const text = getMainViewText(this.getEffectiveDisplayLanguage());
      const customProviders = this.getCustomProviders();
      const payload = {
        name: (asString(message.name) ?? '').trim(),
        baseUrl: (asString(message.baseUrl) ?? '').trim(),
        apiKey: (asString(message.apiKey) ?? '').trim(),
        editId: parseEditId(message.editId),
      };

      if (!payload.editId && !payload.apiKey) {
        this._view?.webview.postMessage({
          type: 'customProviderSaveFailed',
          error: text.apiKeyCannotBeEmpty,
        });
        return;
      }

      const isValid = await validateCustomProviderBeforeSave(payload, text);
      if (!isValid) {
        return;
      }

      const id = upsertCustomProvider(customProviders, payload);

      await this.saveCustomProviders(customProviders);
      if (payload.apiKey) {
        await this._context.secrets.store(
          getCustomProviderStorageKey(id),
          payload.apiKey,
        );
      }

      this._view?.webview.postMessage({
        type: 'customProviderSaved',
        savedId: id,
        customProviders,
      });
    };

    const handleDeleteCustomProviderMessage = async (
      message: IncomingMessage,
    ): Promise<void> => {
      const deleteId = asString(message.id) ?? '';
      const customProviders = this.getCustomProviders().filter(
        (cp) => cp.id !== deleteId,
      );
      await this.saveCustomProviders(customProviders);
      await this._context.secrets.delete(getCustomProviderStorageKey(deleteId));

      const currentProviderValue =
        this._context.globalState.get<string>('CURRENT_PROVIDER');
      if (currentProviderValue === `${CUSTOM_PROVIDER_PREFIX}${deleteId}`) {
        await this._context.globalState.update(
          'CURRENT_PROVIDER',
          DEFAULT_PROVIDER,
        );
      }

      await this._context.globalState.update(
        this.getCustomProviderModelStorageKey(deleteId),
        undefined,
      );
      await this._context.globalState.update(
        getCustomProviderModelsStorageKey(deleteId),
        undefined,
      );
      this._view?.webview.postMessage({
        type: 'customProviderDeleted',
        customProviders,
      });
    };

    const simpleMessageHandlers: Partial<Record<string, MessageHandler>> = {
      generate: async (message) => {
        try {
          const requestedMode =
            message.generateMode === 'direct-diff' ? 'direct-diff' : 'agentic';
          const commitOutputOptions = normalizeCommitOutputOptions(
            message.commitOutputOptions,
          );
          await vscode.commands.executeCommand('commit-copilot.generate', {
            generateMode: requestedMode,
            commitOutputOptions,
            hybridGenerationOptions: normalizeHybridGenerationOptions(
              message.hybridGenerationOptions,
            ),
          });
        } finally {
          this._view?.webview.postMessage({ type: 'generationDone' });
        }
      },
      cancelGenerate: async () => {
        await vscode.commands.executeCommand('commit-copilot.cancelGeneration');
      },
      checkKey: async (message) => {
        const provider = toProvider(message.provider);
        let key: string | undefined;
        if (isCustomProvider(provider)) {
          key = await this._context.secrets.get(
            getCustomProviderStorageKey(getCustomProviderId(provider)),
          );
        } else {
          const builtIn = isAPIProvider(provider) ? provider : DEFAULT_PROVIDER;
          key = await this._context.secrets.get(API_KEY_STORAGE_KEYS[builtIn]);
        }
        const resolvedKey = key && key.length > 0 ? key : OLLAMA_DEFAULT_HOST;
        this._view?.webview.postMessage({
          type: 'keyStatus',
          hasKey: Boolean(key),
          provider,
          ...(provider === 'ollama' ? { value: resolvedKey } : {}),
        });
      },
      checkGit: () => {
        checkGitStatus();
      },
      getModels: async (message) => {
        const provider = toProvider(message.provider);
        if (isCustomProvider(provider)) {
          const customId = getCustomProviderId(provider);
          const key = await this._context.secrets.get(
            getCustomProviderStorageKey(customId),
          );
          if (key) {
            const savedModel = this.getSavedCustomProviderModel(customId);
            const fetchedModels = await this.fetchCustomProviderModels(
              key,
              undefined,
              customId,
            );
            this._view?.webview.postMessage({
              type: 'modelsList',
              models: this.includeModelIfMissing(fetchedModels, savedModel),
              currentModel: savedModel,
              provider,
            });
          }
          return;
        }

        const builtIn = isAPIProvider(provider) ? provider : DEFAULT_PROVIDER;
        const key = await this._context.secrets.get(
          API_KEY_STORAGE_KEYS[builtIn],
        );
        if (key || builtIn === 'ollama') {
          const savedModel = this.getSavedBuiltInProviderModel(builtIn);
          const models = await this.getBuiltInProviderModels(builtIn, key);
          const currentModel = resolveDefaultModel(builtIn, models, savedModel);
          this._view?.webview.postMessage({
            type: 'modelsList',
            models: this.includeBuiltInModelIfMissing(
              builtIn,
              models,
              currentModel,
            ),
            currentModel,
            provider,
          });
        }
      },
      saveModel: async (message) => {
        const provider = toProvider(message.provider);
        const modelValue = toStoredModel(message.value);
        if (isCustomProvider(provider)) {
          await this._context.globalState.update(
            this.getCustomProviderModelStorageKey(
              getCustomProviderId(provider),
            ),
            modelValue,
          );
          return;
        }
        if (isAPIProvider(provider)) {
          await this._context.globalState.update(
            this.getBuiltInProviderModelStorageKey(provider),
            modelValue,
          );
        }
      },
      saveProvider: async (message) => {
        await this._context.globalState.update(
          'CURRENT_PROVIDER',
          toStoredModel(message.value),
        );
      },
      getProvider: () => {
        const savedProvider =
          this._context.globalState.get<APIProvider>('CURRENT_PROVIDER');
        this._view?.webview.postMessage({
          type: 'currentProvider',
          provider: savedProvider ?? DEFAULT_PROVIDER,
        });
      },
      saveGenerateMode: async (message) => {
        const mode: GenerateMode =
          message.value === 'direct-diff' ? 'direct-diff' : 'agentic';
        await this._context.globalState.update('GENERATE_MODE', mode);
      },
      getGenerateMode: () => {
        const savedMode =
          this._context.globalState.get<GenerateMode>('GENERATE_MODE') ??
          DEFAULT_GENERATE_MODE;
        this._view?.webview.postMessage({
          type: 'currentGenerateMode',
          generateMode: savedMode,
        });
      },
      saveCommitOutputOptions: async (message) => {
        await this._context.globalState.update(
          'COMMIT_OUTPUT_OPTIONS',
          normalizeCommitOutputOptions(message.value),
        );
      },
      getCommitOutputOptions: () => {
        const savedOptions = normalizeCommitOutputOptions(
          this._context.globalState.get<CommitOutputOptions>(
            'COMMIT_OUTPUT_OPTIONS',
          ) ?? DEFAULT_COMMIT_OUTPUT_OPTIONS,
        );
        this._view?.webview.postMessage({
          type: 'currentCommitOutputOptions',
          commitOutputOptions: savedOptions,
        });
      },
      saveHybridGenerationOptions: async (message) => {
        await this._context.globalState.update(
          HYBRID_GENERATION_OPTIONS_STATE_KEY,
          normalizeHybridGenerationOptions(message.value),
        );
      },
      getHybridGenerationOptions: () => {
        const savedOptions = normalizeHybridGenerationOptions(
          this._context.globalState.get<HybridGenerationOptions>(
            HYBRID_GENERATION_OPTIONS_STATE_KEY,
          ) ?? DEFAULT_HYBRID_GENERATION_OPTIONS,
        );
        this._view?.webview.postMessage({
          type: 'currentHybridGenerationOptions',
          hybridGenerationOptions: savedOptions,
        });
      },
      getAllKeys: async () => {
        const keyStatuses: Record<string, boolean> = {};
        for (const [provider, storageKey] of Object.entries(
          API_KEY_STORAGE_KEYS,
        )) {
          keyStatuses[provider] = Boolean(
            await this._context.secrets.get(storageKey),
          );
        }
        for (const cp of this.getCustomProviders()) {
          keyStatuses[`${CUSTOM_PROVIDER_PREFIX}${cp.id}`] = Boolean(
            await this._context.secrets.get(getCustomProviderStorageKey(cp.id)),
          );
        }
        this._view?.webview.postMessage({
          type: 'allKeyStatuses',
          statuses: keyStatuses,
        });
      },
      checkGenerationStatus: () => {
        this._view?.webview.postMessage({
          type: 'generationStatusUpdate',
          isGenerating: GenerationStateManager.isGenerating,
        });
      },
      checkValidationStatus: () => {
        this._view?.webview.postMessage({
          type: 'validationStatusUpdate',
          isValidating: ValidationStateManager.isValidating,
          provider: ValidationStateManager.validatingProvider,
        });
      },
      saveDisplayLanguage: async (message) => {
        const nextLanguage = normalizeDisplayLanguage(message.value);
        await this._context.globalState.update(
          DISPLAY_LANGUAGE_STATE_KEY,
          nextLanguage,
        );
        const effectiveLanguage = resolveEffectiveDisplayLanguage(
          nextLanguage,
          this.getVSCodeLanguage(),
        );
        const text = getMainViewText(effectiveLanguage);
        vscode.window.showInformationMessage(
          text.languageSaved(
            getDisplayLanguageLabel(nextLanguage, effectiveLanguage),
          ),
        );
        this._view?.webview.postMessage({
          type: 'displayLanguageUpdated',
          ...this.getWebviewLanguagePayload(),
        });
      },
      saveCommitMessageLanguage: async (message) => {
        const language = normalizeCommitMessageLanguage(message.value);
        await this._context.globalState.update(
          COMMIT_MESSAGE_LANGUAGE_STATE_KEY,
          language,
        );
        const pack = WEBVIEW_LANGUAGE_PACKS[this.getEffectiveDisplayLanguage()];
        vscode.window.showInformationMessage(
          pack.statuses.commitMessageLanguageSaved,
        );
        this._view?.webview.postMessage({
          type: 'commitMessageLanguageUpdated',
          commitMessageLanguage: language,
        });
      },
      getCommitMessageLanguage: () => {
        this._view?.webview.postMessage({
          type: 'commitMessageLanguageUpdated',
          commitMessageLanguage: this.getCommitMessageLanguage(),
        });
      },
      getDisplayLanguage: () => {
        this._view?.webview.postMessage({
          type: 'displayLanguageUpdated',
          ...this.getWebviewLanguagePayload(),
        });
      },
      saveMaxAgentSteps: async (message) => {
        const steps = normalizeMaxAgentStepsValue(message.value);
        await this._context.globalState.update(
          MAX_AGENT_STEPS_STATE_KEY,
          steps > 0 ? steps : null,
        );
      },
      getMaxAgentSteps: () => {
        const steps = normalizeMaxAgentStepsValue(
          this._context.globalState.get<number | string | null>(
            MAX_AGENT_STEPS_STATE_KEY,
          ),
        );
        this._view?.webview.postMessage({
          type: 'currentMaxAgentSteps',
          maxAgentSteps: steps,
        });
      },
      getCustomProviders: () => {
        this._view?.webview.postMessage({
          type: 'customProvidersLoaded',
          customProviders: this.getCustomProviders(),
        });
      },
      showWarning: (message) => {
        const warningKey = asString(message.key);
        if (!isWebviewWarningMessageKey(warningKey)) {
          return;
        }

        const warningMessage =
          WEBVIEW_LANGUAGE_PACKS[this.getEffectiveDisplayLanguage()].statuses[
            warningKey
          ];
        if (warningMessage.length > 0) {
          vscode.window.showWarningMessage(warningMessage);
        }
      },
      setCurrentScreen: (message) => {
        this.updateCurrentScreen(message.value);
      },
      addCustomModel: async (message) => {
        const provider = toProvider(message.provider);
        const customId = isCustomProvider(provider)
          ? getCustomProviderId(provider)
          : null;
        const isOllamaProvider = provider === 'ollama';
        if (!customId && !isOllamaProvider) {
          return;
        }
        const modelName = (asString(message.modelName) ?? '').trim();
        if (!modelName) {
          return;
        }
        const storageKey = customId
          ? getCustomProviderModelsStorageKey(customId)
          : this.getBuiltInProviderModelsStorageKey('ollama');
        const existing = customId
          ? (this._context.globalState.get<{ id: string; alias: string }[]>(
              storageKey,
            ) ?? [])
          : await this.getSanitizedOllamaManualModels();
        if (existing.some((m) => m.id === modelName)) {
          this._view?.webview.postMessage({
            type: 'customModelAddFailed',
            error: 'duplicate',
          });
          return;
        }
        existing.push({ id: modelName, alias: modelName });
        await this._context.globalState.update(storageKey, existing);
        const modelStorageKey = customId
          ? this.getCustomProviderModelStorageKey(customId)
          : this.getBuiltInProviderModelStorageKey('ollama');
        let currentModel = customId
          ? this.getSavedCustomProviderModel(customId)
          : this.getSavedBuiltInProviderModel('ollama');
        if (!currentModel) {
          currentModel = modelName;
          await this._context.globalState.update(modelStorageKey, modelName);
        }

        if (customId) {
          const apiKey = await this._context.secrets.get(
            getCustomProviderStorageKey(customId),
          );
          if (!apiKey) {
            return;
          }
          const models = await this.fetchCustomProviderModels(
            apiKey,
            undefined,
            customId,
          );
          this._view?.webview.postMessage({
            type: 'customModelAdded',
            models: this.includeModelIfMissing(models, currentModel),
            currentModel,
            provider,
            customModels: existing,
          });
          return;
        }

        const host =
          (await this._context.secrets.get(API_KEY_STORAGE_KEYS.ollama)) ??
          OLLAMA_DEFAULT_HOST;
        const models = await this.fetchOllamaModels(host);
        this._view?.webview.postMessage({
          type: 'customModelAdded',
          models: this.includeModelIfMissing(models, currentModel),
          currentModel,
          provider,
          customModels: existing,
        });
      },
      deleteCustomModel: async (message) => {
        const provider = toProvider(message.provider);
        const modelId = (asString(message.modelId) ?? '').trim();
        await this.deleteCustomModelInternal(provider, modelId);
      },
      getCustomModels: async (message) => {
        const provider = toProvider(message.provider);
        const customId = isCustomProvider(provider)
          ? getCustomProviderId(provider)
          : null;
        if (!customId && provider !== 'ollama') {
          return;
        }
        const storageKey = customId
          ? getCustomProviderModelsStorageKey(customId)
          : this.getBuiltInProviderModelsStorageKey('ollama');
        const customModels = customId
          ? (this._context.globalState.get<{ id: string; alias: string }[]>(
              storageKey,
            ) ?? [])
          : await this.getSanitizedOllamaManualModels();
        this._view?.webview.postMessage({
          type: 'customModelsList',
          customModels,
          provider,
        });
      },
    };

    webviewView.webview.onDidReceiveMessage(async (data: unknown) => {
      const message = asMessage(data);
      if (!message) {
        return;
      }

      if (message.type === 'saveKey') {
        await handleSaveKeyMessage(message);
        return;
      }
      if (message.type === 'saveCustomProvider') {
        await handleSaveCustomProviderMessage(message);
        return;
      }
      if (message.type === 'deleteCustomProvider') {
        await handleDeleteCustomProviderMessage(message);
        return;
      }

      const simpleHandler = simpleMessageHandlers[message.type];
      if (typeof simpleHandler === 'function') {
        await simpleHandler(message);
      }
    });
  }

  private getWebviewBootstrapData(): WebviewBootstrapData {
    const languagePayload = this.getWebviewLanguagePayload();
    return {
      providers: PROVIDER_DISPLAY_NAMES,
      generateModes: GENERATE_MODE_DISPLAY_NAMES,
      modelsByProvider: MODELS_BY_PROVIDER,
      defaultModels: DEFAULT_MODELS,
      defaultProvider: DEFAULT_PROVIDER,
      defaultGenerateMode: DEFAULT_GENERATE_MODE,
      defaultCommitOutputOptions: DEFAULT_COMMIT_OUTPUT_OPTIONS,
      defaultHybridGenerationOptions: DEFAULT_HYBRID_GENERATION_OPTIONS,
      ollamaDefaultHost: OLLAMA_DEFAULT_HOST,
      languagePacks: WEBVIEW_LANGUAGE_PACKS,
      initialDisplayLanguage: languagePayload.displayLanguage,
      initialEffectiveLanguage: languagePayload.effectiveLanguage,
      initialVSCodeLanguage: languagePayload.vscodeLanguage,
      displayLanguageOptions: languagePayload.languageOptions,
      initialCommitMessageLanguage: this.getCommitMessageLanguage(),
      commitMessageLanguageOptions: COMMIT_MESSAGE_LANGUAGE_OPTIONS,
      initialScreen: this._currentScreen,
      customProviderPrefix: CUSTOM_PROVIDER_PREFIX,
      customProviders: this.getCustomProviders(),
    };
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = getNonce();
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        'out',
        'webview',
        'main-view.css',
      ),
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'main-view.js'),
    );
    const bootstrap = serializeForInlineScript(this.getWebviewBootstrapData());

    const cspSource = escapeHtmlAttribute(webview.cspSource);
    const escapedNonce = escapeHtmlAttribute(nonce);
    const escapedStyleUri = escapeHtmlAttribute(styleUri.toString());
    const escapedScriptUri = escapeHtmlAttribute(scriptUri.toString());

    const htmlLang = escapeHtmlAttribute(this.getEffectiveDisplayLanguage());

    return `<!doctype html>
<html lang="${htmlLang}">
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src ${cspSource} 'nonce-${escapedNonce}'; script-src 'nonce-${escapedNonce}';"
    />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Commit Copilot</title>
    <link rel="stylesheet" href="${escapedStyleUri}" nonce="${escapedNonce}" />
  </head>
  <body>
    <div id="root"></div>
    <script nonce="${escapedNonce}">
      window.__COMMIT_COPILOT_WEBVIEW_BOOTSTRAP__ = ${bootstrap};
    </script>
    <script nonce="${escapedNonce}" src="${escapedScriptUri}"></script>
  </body>
</html>`;
  }

  private async fetchModelsForProvider(
    provider: string,
    customId: string | null,
  ): Promise<ModelConfig[] | null> {
    if (customId) {
      const apiKey = await this._context.secrets.get(
        getCustomProviderStorageKey(customId),
      );
      if (!apiKey) {
        return null;
      }
      return this.fetchCustomProviderModels(apiKey, undefined, customId);
    }
    const host =
      (await this._context.secrets.get(API_KEY_STORAGE_KEYS.ollama)) ??
      OLLAMA_DEFAULT_HOST;
    return this.fetchOllamaModels(host);
  }

  private async deleteCustomModelInternal(
    provider: string,
    modelId: string,
  ): Promise<void> {
    const customId = isCustomProvider(provider)
      ? getCustomProviderId(provider)
      : null;
    if (!customId && provider !== 'ollama') {
      return;
    }
    if (!modelId) {
      return;
    }

    const storageKey = customId
      ? getCustomProviderModelsStorageKey(customId)
      : this.getBuiltInProviderModelsStorageKey('ollama');

    const existing = customId
      ? (this._context.globalState.get<{ id: string; alias: string }[]>(
          storageKey,
        ) ?? [])
      : await this.getSanitizedOllamaManualModels();

    const filtered = existing.filter((m) => m.id !== modelId);
    await this._context.globalState.update(storageKey, filtered);

    const modelStorageKey = customId
      ? this.getCustomProviderModelStorageKey(customId)
      : this.getBuiltInProviderModelStorageKey('ollama');

    const savedModel = customId
      ? this.getSavedCustomProviderModel(customId)
      : this.getSavedBuiltInProviderModel('ollama');

    const fetchedModels = await this.fetchModelsForProvider(provider, customId);
    if (fetchedModels === null) {
      if (savedModel === modelId) {
        await this._context.globalState.update(modelStorageKey, undefined);
      }
      return;
    }

    const savedModelStillAvailable = fetchedModels.some(
      (model) => model.id === savedModel,
    );
    const currentModel =
      savedModel === modelId && !savedModelStillAvailable ? '' : savedModel;
    if (savedModel && !currentModel) {
      await this._context.globalState.update(modelStorageKey, undefined);
    }

    const models = this.includeModelIfMissing(fetchedModels, currentModel);
    this._view?.webview.postMessage({
      type: 'customModelDeleted',
      models,
      currentModel,
      provider,
      customModels: filtered,
    });
  }
}

function serializeForInlineScript(value: unknown): string {
  const serialized = JSON.stringify(value);
  const safeSerialized = typeof serialized === 'string' ? serialized : 'null';
  return safeSerialized
    .replace(/</g, '\\u003C')
    .replace(/>/g, '\\u003E')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getNonce() {
  return randomBytes(nonceByteLength).toString('hex');
}
