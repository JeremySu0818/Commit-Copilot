import * as vscode from 'vscode';
import * as fs from 'fs';
import {
  APIProvider,
  CommitOutputOptions,
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
  normalizeCommitOutputOptions,
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

export class SidePanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'commit-copilot.view';
  private _view?: vscode.WebviewView;
  private _currentScreen: 'main' | 'settings' = 'main';

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext,
  ) {}

  public openLanguageSettingsView() {
    this._currentScreen = 'settings';
    if (this._view) {
      this._view.show?.(true);
      this._view.webview.postMessage({ type: 'openSettingsView' });
    }
  }

  private getVSCodeLanguage(): string | undefined {
    return vscode.env?.language;
  }

  private getDisplayLanguage(): DisplayLanguage {
    const storedLanguage = this._context?.globalState?.get?.(
      DISPLAY_LANGUAGE_STATE_KEY,
    );
    return normalizeDisplayLanguage(
      storedLanguage,
    );
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
        ? String((error as { message?: string }).message || '')
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

    const quotaStatusCodes = rules.quotaStatusCodes || [429];
    const isQuotaExceeded =
      (typeof status === 'number' && quotaStatusCodes.includes(status)) ||
      this.includesMessage(message, rules.quotaMessagePatterns);
    if (isQuotaExceeded) {
      return { valid: false, error: text.quotaExceededPrefix };
    }

    if (typeof status === 'number') {
      return {
        valid: false,
        error: `${text.apiRequestFailedPrefix} (${status})`,
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
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    let isViewDisposed = false;
    const gitDisposables: vscode.Disposable[] = [];
    const observedRepos = new WeakSet<object>();

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

    const checkGitStatus = () => {
      if (isViewDisposed) {
        return;
      }
      try {
        const gitExtension = vscode.extensions.getExtension<any>('vscode.git');
        if (!gitExtension?.isActive) {
          return;
        }
        const git = gitExtension.exports?.getAPI?.(1);
        if (!git) {
          return;
        }
        const repos = git.repositories;
        if (repos.length > 0) {
          const hasChanges = repos.some((repo: any) => {
            const state = repo?.state;
            return (
              (state?.workingTreeChanges?.length ?? 0) > 0 ||
              (state?.indexChanges?.length ?? 0) > 0 ||
              (state?.untrackedChanges?.length ?? 0) > 0
            );
          });
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

    const attachRepoStateListener = (repo: any) => {
      if (!repo?.state || observedRepos.has(repo)) {
        return;
      }
      observedRepos.add(repo);
      addGitDisposable(
        repo.state.onDidChange(() => {
          checkGitStatus();
        }),
      );
    };

    const setupGitListeners = (git: any) => {
      const setupRepoListeners = () => {
        git.repositories.forEach((repo: any) => {
          attachRepoStateListener(repo);
        });
        checkGitStatus();
      };

      setupRepoListeners();

      if (git.state !== 'initialized') {
        addGitDisposable(
          git.onDidChangeState?.((state: any) => {
            if (state === 'initialized') {
              setupRepoListeners();
            }
          }),
        );
      }

      addGitDisposable(
        git.onDidOpenRepository?.((repo: any) => {
          attachRepoStateListener(repo);
          checkGitStatus();
        }),
      );
    };

    try {
      const gitExtension = vscode.extensions.getExtension<any>('vscode.git');
      if (gitExtension?.isActive && gitExtension.exports) {
        const git = gitExtension.exports.getAPI?.(1);
        if (git) {
          setupGitListeners(git);
        }
      } else if (gitExtension && !gitExtension.isActive) {
        (async () => {
          try {
            await gitExtension.activate();
            if (isViewDisposed) {
              return;
            }
            const git = gitExtension.exports?.getAPI?.(1);
            if (git) {
              setupGitListeners(git);
            }
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

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'saveKey': {
          const text = getSidePanelText(this.getEffectiveDisplayLanguage());
          const provider = data.provider as APIProvider;
          const apiKey = data.value;
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
            const validationResult = await this.validateApiKey(
              provider,
              apiKey || OLLAMA_DEFAULT_HOST,
            );
            if (!validationResult.valid) {
              vscode.window.showWarningMessage(
                `${text.validationFailedPrefix}: ${validationResult.error || text.unableToConnectFallback}`,
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
              const storageKey = API_KEY_STORAGE_KEYS[provider];
              await this._context.secrets.store(
                storageKey,
                apiKey || OLLAMA_DEFAULT_HOST,
              );
              vscode.window.showInformationMessage(
                text.saveConfigSuccess(PROVIDER_DISPLAY_NAMES[provider]),
              );
              this._view?.webview.postMessage({
                type: 'validationResult',
                success: true,
                models: MODELS_BY_PROVIDER[provider],
                provider,
              });
              this._view?.webview.postMessage({
                type: 'keyStatus',
                hasKey: true,
                provider,
              });
            } catch (e) {
              vscode.window.showErrorMessage(text.saveConfigFailed);
              this._view?.webview.postMessage({
                type: 'validationResult',
                success: false,
                provider,
              });
            }
          } finally {
            ValidationStateManager.setValidating(false, null);
          }
          break;
        }
        case 'generate': {
          try {
            const requestedMode =
              data.generateMode === 'direct-diff' ? 'direct-diff' : 'agentic';
            const commitOutputOptions = normalizeCommitOutputOptions(
              data.commitOutputOptions,
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
          const provider = (data.provider as APIProvider) || DEFAULT_PROVIDER;
          const storageKey = API_KEY_STORAGE_KEYS[provider];
          const key = await this._context.secrets.get(storageKey);
          this._view?.webview.postMessage({
            type: 'keyStatus',
            hasKey: !!key,
            provider,
          });
          break;
        }
        case 'checkGit': {
          checkGitStatus();
          break;
        }
        case 'getModels': {
          const provider = (data.provider as APIProvider) || DEFAULT_PROVIDER;
          const storageKey = API_KEY_STORAGE_KEYS[provider];
          const key = await this._context.secrets.get(storageKey);
          if (key || provider === 'ollama') {
            const savedModel = this._context.globalState.get<string>(
              `${provider.toUpperCase()}_MODEL`,
            );
            this._view?.webview.postMessage({
              type: 'modelsList',
              models: MODELS_BY_PROVIDER[provider],
              currentModel: savedModel || DEFAULT_MODELS[provider],
              provider,
            });
          }
          break;
        }
        case 'saveModel': {
          const provider = (data.provider as APIProvider) || DEFAULT_PROVIDER;
          await this._context.globalState.update(
            `${provider.toUpperCase()}_MODEL`,
            data.value,
          );
          break;
        }
        case 'saveProvider': {
          await this._context.globalState.update(
            'CURRENT_PROVIDER',
            data.value,
          );
          break;
        }
        case 'getProvider': {
          const savedProvider =
            this._context.globalState.get<APIProvider>('CURRENT_PROVIDER');
          this._view?.webview.postMessage({
            type: 'currentProvider',
            provider: savedProvider || DEFAULT_PROVIDER,
          });
          break;
        }
        case 'saveGenerateMode': {
          const mode: GenerateMode =
            data.value === 'direct-diff' ? 'direct-diff' : 'agentic';
          await this._context.globalState.update('GENERATE_MODE', mode);
          break;
        }
        case 'getGenerateMode': {
          const savedMode =
            this._context.globalState.get<GenerateMode>('GENERATE_MODE') ||
            DEFAULT_GENERATE_MODE;
          this._view?.webview.postMessage({
            type: 'currentGenerateMode',
            generateMode: savedMode,
          });
          break;
        }
        case 'saveCommitOutputOptions': {
          const commitOutputOptions = normalizeCommitOutputOptions(data.value);
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
            ) || DEFAULT_COMMIT_OUTPUT_OPTIONS,
          );
          this._view?.webview.postMessage({
            type: 'currentCommitOutputOptions',
            commitOutputOptions: savedOptions,
          });
          break;
        }
        case 'getAllKeys': {
          const keyStatuses: Record<APIProvider, boolean> = {
            google: false,
            openai: false,
            anthropic: false,
            ollama: false,
          };
          for (const [provider, storageKey] of Object.entries(
            API_KEY_STORAGE_KEYS,
          )) {
            const key = await this._context.secrets.get(storageKey);
            keyStatuses[provider as APIProvider] = !!key;
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
          const nextLanguage = normalizeDisplayLanguage(data.value);
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
          const steps = typeof data.value === 'number' && data.value > 0 ? data.value : 0;
          await this._context.globalState.update(MAX_AGENT_STEPS_STATE_KEY, steps || null);
          break;
        }
        case 'getMaxAgentSteps': {
          const steps = this._context.globalState.get<number>(MAX_AGENT_STEPS_STATE_KEY) || 0;
          this._view?.webview.postMessage({
            type: 'currentMaxAgentSteps',
            maxAgentSteps: steps,
          });
          break;
        }
        case 'setCurrentScreen': {
          this._currentScreen =
            data.value === 'settings' ? 'settings' : 'main';
          break;
        }
      }
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const nonce = getNonce();
    const templateUri = vscode.Uri.joinPath(
      this._extensionUri,
      'resources',
      'side-panel.html',
    );
    const template = fs.readFileSync(templateUri.fsPath, 'utf8');
    const languagePayload = this.getWebviewLanguagePayload();

    const replacements: Record<string, string> = {
      CSP_SOURCE: escapeHtmlAttribute(webview.cspSource),
      NONCE: escapeHtmlAttribute(nonce),
      PROVIDERS_JSON: serializeForInlineScript(PROVIDER_DISPLAY_NAMES),
      GENERATE_MODES_JSON: serializeForInlineScript(
        GENERATE_MODE_DISPLAY_NAMES,
      ),
      MODELS_JSON: serializeForInlineScript(MODELS_BY_PROVIDER),
      DEFAULT_MODELS_JSON: serializeForInlineScript(DEFAULT_MODELS),
      DEFAULT_COMMIT_OUTPUT_OPTIONS_JSON: serializeForInlineScript(
        DEFAULT_COMMIT_OUTPUT_OPTIONS,
      ),
      DEFAULT_PROVIDER_JSON: serializeForInlineScript(DEFAULT_PROVIDER),
      DEFAULT_GENERATE_MODE_JSON: serializeForInlineScript(
        DEFAULT_GENERATE_MODE,
      ),
      OLLAMA_DEFAULT_HOST_JSON: serializeForInlineScript(OLLAMA_DEFAULT_HOST),
      WEBVIEW_LANGUAGE_PACKS_JSON: serializeForInlineScript(
        WEBVIEW_LANGUAGE_PACKS,
      ),
      DISPLAY_LANGUAGE_JSON: serializeForInlineScript(
        languagePayload.displayLanguage,
      ),
      EFFECTIVE_LANGUAGE_JSON: serializeForInlineScript(
        languagePayload.effectiveLanguage,
      ),
      DISPLAY_LANGUAGE_OPTIONS_JSON: serializeForInlineScript(
        languagePayload.languageOptions,
      ),
      INITIAL_SCREEN_JSON: serializeForInlineScript(this._currentScreen),
    };

    return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, key: string) => {
      return replacements[key] ?? match;
    });
  }
}

function serializeForInlineScript(value: unknown): string {
  // Keep JSON safe when inlined inside <script>; replacement strings must
  // remain literal \uXXXX escapes in the generated HTML/JS source.
  return JSON.stringify(value)
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
  let text = '';
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
