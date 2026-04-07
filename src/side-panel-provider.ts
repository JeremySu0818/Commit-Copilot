import * as vscode from 'vscode';
import * as fs from 'fs';
import {
  APIProvider,
  CommitOutputOptions,
  DEFAULT_COMMIT_OUTPUT_OPTIONS,
  DEFAULT_GENERATE_MODE,
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
import { GenerationStateManager, ValidationStateManager } from './state';

export class SidePanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'commit-copilot.view';
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext,
  ) {}

  private extractValidationError(
    error: unknown,
  ): { status?: number; message: string } {
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

    const isInvalidKey =
      (typeof status === 'number' && rules.invalidStatusCodes.includes(status)) ||
      this.includesMessage(message, rules.invalidMessagePatterns);
    if (isInvalidKey) {
      return { valid: false, error: `Invalid API Key: ${message}` };
    }

    const quotaStatusCodes = rules.quotaStatusCodes || [429];
    const isQuotaExceeded =
      (typeof status === 'number' && quotaStatusCodes.includes(status)) ||
      this.includesMessage(message, rules.quotaMessagePatterns);
    if (isQuotaExceeded) {
      return { valid: false, error: `API quota exceeded: ${message}` };
    }

    if (typeof status === 'number') {
      return {
        valid: false,
        error: `API request failed (${status}): ${message}`,
      };
    }

    return { valid: false, error: `Connection error: ${message}` };
  }

  private async validateGoogleApiKey(
    apiKey: string,
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const { GoogleAIFileManager } = await import('@google/generative-ai/server');
      const fileManager = new GoogleAIFileManager(apiKey);

      // Use a metadata list API for validation to avoid generating tokens.
      await fileManager.listFiles({ pageSize: 1 });
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

      // Use model listing for validation to avoid generating tokens.
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

      // Use the models endpoint for validation to avoid generating tokens.
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
        error: `Cannot connect to Ollama at ${hostUrl}`,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        valid: false,
        error: `Cannot connect to Ollama: ${errorMessage}. Make sure Ollama is running.`,
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
        return { valid: false, error: 'Unknown provider' };
    }
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

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
      GenerationStateManager.removeListener(onGenerationStateChange);
      ValidationStateManager.removeListener(onValidationStateChange);
    });

    const checkGitStatus = () => {
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

    try {
      const gitExtension = vscode.extensions.getExtension<any>('vscode.git');
      if (gitExtension?.isActive && gitExtension.exports) {
        const git = gitExtension.exports.getAPI?.(1);
        if (git) {
          const setupRepoListeners = () => {
            if (git.repositories.length > 0) {
              checkGitStatus();
              git.repositories.forEach((repo: any) => {
                repo.state.onDidChange(() => {
                  checkGitStatus();
                });
              });
            }
          };

          if (git.state === 'initialized') {
            setupRepoListeners();
          } else {
            git.onDidChangeState?.((state: any) => {
              if (state === 'initialized') {
                setupRepoListeners();
              }
            });
          }

          git.onDidOpenRepository?.((repo: any) => {
            repo.state.onDidChange(() => {
              checkGitStatus();
            });
            checkGitStatus();
          });

          if (git.repositories.length > 0) {
            setupRepoListeners();
          }
        }
      } else if (gitExtension && !gitExtension.isActive) {
        (async () => {
          try {
            await gitExtension.activate();
            const git = gitExtension.exports?.getAPI?.(1);
            if (git) {
              checkGitStatus();
              git.onDidOpenRepository?.((repo: any) => {
                repo.state.onDidChange(() => {
                  checkGitStatus();
                });
                checkGitStatus();
              });
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
          const provider = data.provider as APIProvider;
          const apiKey = data.value;
          if (!apiKey && provider !== 'ollama') {
            vscode.window.showErrorMessage('API Key cannot be empty');
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
                `Validation failed: ${validationResult.error || 'Unable to connect'}`,
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
                `${PROVIDER_DISPLAY_NAMES[provider]} configuration saved successfully!`,
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
              vscode.window.showErrorMessage('Failed to save configuration');
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
          await vscode.commands.executeCommand('commit-copilot.cancelGeneration');
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
            ollama: true,
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
      }
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const nonce = getNonce();
    const providersJson = JSON.stringify(PROVIDER_DISPLAY_NAMES);
    const generateModesJson = JSON.stringify(GENERATE_MODE_DISPLAY_NAMES);
    const modelsJson = JSON.stringify(MODELS_BY_PROVIDER);
    const defaultModelsJson = JSON.stringify(DEFAULT_MODELS);
    const defaultCommitOutputOptionsJson = JSON.stringify(
      DEFAULT_COMMIT_OUTPUT_OPTIONS,
    );
    const defaultProvider = DEFAULT_PROVIDER;
    const defaultGenerateMode = DEFAULT_GENERATE_MODE;
    const ollamaDefaultHost = OLLAMA_DEFAULT_HOST;

    const templateUri = vscode.Uri.joinPath(
      this._extensionUri,
      'resources',
      'side-panel.html',
    );
    const template = fs.readFileSync(templateUri.fsPath, 'utf8');

    return template
      .replace(/\{\{CSP_SOURCE\}\}/g, webview.cspSource)
      .replace(/\{\{NONCE\}\}/g, nonce)
      .replace(/\{\{PROVIDERS_JSON\}\}/g, providersJson)
      .replace(/\{\{GENERATE_MODES_JSON\}\}/g, generateModesJson)
      .replace(/\{\{MODELS_JSON\}\}/g, modelsJson)
      .replace(/\{\{DEFAULT_MODELS_JSON\}\}/g, defaultModelsJson)
      .replace(
        /\{\{DEFAULT_COMMIT_OUTPUT_OPTIONS_JSON\}\}/g,
        defaultCommitOutputOptionsJson,
      )
      .replace(/\{\{DEFAULT_PROVIDER\}\}/g, defaultProvider)
      .replace(/\{\{DEFAULT_GENERATE_MODE\}\}/g, defaultGenerateMode)
      .replace(/\{\{OLLAMA_DEFAULT_HOST\}\}/g, ollamaDefaultHost);
  }
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
