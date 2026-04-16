import * as vscode from 'vscode';
import { SidePanelProvider } from './side-panel-provider';
import {
  generateCommitMessage,
  EXIT_CODES,
  CommitCopilotError,
  GitRepository,
} from './commit-copilot';
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
import { GenerationStateManager } from './state';
import {
  DISPLAY_LANGUAGE_STATE_KEY,
  getExtensionText,
  getLocalizedErrorInfo,
  getModelNameRequiredText,
  normalizeDisplayLanguage,
  resolveEffectiveDisplayLanguage,
} from './i18n';

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

function getCurrentLanguage(context: vscode.ExtensionContext) {
  const displayLanguage = normalizeDisplayLanguage(
    context.globalState.get(DISPLAY_LANGUAGE_STATE_KEY),
  );
  return resolveEffectiveDisplayLanguage(displayLanguage, vscode.env.language);
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
        outputChannel.appendLine('='.repeat(50));
        outputChannel.appendLine(
          text.output.generationStart(new Date().toISOString()),
        );

        let scm: vscode.SourceControl | undefined;
        let requestedGenerateMode: GenerateMode | undefined;
        let requestedCommitOutputOptions: CommitOutputOptions | undefined;
        if (isSourceControl(arg)) {
          scm = arg;
        } else if (arg && typeof arg === 'object') {
          if (isSourceControl(arg.sourceControl)) {
            scm = arg.sourceControl;
          }
          requestedGenerateMode = parseGenerateMode(arg.generateMode);
          requestedCommitOutputOptions = parseCommitOutputOptions(
            arg.commitOutputOptions,
          );
        }

        const gitExtensionExports =
          vscode.extensions.getExtension<unknown>('vscode.git')?.exports;
        if (!isGitExtensionExports(gitExtensionExports)) {
          outputChannel.appendLine(text.output.gitExtensionMissing);
          vscode.window.showErrorMessage(text.notification.gitExtensionMissing);
          return;
        }

        const api = gitExtensionExports.getAPI(1);

        let repository: GitRepository | null = null;
        if (scm) {
          const scmRef = scm;
          repository =
            api.repositories.find(
              (r) => r.rootUri.toString() === scmRef.rootUri?.toString(),
            ) ?? null;
          if (repository) {
            outputChannel.appendLine(
              text.output.selectedRepoFromScm(repository.rootUri.fsPath),
            );
          }
        }

        if (!repository) {
          const activeEditor = vscode.window.activeTextEditor;
          const activeUri = activeEditor?.document.uri;
          if (activeUri) {
            if (typeof api.getRepository === 'function') {
              repository = api.getRepository(activeUri);
            }
            if (!repository) {
              const activeUriString = activeUri.toString();
              repository =
                api.repositories.find((r) =>
                  activeUriString.startsWith(r.rootUri.toString()),
                ) ?? null;
            }
            if (repository) {
              outputChannel.appendLine(
                text.output.selectedRepoFromEditor(repository.rootUri.fsPath),
              );
            } else {
              outputChannel.appendLine(text.output.noRepoMatchedActiveEditor);
            }
          } else {
            outputChannel.appendLine(
              text.output.noActiveEditorForRepoSelection,
            );
          }
        }

        if (!repository) {
          if (api.repositories.length === 1) {
            repository = api.repositories[0];
            outputChannel.appendLine(
              text.output.selectedOnlyRepo(repository.rootUri.fsPath),
            );
          } else if (api.repositories.length > 1) {
            outputChannel.appendLine(
              text.output.multiRepoNotDetermined(api.repositories.length),
            );
            vscode.window.showWarningMessage(
              text.notification.multiRepoWarning,
            );
            return;
          } else {
            outputChannel.appendLine(text.output.noRepoInApi);
          }
        }

        if (!repository) {
          vscode.window.showErrorMessage(text.notification.repoNotFound);
          return;
        }

        const currentProviderRaw =
          context.globalState.get<string>('CURRENT_PROVIDER') ??
          DEFAULT_PROVIDER;
        const isCustom = isCustomProvider(currentProviderRaw);
        let customProviderConfig: CustomProviderConfig | undefined;
        let currentProvider: APIProvider;
        if (isCustom) {
          const customId = getCustomProviderId(currentProviderRaw);
          const customProviders =
            context.globalState.get<CustomProviderConfig[]>(
              CUSTOM_PROVIDERS_STATE_KEY,
            ) ?? [];
          customProviderConfig = customProviders.find(
            (cp) => cp.id === customId,
          );
          currentProvider = 'openai';
        } else {
          currentProvider = currentProviderRaw as APIProvider;
        }
        const savedGenerateMode =
          context.globalState.get<GenerateMode>('GENERATE_MODE') ??
          DEFAULT_GENERATE_MODE;
        const savedCommitOutputOptions = normalizeCommitOutputOptions(
          context.globalState.get<CommitOutputOptions>(
            'COMMIT_OUTPUT_OPTIONS',
          ) ?? DEFAULT_COMMIT_OUTPUT_OPTIONS,
        );
        const currentGenerateMode: GenerateMode =
          currentProvider === 'ollama'
            ? 'direct-diff'
            : (requestedGenerateMode ?? savedGenerateMode);
        const currentCommitOutputOptions =
          requestedCommitOutputOptions ?? savedCommitOutputOptions;
        const savedMaxAgentSteps = normalizeMaxAgentStepsValue(
          context.globalState.get<number | string | null>(
            MAX_AGENT_STEPS_STATE_KEY,
          ),
        );
        const maxAgentSteps =
          savedMaxAgentSteps > 0 ? savedMaxAgentSteps : undefined;

        let apiKey: string | undefined;
        if (isCustom) {
          const customId = getCustomProviderId(currentProviderRaw);
          apiKey = await context.secrets.get(
            getCustomProviderStorageKey(customId),
          );
        } else {
          const storageKey = API_KEY_STORAGE_KEYS[currentProvider];
          apiKey = await context.secrets.get(storageKey);
        }

        const providerDisplayName =
          isCustom && customProviderConfig
            ? customProviderConfig.name
            : PROVIDER_DISPLAY_NAMES[currentProvider];

        outputChannel.appendLine(
          text.output.usingProvider(providerDisplayName),
        );
        outputChannel.appendLine(
          text.output.usingGenerateMode(currentGenerateMode),
        );
        outputChannel.appendLine(
          text.output.usingCommitOutputOptions(
            JSON.stringify(currentCommitOutputOptions),
          ),
        );

        if (!apiKey && currentProvider !== 'ollama') {
          outputChannel.appendLine(
            text.output.missingApiKeyWarning(currentProvider),
          );
          const setKeyAction = text.notification.configureApiKeyAction;
          const result = await vscode.window.showWarningMessage(
            text.notification.apiKeyMissing(providerDisplayName),
            setKeyAction,
          );

          if (result === setKeyAction) {
            await vscode.commands.executeCommand('commit-copilot.view.focus');
          }
          return;
        }

        let savedModel: string | undefined;
        if (isCustom) {
          const customId = getCustomProviderId(currentProviderRaw);
          savedModel = context.globalState.get<string>(
            `CUSTOM_${customId}_MODEL`,
          );
        } else {
          savedModel = context.globalState.get<string>(
            `${currentProvider.toUpperCase()}_MODEL`,
          );
        }

        if (isCustom && !savedModel) {
          vscode.window.showWarningMessage(getModelNameRequiredText(language));
          await vscode.commands.executeCommand('commit-copilot.view.focus');
          return;
        }

        const progressTitle =
          currentProvider === 'ollama' ? 'Ollama' : providerDisplayName;

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: progressTitle,
            cancellable: true,
          },
          async (progress, progressToken) => {
            const cancelSubscription = progressToken.onCancellationRequested(
              () => {
                outputChannel.appendLine(
                  text.output.cancelRequestedFromProgress,
                );
                cancellationSource.cancel();
              },
            );
            outputChannel.appendLine(text.output.callingGenerateCommitMessage);
            outputChannel.appendLine(
              text.output.repositoryPath(repository.rootUri.fsPath),
            );

            if (savedModel) {
              outputChannel.appendLine(text.output.usingModel(savedModel));
            }
            const reportProgress = (message: string, increment?: number) => {
              outputChannel.appendLine(message);
              progress.report({ message, increment });
            };
            const baseGenerateOptions = {
              repository,
              provider: currentProvider,
              apiKey: apiKey ?? '',
              baseUrl: customProviderConfig?.baseUrl,
              generateMode: currentGenerateMode,
              commitOutputOptions: currentCommitOutputOptions,
              maxAgentSteps,
              model: savedModel,
              onProgress: reportProgress,
              cancellationToken: cancellationSource.token,
              language,
            };

            try {
              let result = await generateCommitMessage({
                ...baseGenerateOptions,
                stageChanges: false,
              });

              if (result.error?.exitCode === EXIT_CODES.MIXED_CHANGES) {
                const selection = await vscode.window.showInformationMessage(
                  text.notification.mixedChangesQuestion,
                  text.notification.stageAllAndGenerate,
                  text.notification.proceedStagedOnly,
                  text.notification.cancel,
                );

                if (selection === text.notification.stageAllAndGenerate) {
                  result = await generateCommitMessage({
                    ...baseGenerateOptions,
                    stageChanges: true,
                  });
                } else if (selection === text.notification.proceedStagedOnly) {
                  result = await generateCommitMessage({
                    ...baseGenerateOptions,
                    stageChanges: false,
                    proceedWithStagedOnly: true,
                  });
                } else {
                  return;
                }
              }

              if (
                result.error?.exitCode === EXIT_CODES.NO_CHANGES_BUT_UNTRACKED
              ) {
                const selection = await vscode.window.showInformationMessage(
                  text.notification.noStagedButUntrackedQuestion,
                  text.notification.stageAndGenerateAll,
                  text.notification.generateTrackedOnly,
                );

                if (selection === text.notification.stageAndGenerateAll) {
                  result = await generateCommitMessage({
                    ...baseGenerateOptions,
                    stageChanges: true,
                  });
                } else if (
                  selection === text.notification.generateTrackedOnly
                ) {
                  result = await generateCommitMessage({
                    ...baseGenerateOptions,
                    stageChanges: false,
                    ignoreUntracked: true,
                  });
                }
              } else if (
                result.error?.exitCode ===
                EXIT_CODES.NO_TRACKED_CHANGES_BUT_UNTRACKED
              ) {
                const selection = await vscode.window.showInformationMessage(
                  text.notification.onlyUntrackedQuestion,
                  text.notification.stageAndTrack,
                  text.notification.cancel,
                );

                if (selection === text.notification.stageAndTrack) {
                  result = await generateCommitMessage({
                    ...baseGenerateOptions,
                    stageChanges: true,
                  });
                } else {
                  return;
                }
              }

              if (result.error?.exitCode === EXIT_CODES.CANCELLED) {
                return;
              }

              if (result.success && result.message) {
                outputChannel.appendLine(
                  text.output.generatedMessage(result.message),
                );
                repository.inputBox.value = result.message;
                await vscode.commands.executeCommand('workbench.view.scm');
                vscode.window.showInformationMessage(
                  text.notification.commitGenerated,
                );
              } else if (result.error) {
                const error = result.error;
                outputChannel.appendLine(
                  text.output.generationError(error.errorCode, error.message),
                );

                const errorInfo = getLocalizedErrorInfo(
                  language,
                  error.exitCode,
                );

                if (
                  error.exitCode === EXIT_CODES.API_KEY_MISSING ||
                  error.exitCode === EXIT_CODES.API_KEY_INVALID
                ) {
                  const action = await vscode.window.showErrorMessage(
                    `${errorInfo.title}: ${error.message}`,
                    text.notification.configureApiKeyAction,
                  );
                  if (action === text.notification.configureApiKeyAction) {
                    void vscode.commands.executeCommand(
                      'commit-copilot.view.focus',
                    );
                  }
                } else if (error.exitCode === EXIT_CODES.QUOTA_EXCEEDED) {
                  const action = await vscode.window.showErrorMessage(
                    `${errorInfo.title}: ${error.message}`,
                    text.notification.viewProviderConsoleAction,
                  );
                  if (action === text.notification.viewProviderConsoleAction) {
                    const providerUrls: Record<APIProvider, string> = {
                      google: 'https://aistudio.google.com/',
                      openai: 'https://platform.openai.com/usage',
                      anthropic: 'https://console.anthropic.com/',
                      ollama: 'http://127.0.0.1:11434',
                    };
                    const url =
                      isCustom && customProviderConfig
                        ? customProviderConfig.baseUrl
                        : providerUrls[currentProvider];
                    vscode.env.openExternal(vscode.Uri.parse(url));
                  }
                } else if (error.exitCode === EXIT_CODES.NO_CHANGES) {
                  vscode.window.showInformationMessage(
                    text.notification.noChanges,
                  );
                } else if (
                  error.exitCode !== EXIT_CODES.NO_CHANGES_BUT_UNTRACKED &&
                  error.exitCode !== EXIT_CODES.NO_TRACKED_CHANGES_BUT_UNTRACKED
                ) {
                  vscode.window.showErrorMessage(
                    `${errorInfo.title}: ${error.message}. ${errorInfo.action ?? ''}`,
                  );
                }
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
        }
      } catch (error) {
        const isCancellationError =
          error instanceof CommitCopilotError &&
          error.exitCode === EXIT_CODES.CANCELLED;
        if (
          isCancellationError ||
          cancellationSource.token.isCancellationRequested
        ) {
          vscode.window.showInformationMessage(
            text.notification.generationCanceled,
          );
        } else {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          outputChannel.appendLine(text.output.unexpectedError(errorMessage));
          vscode.window.showErrorMessage(
            `${text.notification.failedPrefix}: ${errorMessage}`,
          );
        }
      } finally {
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
  context.subscriptions.push(cancelDisposable);
}

let currentGenerationCancellationSource: vscode.CancellationTokenSource | null =
  null;

export function deactivate(): void {
  currentGenerationCancellationSource = null;
}
