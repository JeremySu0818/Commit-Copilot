import * as vscode from 'vscode';
import { SidePanelProvider } from './side-panel-provider';
import {
  generateCommitMessage,
  EXIT_CODES,
  ERROR_MESSAGES,
  CommitCopilotError,
} from './commit-copilot';
import {
  APIProvider,
  API_KEY_STORAGE_KEYS,
  CommitOutputOptions,
  DEFAULT_COMMIT_OUTPUT_OPTIONS,
  DEFAULT_GENERATE_MODE,
  DEFAULT_PROVIDER,
  GenerateMode,
  PROVIDER_DISPLAY_NAMES,
  normalizeCommitOutputOptions,
} from './models';
import { GenerationStateManager } from './state';

type GenerateCommandArg =
  | vscode.SourceControl
  | {
      sourceControl?: vscode.SourceControl;
      generateMode?: GenerateMode;
      commitOutputOptions?: CommitOutputOptions;
    };

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

export function activate(context: vscode.ExtensionContext) {
  console.log('Commit-Copilot extension is now active!');

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

  let disposable = vscode.commands.registerCommand(
    'commit-copilot.generate',
    async (arg?: GenerateCommandArg) => {
      const cancellationSource = new vscode.CancellationTokenSource();
      let wasCancelled = false;
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
          `[${new Date().toISOString()}] Starting commit-copilot generation...`,
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

        const gitExtension =
          vscode.extensions.getExtension('vscode.git')?.exports;
        if (!gitExtension) {
          outputChannel.appendLine('Error: Git extension not found.');
          vscode.window.showErrorMessage(
            'Git extension not found. Please ensure Git is installed and the Git extension is enabled.',
          );
          return;
        }

        const api = gitExtension.getAPI(1);

        let repository = null;
        if (scm) {
          repository = api.repositories.find(
            (r: any) => r.rootUri.toString() === scm.rootUri?.toString(),
          );
          if (repository) {
            outputChannel.appendLine(
              `Selected repository from SCM context: ${repository.rootUri.fsPath}`,
            );
          }
        }

        if (!repository) {
          const activeEditor = vscode.window.activeTextEditor;
          const activeUri = activeEditor?.document?.uri;
          if (activeUri) {
            if (typeof api.getRepository === 'function') {
              repository = api.getRepository(activeUri);
            }
            if (!repository) {
              const activeUriString = activeUri.toString();
              repository = api.repositories.find((r: any) =>
                activeUriString.startsWith(r.rootUri.toString()),
              );
            }
            if (repository) {
              outputChannel.appendLine(
                `Selected repository from active editor: ${repository.rootUri.fsPath}`,
              );
            } else {
              outputChannel.appendLine(
                'No repository matched the active editor.',
              );
            }
          } else {
            outputChannel.appendLine(
              'No active editor found for repository selection.',
            );
          }
        }

        if (!repository) {
          if (api.repositories.length === 1) {
            repository = api.repositories[0];
            outputChannel.appendLine(
              `Selected only repository: ${repository.rootUri.fsPath}`,
            );
          } else if (api.repositories.length > 1) {
            outputChannel.appendLine(
              `Found ${api.repositories.length} repositories but could not determine the active one.`,
            );
            vscode.window.showWarningMessage(
              'Multiple Git repositories found. Please focus a file in the target repository or run from the SCM view.',
            );
            return;
          } else {
            outputChannel.appendLine('No repositories found in API.');
          }
        }

        if (!repository) {
          vscode.window.showErrorMessage(
            'No Git repository found. Please open a folder containing a Git repository.',
          );
          return;
        }

        const currentProvider =
          context.globalState.get<APIProvider>('CURRENT_PROVIDER') ||
          DEFAULT_PROVIDER;
        const savedGenerateMode =
          context.globalState.get<GenerateMode>('GENERATE_MODE') ||
          DEFAULT_GENERATE_MODE;
        const savedCommitOutputOptions = normalizeCommitOutputOptions(
          context.globalState.get<CommitOutputOptions>(
            'COMMIT_OUTPUT_OPTIONS',
          ) || DEFAULT_COMMIT_OUTPUT_OPTIONS,
        );
        const currentGenerateMode: GenerateMode =
          currentProvider === 'ollama'
            ? 'direct-diff'
            : (requestedGenerateMode ?? savedGenerateMode);
        const currentCommitOutputOptions =
          requestedCommitOutputOptions ?? savedCommitOutputOptions;
        const storageKey = API_KEY_STORAGE_KEYS[currentProvider];
        const apiKey = await context.secrets.get(storageKey);

        outputChannel.appendLine(
          `Using provider: ${PROVIDER_DISPLAY_NAMES[currentProvider]}`,
        );
        outputChannel.appendLine(`Generation mode: ${currentGenerateMode}`);
        outputChannel.appendLine(
          `Commit output options: ${JSON.stringify(currentCommitOutputOptions)}`,
        );

        if (!apiKey && currentProvider !== 'ollama') {
          outputChannel.appendLine(
            `Warning: No API Key found for ${currentProvider}.`,
          );
          const setKeyAction = 'Configure API Key';
          const result = await vscode.window.showWarningMessage(
            `${PROVIDER_DISPLAY_NAMES[currentProvider]} API Key is not configured. Please set your API Key in the Commit-Copilot panel first.`,
            setKeyAction,
          );

          if (result === setKeyAction) {
            await vscode.commands.executeCommand('commit-copilot.view.focus');
          }
          return;
        }

        const progressTitle =
          currentProvider === 'ollama'
            ? 'Ollama'
            : `${PROVIDER_DISPLAY_NAMES[currentProvider]}`;

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: progressTitle,
            cancellable: true,
          },
          async (progress, progressToken) => {
            const cancelSubscription = progressToken.onCancellationRequested(
              () => {
                wasCancelled = true;
                outputChannel.appendLine('Cancellation requested from progress UI.');
                cancellationSource.cancel();
              },
            );
            outputChannel.appendLine('Calling generateCommitMessage...');
            outputChannel.appendLine(
              `Repository path: ${repository.rootUri.fsPath}`,
            );

            const savedModel = context.globalState.get<string>(
              `${currentProvider.toUpperCase()}_MODEL`,
            );
            if (savedModel) {
              outputChannel.appendLine(`Using model: ${savedModel}`);
            }
            const reportProgress = (message: string, increment?: number) => {
              outputChannel.appendLine(message);
              progress.report({ message, increment });
            };
            const baseGenerateOptions = {
              repository,
              provider: currentProvider,
              apiKey: apiKey || '',
              generateMode: currentGenerateMode,
              commitOutputOptions: currentCommitOutputOptions,
              model: savedModel,
              onProgress: reportProgress,
              cancellationToken: cancellationSource.token,
            };

            try {
              let result = await generateCommitMessage({
                ...baseGenerateOptions,
                stageChanges: false,
              });

              if (result.error?.exitCode === EXIT_CODES.MIXED_CHANGES) {
                const selection = await vscode.window.showInformationMessage(
                  'You have both staged and unstaged changes. How would you like to proceed?',
                  'Stage All & Generate',
                  'Proceed with Staged Only',
                  'Cancel',
                );

                if (selection === 'Stage All & Generate') {
                  result = await generateCommitMessage({
                    ...baseGenerateOptions,
                    stageChanges: true,
                  });
                } else if (selection === 'Proceed with Staged Only') {
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
                  'No staged changes detected. Untracked files found. Would you like to stage all files (including untracked) or generate only for tracked modified files?',
                  'Stage & Generate All',
                  'Generate Tracked Only',
                );

                if (selection === 'Stage & Generate All') {
                  result = await generateCommitMessage({
                    ...baseGenerateOptions,
                    stageChanges: true,
                  });
                } else if (selection === 'Generate Tracked Only') {
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
                  'Only untracked files are present with no tracked modifications. Do you want to stage and track these new files to generate a commit?',
                  'Stage & Track',
                  'Cancel',
                );

                if (selection === 'Stage & Track') {
                  result = await generateCommitMessage({
                    ...baseGenerateOptions,
                    stageChanges: true,
                  });
                } else {
                  return;
                }
              }

              if (result.error?.exitCode === EXIT_CODES.CANCELLED) {
                wasCancelled = true;
                return;
              }

              if (result.success && result.message) {
                outputChannel.appendLine(`Generated message: ${result.message}`);
                repository.inputBox.value = result.message;
                await vscode.commands.executeCommand('workbench.view.scm');
                vscode.window.showInformationMessage('Commit message generated!');
              } else if (result.error) {
                const error = result.error;
                outputChannel.appendLine(
                  `Error: ${error.errorCode} - ${error.message}`,
                );

                const errorInfo =
                  ERROR_MESSAGES[error.exitCode] ||
                  ERROR_MESSAGES[EXIT_CODES.UNKNOWN_ERROR];

                if (
                  error.exitCode === EXIT_CODES.API_KEY_MISSING ||
                  error.exitCode === EXIT_CODES.API_KEY_INVALID
                ) {
                  const action = await vscode.window.showErrorMessage(
                    `${errorInfo.title}: ${error.message}`,
                    'Configure API Key',
                  );
                  if (action === 'Configure API Key') {
                    vscode.commands.executeCommand('commit-copilot.view.focus');
                  }
                } else if (error.exitCode === EXIT_CODES.QUOTA_EXCEEDED) {
                  const action = await vscode.window.showErrorMessage(
                    `${errorInfo.title}: ${error.message}`,
                    'View Provider Console',
                  );
                  if (action === 'View Provider Console') {
                    const providerUrls: Record<APIProvider, string> = {
                      google: 'https://aistudio.google.com/',
                      openai: 'https://platform.openai.com/usage',
                      anthropic: 'https://console.anthropic.com/',
                      ollama: 'http://127.0.0.1:11434',
                    };
                    vscode.env.openExternal(
                      vscode.Uri.parse(providerUrls[currentProvider]),
                    );
                  }
                } else if (error.exitCode === EXIT_CODES.NO_CHANGES) {
                  vscode.window.showInformationMessage(
                    'No changes to commit. Make some changes first!',
                  );
                } else if (
                  error.exitCode !== EXIT_CODES.NO_CHANGES_BUT_UNTRACKED &&
                  error.exitCode !== EXIT_CODES.NO_TRACKED_CHANGES_BUT_UNTRACKED
                ) {
                  vscode.window.showErrorMessage(
                    `${errorInfo.title}: ${error.message}. ${errorInfo.action || ''}`,
                  );
                }
              }
            } finally {
              cancelSubscription.dispose();
            }
          },
        );
        if (wasCancelled || cancellationSource.token.isCancellationRequested) {
          vscode.window.showInformationMessage(
            'Commit message generation canceled.',
          );
        }
      } catch (error) {
        const isCancellationError =
          error instanceof CommitCopilotError &&
          error.exitCode === EXIT_CODES.CANCELLED;
        if (isCancellationError || cancellationSource.token.isCancellationRequested) {
          vscode.window.showInformationMessage(
            'Commit message generation canceled.',
          );
        } else {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          outputChannel.appendLine(`Unexpected error: ${errorMessage}`);
          vscode.window.showErrorMessage(
            `Commit-Copilot failed: ${errorMessage}`,
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

  context.subscriptions.push(disposable);
  context.subscriptions.push(cancelDisposable);
}

let currentGenerationCancellationSource: vscode.CancellationTokenSource | null =
  null;

export function deactivate() {}
