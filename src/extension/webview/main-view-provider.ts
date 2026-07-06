import { randomBytes } from 'crypto';

import { marked } from 'marked';
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
} from '../../i18n';
import { ModelFetcher } from '../../llm/model-fetcher';
import {
  API_KEY_STORAGE_KEYS,
  APIProvider,
  DEFAULT_MODELS,
  DEFAULT_PROVIDER,
  PROVIDER_DISPLAY_NAMES,
} from '../../llm/provider-registry';
import { ProviderValidator } from '../../llm/provider-validator';
import {
  MODELS_BY_PROVIDER,
  ModelConfig,
  OLLAMA_DEFAULT_HOST,
  resolveDefaultModel,
} from '../../models/catalog';
import {
  CUSTOM_PROVIDER_PREFIX,
  CustomProviderApiFormat,
  CustomProviderConfig,
  getCustomProviderId,
  getCustomProviderModelsStorageKey,
  getCustomProviderStorageKey,
  isCustomProvider,
  normalizeCustomProviderApiFormat,
} from '../../models/custom-provider';
import {
  CommitOutputOptions,
  DEFAULT_COMMIT_OUTPUT_OPTIONS,
  DEFAULT_GENERATE_MODE,
  DEFAULT_HYBRID_GENERATION_OPTIONS,
  GENERATE_MODE_DISPLAY_NAMES,
  GenerateMode,
  HybridGenerationOptions,
  HYBRID_GENERATION_OPTIONS_STATE_KEY,
  MAX_AGENT_STEPS_STATE_KEY,
  normalizeCommitOutputOptions,
  normalizeHybridGenerationOptions,
  normalizeMaxAgentStepsValue,
} from '../../models/options';
import {
  GenerationStateManager,
  ValidationStateManager,
} from '../../shared/state';
import {
  MainViewScreen,
  WebviewBootstrapData,
} from '../../shared/webview-bootstrap';
import type { IncomingMessage } from '../../shared/webview-protocol';
import { CustomProviderService } from '../settings/custom-provider-service';

import { MessageHandler, MessageRouter } from './message-router';

type UnknownRecord = Record<string, unknown>;
type WebviewWarningMessageKey = 'modelNameRequired';
const nonceByteLength = 16;

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

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
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

function isWebviewWarningMessageKey(
  value: string | undefined,
): value is WebviewWarningMessageKey {
  return value === 'modelNameRequired';
}

export class MainViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'commit-copilot.view';
  private _view?: vscode.WebviewView;
  private _currentScreen: MainViewScreen = 'main';
  private readonly customProviderService: CustomProviderService;
  private readonly providerValidator: ProviderValidator;
  private readonly modelFetcher: ModelFetcher;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext,
  ) {
    this.customProviderService = new CustomProviderService(_context);
    this.providerValidator = new ProviderValidator(() =>
      this.getEffectiveDisplayLanguage(),
    );
    this.modelFetcher = new ModelFetcher(
      _context,
      this.customProviderService,
      (message) => {
        this._view?.webview.postMessage(message);
      },
    );
    this.updateCurrentScreen('main');
  }

  private updateCurrentScreen(screen: unknown): void {
    const normalizedScreen: MainViewScreen =
      screen === 'settings' ||
      screen === 'addProvider' ||
      screen === 'addModel' ||
      screen === 'about'
        ? screen
        : 'main';
    this._currentScreen = normalizedScreen;
    void vscode.commands.executeCommand(
      'setContext',
      'commit-copilot.currentScreen',
      normalizedScreen,
    );
  }

  public openSettingsView() {
    this.updateCurrentScreen('settings');
    if (this._view) {
      this._view.show(true);
      this._view.webview.postMessage({ type: 'openSettingsView' });
    }
  }

  public openAboutView() {
    this.updateCurrentScreen('about');
    if (this._view) {
      this._view.show(true);
      this._view.webview.postMessage({ type: 'openAboutView' });
    }
  }

  public async migrateCustomProviders(): Promise<void> {
    await this.customProviderService.migrateProviders();
  }

  public async showUpdateInfo() {
    const lang = this.getEffectiveDisplayLanguage();
    const docsUri = vscode.Uri.joinPath(this._extensionUri, 'docs');
    let langMdUri = vscode.Uri.joinPath(docsUri, `${lang.toLowerCase()}.md`);
    try {
      await vscode.workspace.fs.stat(langMdUri);
    } catch {
      langMdUri = vscode.Uri.joinPath(docsUri, 'en.md');
    }

    let mdContent = '';
    try {
      const fileBytes = await vscode.workspace.fs.readFile(langMdUri);
      mdContent = Buffer.from(fileBytes).toString('utf-8');
    } catch {
      mdContent = `# Update\n\nNo update info available for language "${lang}".`;
    }

    const extension = this._context.extension as
      vscode.Extension<unknown> | undefined;
    const packageJson = (extension ? extension.packageJSON : undefined) as
      Record<string, unknown> | undefined;
    const extName =
      typeof packageJson?.name === 'string'
        ? packageJson.name
        : 'commit-copilot';
    const extensionName = extName
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    const updateInfoText = WEBVIEW_LANGUAGE_PACKS[lang].sections.updateInfo;
    const title = `${extensionName} ${updateInfoText}`;

    const panel = vscode.window.createWebviewPanel(
      'commitCopilotUpdateInfo',
      title,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    panel.webview.html = getUpdateInfoHtml(
      title,
      parseMarkdownToHtml(mdContent),
    );
  }

  private getCustomProviders(): CustomProviderConfig[] {
    return this.customProviderService.getProviders();
  }

  private getCustomProviderModelStorageKey(customId: string): string {
    return this.customProviderService.getModelStorageKey(customId);
  }

  private getSavedCustomProviderModel(customId: string): string {
    return this.customProviderService.getSavedModel(customId);
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

  private async saveCustomProviders(
    providers: CustomProviderConfig[],
  ): Promise<void> {
    await this.customProviderService.saveProviders(providers);
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

  private async validateCustomProviderKey(
    apiKey: string,
    baseUrl: string,
    apiFormat: CustomProviderApiFormat,
  ): Promise<{ valid: boolean; error?: string }> {
    return this.providerValidator.validateCustomProvider(
      apiKey,
      baseUrl,
      apiFormat,
    );
  }

  private async validateGoogleApiKey(
    apiKey: string,
  ): Promise<{ valid: boolean; error?: string }> {
    return this.providerValidator.validate('google', apiKey);
  }

  private async validateOpenAIApiKey(
    apiKey: string,
  ): Promise<{ valid: boolean; error?: string }> {
    return this.providerValidator.validate('openai', apiKey);
  }

  private async validateAnthropicApiKey(
    apiKey: string,
  ): Promise<{ valid: boolean; error?: string }> {
    return this.providerValidator.validate('anthropic', apiKey);
  }

  private async validateApiKey(
    provider: APIProvider,
    apiKey: string,
  ): Promise<{ valid: boolean; error?: string }> {
    return this.providerValidator.validate(provider, apiKey);
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
      const providerIndex = customProviders.findIndex(
        (candidate) => candidate.id === customId,
      );
      const cp =
        providerIndex >= 0 ? customProviders[providerIndex] : undefined;
      if (!cp) {
        postValidationResult(provider, false, { error: text.unknownProvider });
        return;
      }

      const resolvedApiKey =
        apiKey.length > 0
          ? apiKey
          : ((await this._context.secrets.get(
              getCustomProviderStorageKey(customId),
            )) ?? '');
      if (!resolvedApiKey) {
        vscode.window.showErrorMessage(text.apiKeyCannotBeEmpty);
        postValidationResult(provider, false);
        return;
      }

      const validationResult = await this.validateCustomProviderKey(
        resolvedApiKey,
        cp.baseUrl,
        cp.apiFormat,
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
      await this._context.secrets.store(storageKey, resolvedApiKey);

      const savedModel = this.getSavedCustomProviderModel(customId);
      const fetchedModels = await this.modelFetcher.fetchCustomProviderModels(
        resolvedApiKey,
        cp.baseUrl,
        customId,
        cp.apiFormat,
      );
      vscode.window.showInformationMessage(text.saveConfigSuccess(cp.name));
      postValidationResult(provider, true, {
        models: this.modelFetcher.includeModelIfMissing(
          fetchedModels,
          savedModel,
        ),
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
      const models = await this.modelFetcher.getBuiltInProviderModels(
        builtIn,
        resolvedApiValue,
      );
      const currentModel = resolveDefaultModel(builtIn, models, savedModel);
      postValidationResult(provider, true, {
        models: this.modelFetcher.includeBuiltInModelIfMissing(
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
      payload: {
        name: string;
        baseUrl: string;
        apiFormat: CustomProviderApiFormat;
        maxTokens?: number;
        editId: string | null;
      },
    ): string => {
      if (payload.editId) {
        const id = payload.editId;
        const index = providers.findIndex((cp) => cp.id === id);
        if (index >= 0) {
          providers[index] = {
            id,
            name: payload.name,
            baseUrl: payload.baseUrl,
            apiFormat: payload.apiFormat,
            ...(payload.maxTokens === undefined
              ? {}
              : { maxTokens: payload.maxTokens }),
          };
        } else {
          providers.push({
            id,
            name: payload.name,
            baseUrl: payload.baseUrl,
            apiFormat: payload.apiFormat,
            ...(payload.maxTokens === undefined
              ? {}
              : { maxTokens: payload.maxTokens }),
          });
        }
        return id;
      }

      const baseId = createCustomProviderBaseId(payload.name);
      const id = createUniqueCustomProviderId(baseId, providers);
      providers.push({
        id,
        name: payload.name,
        baseUrl: payload.baseUrl,
        apiFormat: payload.apiFormat,
        ...(payload.maxTokens === undefined
          ? {}
          : { maxTokens: payload.maxTokens }),
      });
      return id;
    };

    const validateCustomProviderBeforeSave = async (
      payload: {
        apiKey: string;
        baseUrl: string;
        apiFormat: CustomProviderApiFormat;
        editId: string | null;
      },
      text: ReturnType<typeof getMainViewText>,
    ): Promise<boolean> => {
      if (payload.editId && !payload.apiKey) {
        return true;
      }

      const validationResult = await this.validateCustomProviderKey(
        payload.apiKey,
        payload.baseUrl,
        payload.apiFormat,
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
      const apiFormat = normalizeCustomProviderApiFormat(message.apiFormat);
      const requestedMaxTokens =
        typeof message.maxTokens === 'number' ? message.maxTokens : undefined;
      const payload = {
        name: (asString(message.name) ?? '').trim(),
        baseUrl: (asString(message.baseUrl) ?? '').trim(),
        apiFormat,
        maxTokens:
          apiFormat === 'anthropic' && typeof requestedMaxTokens === 'number'
            ? Math.max(1, Math.trunc(requestedMaxTokens))
            : undefined,
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

    const handleSaveCustomProviderMaxTokensMessage = async (
      message: IncomingMessage,
    ): Promise<void> => {
      const provider = toProvider(message.provider);
      if (!isCustomProvider(provider)) {
        return;
      }

      const customId = getCustomProviderId(provider);
      const customProviders = this.getCustomProviders();
      const providerIndex = customProviders.findIndex(
        (candidate) => candidate.id === customId,
      );
      const cp =
        providerIndex >= 0 ? customProviders[providerIndex] : undefined;
      if (cp?.apiFormat !== 'anthropic') {
        return;
      }

      const nextMaxTokens =
        typeof message.maxTokens === 'number'
          ? Math.max(1, Math.trunc(message.maxTokens))
          : undefined;
      if (cp.maxTokens === nextMaxTokens) {
        return;
      }

      customProviders[providerIndex] =
        nextMaxTokens === undefined
          ? {
              id: cp.id,
              name: cp.name,
              baseUrl: cp.baseUrl,
              apiFormat: cp.apiFormat,
            }
          : {
              ...cp,
              maxTokens: nextMaxTokens,
            };

      await this.saveCustomProviders(customProviders);
      this._view?.webview.postMessage({
        type: 'customProvidersLoaded',
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
      showUpdateNotes: async () => {
        await this.showUpdateInfo();
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
            const fetchedModels =
              await this.modelFetcher.fetchCustomProviderModels(
                key,
                undefined,
                customId,
              );
            this._view?.webview.postMessage({
              type: 'modelsList',
              models: this.modelFetcher.includeModelIfMissing(
                fetchedModels,
                savedModel,
              ),
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
          const models = await this.modelFetcher.getBuiltInProviderModels(
            builtIn,
            key,
          );
          const currentModel = resolveDefaultModel(builtIn, models, savedModel);
          this._view?.webview.postMessage({
            type: 'modelsList',
            models: this.modelFetcher.includeBuiltInModelIfMissing(
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
          : this.modelFetcher.getBuiltInProviderModelsStorageKey('ollama');
        const existing = customId
          ? (this._context.globalState.get<{ id: string; alias: string }[]>(
              storageKey,
            ) ?? [])
          : await this.modelFetcher.getSanitizedOllamaManualModels();
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
          const models = await this.modelFetcher.fetchCustomProviderModels(
            apiKey,
            undefined,
            customId,
          );
          const updatedCustomModels =
            this._context.globalState.get<{ id: string; alias: string }[]>(
              storageKey,
            ) ?? [];
          this._view?.webview.postMessage({
            type: 'customModelAdded',
            models: this.modelFetcher.includeModelIfMissing(
              models,
              currentModel,
            ),
            currentModel,
            provider,
            customModels: updatedCustomModels,
          });
          return;
        }

        const host =
          (await this._context.secrets.get(API_KEY_STORAGE_KEYS.ollama)) ??
          OLLAMA_DEFAULT_HOST;
        const models = await this.modelFetcher.fetchOllamaModels(host);
        const updatedCustomModels =
          await this.modelFetcher.getSanitizedOllamaManualModels();
        this._view?.webview.postMessage({
          type: 'customModelAdded',
          models: this.modelFetcher.includeModelIfMissing(models, currentModel),
          currentModel,
          provider,
          customModels: updatedCustomModels,
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
          : this.modelFetcher.getBuiltInProviderModelsStorageKey('ollama');
        const customModels = customId
          ? (this._context.globalState.get<{ id: string; alias: string }[]>(
              storageKey,
            ) ?? [])
          : await this.modelFetcher.getSanitizedOllamaManualModels();
        this._view?.webview.postMessage({
          type: 'customModelsList',
          customModels,
          provider,
        });
      },
    };

    new MessageRouter({
      handlers: {
        ...simpleMessageHandlers,
        saveKey: handleSaveKeyMessage,
        saveCustomProvider: handleSaveCustomProviderMessage,
        saveCustomProviderMaxTokens: handleSaveCustomProviderMaxTokensMessage,
        deleteCustomProvider: handleDeleteCustomProviderMessage,
      },
    }).register(webviewView.webview);
  }

  private getWebviewBootstrapData(): WebviewBootstrapData {
    const languagePayload = this.getWebviewLanguagePayload();
    const extension = this._context.extension as
      vscode.Extension<unknown> | undefined;
    const packageJson = (extension ? extension.packageJSON : undefined) as
      Record<string, unknown> | undefined;
    const extensionVersion =
      typeof packageJson?.version === 'string' ? packageJson.version : '';

    let extensionAuthor = '';
    if (packageJson) {
      const authorVal = packageJson.author;
      if (typeof authorVal === 'object' && authorVal !== null) {
        const authorObj = authorVal as Record<string, unknown>;
        if (typeof authorObj.name === 'string') {
          extensionAuthor = authorObj.name;
        }
      } else if (typeof authorVal === 'string') {
        extensionAuthor = authorVal;
      } else if (typeof packageJson.publisher === 'string') {
        extensionAuthor = packageJson.publisher;
      }
    }

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
      extensionVersion,
      extensionAuthor,
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
      return this.modelFetcher.fetchCustomProviderModels(
        apiKey,
        undefined,
        customId,
      );
    }
    const host =
      (await this._context.secrets.get(API_KEY_STORAGE_KEYS.ollama)) ??
      OLLAMA_DEFAULT_HOST;
    return this.modelFetcher.fetchOllamaModels(host);
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
      : this.modelFetcher.getBuiltInProviderModelsStorageKey('ollama');

    const existing = customId
      ? (this._context.globalState.get<{ id: string; alias: string }[]>(
          storageKey,
        ) ?? [])
      : await this.modelFetcher.getSanitizedOllamaManualModels();

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

    const models = this.modelFetcher.includeModelIfMissing(
      fetchedModels,
      currentModel,
    );
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

function parseMarkdownToHtml(markdown: string): string {
  const parsed = marked.parse(markdown);
  return typeof parsed === 'string' ? parsed : '';
}

function getUpdateInfoHtml(title: string, contentHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 30px;
      line-height: 1.6;
      color: var(--vscode-editor-foreground, #cccccc);
      background-color: var(--vscode-editor-background, #1e1e1e);
      max-width: 800px;
      margin: 0 auto;
    }
    h1 {
      border-bottom: 1px solid var(--vscode-divider, #444444);
      padding-bottom: 10px;
      color: var(--vscode-editor-foreground, #ffffff);
      font-size: 2.2em;
    }
    h2 {
      margin-top: 30px;
      color: var(--vscode-symbolIcon-keywordForeground, #007acc);
      font-size: 1.5em;
    }
    h3 {
      margin-top: 20px;
      color: var(--vscode-editor-foreground, #ffffff);
      font-size: 1.2em;
    }
    p {
      margin: 1em 0;
    }
    ul {
      padding-left: 20px;
    }
    li {
      margin: 5px 0;
    }
    code {
      font-family: Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace;
      background-color: var(--vscode-textCodeBlock-background, rgba(220, 220, 220, 0.1));
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 0.9em;
    }
    pre {
      background-color: var(--vscode-textCodeBlock-background, rgba(0, 0, 0, 0.2));
      padding: 15px;
      border-radius: 5px;
      overflow-x: auto;
      border: 1px solid var(--vscode-divider, #444444);
    }
    pre code {
      background-color: transparent;
      padding: 0;
      border-radius: 0;
    }
    a {
      color: var(--vscode-textLink-foreground, #3794ff);
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    .footer {
      margin-top: 50px;
      border-top: 1px solid var(--vscode-divider, #444444);
      padding-top: 20px;
      font-size: 0.9em;
      color: var(--vscode-descriptionForeground, #858585);
      text-align: center;
    }
  </style>
</head>
<body>
  ${contentHtml}
  <div class="footer">
    Commit Copilot &copy; ${String(new Date().getFullYear())}
  </div>
</body>
</html>`;
}
