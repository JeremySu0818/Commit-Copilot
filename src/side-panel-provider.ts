import { randomBytes } from 'crypto';

import * as vscode from 'vscode';

import {
  DISPLAY_LANGUAGE_OPTIONS,
  DISPLAY_LANGUAGE_STATE_KEY,
  DisplayLanguage,
  EffectiveDisplayLanguage,
  WEBVIEW_LANGUAGE_PACKS,
  getDisplayLanguageLabel,
  getSidePanelText,
  normalizeDisplayLanguage,
  resolveEffectiveDisplayLanguage,
} from './i18n';
import {
  APIProvider,
  CommitOutputOptions,
  CustomProviderConfig,
  CUSTOM_PROVIDERS_STATE_KEY,
  CUSTOM_PROVIDER_PREFIX,
  DEFAULT_COMMIT_OUTPUT_OPTIONS,
  DEFAULT_GENERATE_MODE,
  MAX_AGENT_STEPS_STATE_KEY,
  PROVIDER_DISPLAY_NAMES,
  GENERATE_MODE_DISPLAY_NAMES,
  GenerateMode,
  MODELS_BY_PROVIDER,
  DEFAULT_MODELS,
  DEFAULT_PROVIDER,
  API_KEY_STORAGE_KEYS,
  OLLAMA_DEFAULT_HOST,
  isCustomProvider,
  getCustomProviderId,
  getCustomProviderStorageKey,
  normalizeCommitOutputOptions,
  normalizeMaxAgentStepsValue,
} from './models';
import {
  SidePanelScreen,
  WebviewBootstrapData,
} from './side-panel-webview-bootstrap';
import { GenerationStateManager, ValidationStateManager } from './state';

type UnknownRecord = Record<string, unknown>;
type MessageHandler = (message: IncomingMessage) => void | Promise<void>;
const badRequestStatus = 400;
const unauthorizedStatus = 401;
const forbiddenStatus = 403;
const tooManyRequestsStatus = 429;
const nonceByteLength = 16;

interface IncomingMessage extends UnknownRecord {
  type: string;
}

interface GitRepositoryState {
  workingTreeChanges: unknown[];
  indexChanges: unknown[];
  untrackedChanges: unknown[];
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

function isAPIProvider(value: string): value is APIProvider {
  return value in API_KEY_STORAGE_KEYS;
}

function toProvider(value: unknown): string {
  return asString(value) ?? DEFAULT_PROVIDER;
}

function toStoredModel(value: unknown): string {
  return asString(value) ?? '';
}

export class SidePanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'commit-copilot.view';
  private _view?: vscode.WebviewView;
  private _currentScreen: SidePanelScreen = 'main';

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext,
  ) {
    this.updateCurrentScreen('main');
  }

  private updateCurrentScreen(screen: unknown): void {
    const normalizedScreen: SidePanelScreen =
      screen === 'settings' || screen === 'addProvider' ? screen : 'main';
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
    const text = getSidePanelText(this.getEffectiveDisplayLanguage());

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
    const text = getSidePanelText(this.getEffectiveDisplayLanguage());
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
      default:
        return {
          valid: false,
          error: getSidePanelText(this.getEffectiveDisplayLanguage())
            .unknownProvider,
        };
    }
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
      text: ReturnType<typeof getSidePanelText>,
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
      const savedModel = this._context.globalState.get<string>(
        `CUSTOM_${customId}_MODEL`,
      );
      vscode.window.showInformationMessage(text.saveConfigSuccess(cp.name));
      postValidationResult(provider, true, {
        models: [],
        currentModel: savedModel ?? '',
        allowCustomModel: true,
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
      text: ReturnType<typeof getSidePanelText>,
    ): Promise<void> => {
      const builtIn = isAPIProvider(provider) ? provider : DEFAULT_PROVIDER;
      const resolvedApiValue = apiKey.length > 0 ? apiKey : OLLAMA_DEFAULT_HOST;
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
      postValidationResult(provider, true, {
        models: MODELS_BY_PROVIDER[builtIn],
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
      const text = getSidePanelText(this.getEffectiveDisplayLanguage());
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
      text: ReturnType<typeof getSidePanelText>,
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
      const text = getSidePanelText(this.getEffectiveDisplayLanguage());
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
        `CUSTOM_${deleteId}_MODEL`,
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
            const savedModel = this._context.globalState.get<string>(
              `CUSTOM_${customId}_MODEL`,
            );
            this._view?.webview.postMessage({
              type: 'modelsList',
              models: [],
              currentModel: savedModel ?? '',
              provider,
              allowCustomModel: true,
            });
          }
          return;
        }

        const builtIn = isAPIProvider(provider) ? provider : DEFAULT_PROVIDER;
        const key = await this._context.secrets.get(
          API_KEY_STORAGE_KEYS[builtIn],
        );
        if (key || builtIn === 'ollama') {
          const savedModel = this._context.globalState.get<string>(
            `${builtIn.toUpperCase()}_MODEL`,
          );
          this._view?.webview.postMessage({
            type: 'modelsList',
            models: MODELS_BY_PROVIDER[builtIn],
            currentModel: savedModel ?? DEFAULT_MODELS[builtIn],
            provider,
          });
        }
      },
      saveModel: async (message) => {
        const provider = toProvider(message.provider);
        const modelValue = toStoredModel(message.value);
        if (isCustomProvider(provider)) {
          await this._context.globalState.update(
            `CUSTOM_${getCustomProviderId(provider)}_MODEL`,
            modelValue,
          );
          return;
        }
        await this._context.globalState.update(
          `${provider.toUpperCase()}_MODEL`,
          modelValue,
        );
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
      getAllKeys: async () => {
        const keyStatuses: Record<string, boolean> = {
          google: false,
          openai: false,
          anthropic: false,
          ollama: false,
        };
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
        const text = getSidePanelText(effectiveLanguage);
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
        const warningMessage = asString(message.message) ?? '';
        if (warningMessage) {
          vscode.window.showWarningMessage(warningMessage);
        }
      },
      setCurrentScreen: (message) => {
        this.updateCurrentScreen(message.value);
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
      ollamaDefaultHost: OLLAMA_DEFAULT_HOST,
      languagePacks: WEBVIEW_LANGUAGE_PACKS,
      initialDisplayLanguage: languagePayload.displayLanguage,
      initialEffectiveLanguage: languagePayload.effectiveLanguage,
      initialVSCodeLanguage: languagePayload.vscodeLanguage,
      displayLanguageOptions: languagePayload.languageOptions,
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
        'side-panel.css',
      ),
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        'out',
        'webview',
        'side-panel.js',
      ),
    );
    const bootstrap = serializeForInlineScript(this.getWebviewBootstrapData());

    const cspSource = escapeHtmlAttribute(webview.cspSource);
    const escapedNonce = escapeHtmlAttribute(nonce);
    const escapedStyleUri = escapeHtmlAttribute(styleUri.toString());
    const escapedScriptUri = escapeHtmlAttribute(scriptUri.toString());

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${escapedNonce}';"
    />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Commit Copilot</title>
    <link rel="stylesheet" href="${escapedStyleUri}" />
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
