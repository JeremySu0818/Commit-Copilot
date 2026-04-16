import * as vscode from 'vscode';
import { randomBytes } from 'crypto';
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
import { GenerationStateManager, ValidationStateManager } from './state';
import {
  SidePanelScreen,
  WebviewBootstrapData,
} from './side-panel-webview-bootstrap';

type UnknownRecord = Record<string, unknown>;

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

    const quotaStatusCodes = rules.quotaStatusCodes ?? [429];
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
      const { GoogleGenAI } = await import('@google/genai');
      const client = new GoogleGenAI({ apiKey });

      await client.models.list({ config: { pageSize: 1 } });
      return { valid: true };
    } catch (error) {
      return this.mapProviderValidationError(error, {
        invalidStatusCodes: [400, 401, 403],
        invalidMessagePatterns: ['API key not valid', 'PERMISSION_DENIED'],
        quotaMessagePatterns: ['RESOURCE_EXHAUSTED', 'quota'],
      });
    }
  }

  private async validateOpenAIApiKey(
    apiKey: string,
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const OpenAI = (await import('openai')).default;
      const client = new OpenAI({ apiKey });

      await client.models.list();
      return { valid: true };
    } catch (error) {
      return this.mapProviderValidationError(error, {
        invalidStatusCodes: [401, 403],
        invalidMessagePatterns: ['Invalid API Key'],
      });
    }
  }

  private async validateAnthropicApiKey(
    apiKey: string,
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const client = new Anthropic({ apiKey });

      await client.models.list({ limit: 1 });
      return { valid: true };
    } catch (error) {
      return this.mapProviderValidationError(error, {
        invalidStatusCodes: [401, 403],
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
      const OpenAI = (await import('openai')).default;
      const client = new OpenAI({ apiKey, baseURL: baseUrl });
      await client.models.list();
      return { valid: true };
    } catch (error) {
      return this.mapProviderValidationError(error, {
        invalidStatusCodes: [401, 403],
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

    const checkGitStatus = () => {
      if (isViewDisposed) {
        return;
      }
      try {
        const git = getActiveGitApi();
        if (!git) {
          return;
        }
        const repos = git.repositories;
        if (repos.length > 0) {
          let targetRepo: GitRepository | null = null;
          if (repos.length === 1) {
            targetRepo = repos[0];
          } else {
            const activeUri = vscode.window.activeTextEditor?.document.uri;
            if (activeUri) {
              if (typeof git.getRepository === 'function') {
                targetRepo = git.getRepository(activeUri);
              }
              if (!targetRepo) {
                const activeUriString = activeUri.toString();
                targetRepo =
                  repos.find((repo) =>
                    activeUriString.startsWith(repo.rootUri.toString()),
                  ) ?? null;
              }
            }
          }
          const hasChanges = targetRepo
            ? targetRepo.state.workingTreeChanges.length > 0 ||
              targetRepo.state.indexChanges.length > 0 ||
              targetRepo.state.untrackedChanges.length > 0
            : false;
          webviewView.webview.postMessage({ type: 'repoUpdate', hasChanges });
        } else {
          webviewView.webview.postMessage({
            type: 'repoUpdate',
            hasChanges: false,
          });
        }
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

    webviewView.webview.onDidReceiveMessage(async (data: unknown) => {
      const message = asMessage(data);
      if (!message) {
        return;
      }

      switch (message.type) {
        case 'saveKey': {
          const text = getSidePanelText(this.getEffectiveDisplayLanguage());
          const provider = toProvider(message.provider);
          const apiKey = asString(message.value) ?? '';
          if (!apiKey && provider !== 'ollama') {
            vscode.window.showErrorMessage(text.apiKeyCannotBeEmpty);
            this._view?.webview.postMessage({
              type: 'validationResult',
              success: false,
              provider,
            });
            return;
          }
          ValidationStateManager.setValidating(true, provider);
          this._view?.webview.postMessage({ type: 'validating', provider });
          try {
            if (isCustomProvider(provider)) {
              const customId = getCustomProviderId(provider);
              const customProviders = this.getCustomProviders();
              const cp = customProviders.find((c) => c.id === customId);
              if (!cp) {
                this._view?.webview.postMessage({
                  type: 'validationResult',
                  success: false,
                  error: text.unknownProvider,
                  provider,
                });
                return;
              }
              try {
                const validationResult = await this.validateCustomProviderKey(
                  apiKey,
                  cp.baseUrl,
                );
                if (!validationResult.valid) {
                  vscode.window.showWarningMessage(
                    `${text.validationFailedPrefix}: ${validationResult.error ?? text.unableToConnectFallback}`,
                  );
                  this._view?.webview.postMessage({
                    type: 'validationResult',
                    success: false,
                    error: validationResult.error,
                    provider,
                  });
                  return;
                }
                const storageKey = getCustomProviderStorageKey(customId);
                await this._context.secrets.store(storageKey, apiKey);
                const savedModel = this._context.globalState.get<string>(
                  `CUSTOM_${customId}_MODEL`,
                );
                vscode.window.showInformationMessage(
                  text.saveConfigSuccess(cp.name),
                );
                this._view?.webview.postMessage({
                  type: 'validationResult',
                  success: true,
                  models: [],
                  currentModel: savedModel ?? '',
                  allowCustomModel: true,
                  provider,
                });
                this._view?.webview.postMessage({
                  type: 'keyStatus',
                  hasKey: true,
                  provider,
                });
              } catch {
                vscode.window.showErrorMessage(text.saveConfigFailed);
                this._view?.webview.postMessage({
                  type: 'validationResult',
                  success: false,
                  provider,
                });
              }
            } else {
              const builtIn = isAPIProvider(provider)
                ? provider
                : DEFAULT_PROVIDER;
              const resolvedApiValue =
                apiKey.length > 0 ? apiKey : OLLAMA_DEFAULT_HOST;
              const validationResult = await this.validateApiKey(
                builtIn,
                resolvedApiValue,
              );
              if (!validationResult.valid) {
                vscode.window.showWarningMessage(
                  `${text.validationFailedPrefix}: ${validationResult.error ?? text.unableToConnectFallback}`,
                );
                this._view?.webview.postMessage({
                  type: 'validationResult',
                  success: false,
                  error: validationResult.error,
                  provider,
                });
                return;
              }
              try {
                const storageKey = API_KEY_STORAGE_KEYS[builtIn];
                await this._context.secrets.store(storageKey, resolvedApiValue);
                vscode.window.showInformationMessage(
                  text.saveConfigSuccess(PROVIDER_DISPLAY_NAMES[builtIn]),
                );
                this._view?.webview.postMessage({
                  type: 'validationResult',
                  success: true,
                  models: MODELS_BY_PROVIDER[builtIn],
                  provider,
                });
                this._view?.webview.postMessage({
                  type: 'keyStatus',
                  hasKey: true,
                  provider,
                  ...(builtIn === 'ollama' ? { value: resolvedApiValue } : {}),
                });
              } catch {
                vscode.window.showErrorMessage(text.saveConfigFailed);
                this._view?.webview.postMessage({
                  type: 'validationResult',
                  success: false,
                  provider,
                });
              }
            }
          } finally {
            ValidationStateManager.setValidating(false, null);
          }
          break;
        }
        case 'generate': {
          try {
            const requestedMode =
              message.generateMode === 'direct-diff'
                ? 'direct-diff'
                : 'agentic';
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
          break;
        }
        case 'cancelGenerate': {
          await vscode.commands.executeCommand(
            'commit-copilot.cancelGeneration',
          );
          break;
        }
        case 'checkKey': {
          const provider = toProvider(message.provider);
          let key: string | undefined;
          if (isCustomProvider(provider)) {
            const customId = getCustomProviderId(provider);
            key = await this._context.secrets.get(
              getCustomProviderStorageKey(customId),
            );
          } else {
            const builtIn = isAPIProvider(provider)
              ? provider
              : DEFAULT_PROVIDER;
            const storageKey = API_KEY_STORAGE_KEYS[builtIn];
            key = await this._context.secrets.get(storageKey);
          }
          const resolvedKey = key && key.length > 0 ? key : OLLAMA_DEFAULT_HOST;
          this._view?.webview.postMessage({
            type: 'keyStatus',
            hasKey: Boolean(key),
            provider,
            ...(provider === 'ollama' ? { value: resolvedKey } : {}),
          });
          break;
        }
        case 'checkGit': {
          checkGitStatus();
          break;
        }
        case 'getModels': {
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
          } else {
            const builtIn = isAPIProvider(provider)
              ? provider
              : DEFAULT_PROVIDER;
            const storageKey = API_KEY_STORAGE_KEYS[builtIn];
            const key = await this._context.secrets.get(storageKey);
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
          }
          break;
        }
        case 'saveModel': {
          const provider = toProvider(message.provider);
          const modelValue = toStoredModel(message.value);
          if (isCustomProvider(provider)) {
            const customId = getCustomProviderId(provider);
            await this._context.globalState.update(
              `CUSTOM_${customId}_MODEL`,
              modelValue,
            );
          } else {
            await this._context.globalState.update(
              `${provider.toUpperCase()}_MODEL`,
              modelValue,
            );
          }
          break;
        }
        case 'saveProvider': {
          const provider = toStoredModel(message.value);
          await this._context.globalState.update('CURRENT_PROVIDER', provider);
          break;
        }
        case 'getProvider': {
          const savedProvider =
            this._context.globalState.get<APIProvider>('CURRENT_PROVIDER');
          this._view?.webview.postMessage({
            type: 'currentProvider',
            provider: savedProvider ?? DEFAULT_PROVIDER,
          });
          break;
        }
        case 'saveGenerateMode': {
          const mode: GenerateMode =
            message.value === 'direct-diff' ? 'direct-diff' : 'agentic';
          await this._context.globalState.update('GENERATE_MODE', mode);
          break;
        }
        case 'getGenerateMode': {
          const savedMode =
            this._context.globalState.get<GenerateMode>('GENERATE_MODE') ??
            DEFAULT_GENERATE_MODE;
          this._view?.webview.postMessage({
            type: 'currentGenerateMode',
            generateMode: savedMode,
          });
          break;
        }
        case 'saveCommitOutputOptions': {
          const commitOutputOptions = normalizeCommitOutputOptions(
            message.value,
          );
          await this._context.globalState.update(
            'COMMIT_OUTPUT_OPTIONS',
            commitOutputOptions,
          );
          break;
        }
        case 'getCommitOutputOptions': {
          const savedOptions = normalizeCommitOutputOptions(
            this._context.globalState.get<CommitOutputOptions>(
              'COMMIT_OUTPUT_OPTIONS',
            ) ?? DEFAULT_COMMIT_OUTPUT_OPTIONS,
          );
          this._view?.webview.postMessage({
            type: 'currentCommitOutputOptions',
            commitOutputOptions: savedOptions,
          });
          break;
        }
        case 'getAllKeys': {
          const keyStatuses: Record<string, boolean> = {
            google: false,
            openai: false,
            anthropic: false,
            ollama: false,
          };
          for (const [provider, storageKey] of Object.entries(
            API_KEY_STORAGE_KEYS,
          )) {
            const key = await this._context.secrets.get(storageKey);
            keyStatuses[provider] = !!key;
          }
          for (const cp of this.getCustomProviders()) {
            const key = await this._context.secrets.get(
              getCustomProviderStorageKey(cp.id),
            );
            keyStatuses[`${CUSTOM_PROVIDER_PREFIX}${cp.id}`] = !!key;
          }
          this._view?.webview.postMessage({
            type: 'allKeyStatuses',
            statuses: keyStatuses,
          });
          break;
        }
        case 'checkGenerationStatus': {
          this._view?.webview.postMessage({
            type: 'generationStatusUpdate',
            isGenerating: GenerationStateManager.isGenerating,
          });
          break;
        }
        case 'checkValidationStatus': {
          this._view?.webview.postMessage({
            type: 'validationStatusUpdate',
            isValidating: ValidationStateManager.isValidating,
            provider: ValidationStateManager.validatingProvider,
          });
          break;
        }
        case 'saveDisplayLanguage': {
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
          break;
        }
        case 'getDisplayLanguage': {
          this._view?.webview.postMessage({
            type: 'displayLanguageUpdated',
            ...this.getWebviewLanguagePayload(),
          });
          break;
        }
        case 'saveMaxAgentSteps': {
          const steps = normalizeMaxAgentStepsValue(message.value);
          await this._context.globalState.update(
            MAX_AGENT_STEPS_STATE_KEY,
            steps > 0 ? steps : null,
          );
          break;
        }
        case 'getMaxAgentSteps': {
          const steps = normalizeMaxAgentStepsValue(
            this._context.globalState.get<number | string | null>(
              MAX_AGENT_STEPS_STATE_KEY,
            ),
          );
          this._view?.webview.postMessage({
            type: 'currentMaxAgentSteps',
            maxAgentSteps: steps,
          });
          break;
        }
        case 'saveCustomProvider': {
          const text = getSidePanelText(this.getEffectiveDisplayLanguage());
          const customProviders = this.getCustomProviders();
          const name = (asString(message.name) ?? '').trim();
          const baseUrl = (asString(message.baseUrl) ?? '').trim();
          const apiKey = (asString(message.apiKey) ?? '').trim();
          const editIdRaw = asString(message.editId);
          const editId = editIdRaw && editIdRaw.length > 0 ? editIdRaw : null;

          if (!editId && !apiKey) {
            this._view?.webview.postMessage({
              type: 'customProviderSaveFailed',
              error: text.apiKeyCannotBeEmpty,
            });
            break;
          }

          const shouldValidate = !editId || !!apiKey;
          if (shouldValidate) {
            const validationResult = await this.validateCustomProviderKey(
              apiKey,
              baseUrl,
            );
            if (!validationResult.valid) {
              this._view?.webview.postMessage({
                type: 'customProviderSaveFailed',
                error: validationResult.error ?? text.unableToConnectFallback,
              });
              break;
            }
          }

          let id: string;
          if (editId) {
            id = editId;
            const idx = customProviders.findIndex((cp) => cp.id === id);
            if (idx >= 0) {
              customProviders[idx] = { id, name, baseUrl };
            } else {
              customProviders.push({ id, name, baseUrl });
            }
          } else {
            id = name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '_')
              .replace(/^_|_$/g, '');
            if (!id) {
              id = 'provider';
            }
            const existingIds = new Set(customProviders.map((cp) => cp.id));
            let uniqueId = id;
            let counter = 1;
            while (existingIds.has(uniqueId)) {
              uniqueId = `${id}_${String(counter)}`;
              counter += 1;
            }
            id = uniqueId;
            customProviders.push({ id, name, baseUrl });
          }

          await this.saveCustomProviders(customProviders);

          if (apiKey) {
            const storageKey = getCustomProviderStorageKey(id);
            await this._context.secrets.store(storageKey, apiKey);
          }

          this._view?.webview.postMessage({
            type: 'customProviderSaved',
            savedId: id,
            customProviders,
          });
          break;
        }
        case 'deleteCustomProvider': {
          const deleteId = asString(message.id) ?? '';
          let customProviders = this.getCustomProviders();
          customProviders = customProviders.filter((cp) => cp.id !== deleteId);
          await this.saveCustomProviders(customProviders);

          const storageKey = getCustomProviderStorageKey(deleteId);
          await this._context.secrets.delete(storageKey);

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
          break;
        }
        case 'getCustomProviders': {
          this._view?.webview.postMessage({
            type: 'customProvidersLoaded',
            customProviders: this.getCustomProviders(),
          });
          break;
        }
        case 'showWarning': {
          const warningMessage = asString(message.message) ?? '';
          if (warningMessage) {
            vscode.window.showWarningMessage(warningMessage);
          }
          break;
        }
        case 'setCurrentScreen': {
          this.updateCurrentScreen(message.value);
          break;
        }
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
  return randomBytes(16).toString('hex');
}
