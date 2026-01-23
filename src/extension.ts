import * as vscode from 'vscode';
import { exec } from 'child_process';
import * as path from 'path';
import { SidePanelProvider } from './SidePanelProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('Auto-Commit extension is now active!');

    // Create an output channel for debugging
    const outputChannel = vscode.window.createOutputChannel("Auto-Commit Debug");
    context.subscriptions.push(outputChannel);

    // Register the Side Panel Provider
    const provider = new SidePanelProvider(context.extensionUri, context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(SidePanelProvider.viewType, provider)
    );

    let disposable = vscode.commands.registerCommand('auto-commit.generate', async () => {
        outputChannel.appendLine('Starting auto-commit generation...');
        
        // Get the Git extension
        const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
        if (!gitExtension) {
            outputChannel.appendLine('Error: Git extension not found.');
            vscode.window.showErrorMessage('Git extension not found.');
            return;
        }

        const api = gitExtension.getAPI(1);
        outputChannel.appendLine(`Git API version: ${api.version ? api.version : 'unknown'}`);

        // Find the repository
        // We try to match the repository with the current workspace folder if possible
        let repository = null;
        if (api.repositories.length > 0) {
            outputChannel.appendLine(`Found ${api.repositories.length} repositories.`);
            repository = api.repositories[0];
            outputChannel.appendLine(`Selected repository root: ${repository.rootUri.fsPath}`);
        } else {
            outputChannel.appendLine('No repositories found in API.');
        }

        if (!repository) {
            vscode.window.showErrorMessage('No git repository found.');
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Generating commit message...",
            cancellable: false
        }, async (progress) => {
            return new Promise(async (resolve, reject) => {
                // Use the bundled executable
                const exePath = path.join(context.extensionPath, 'auto-commit.exe');
                
                outputChannel.appendLine(`Executable Path: ${exePath}`);

                const cmd = `"${exePath}" generate --print-only`;
                outputChannel.appendLine(`Executing command: ${cmd}`);

                // Prepare environment variables
                const env = { ...process.env };
                const apiKey = await context.secrets.get('GEMINI_API_KEY');
                if (apiKey) {
                    outputChannel.appendLine('Injecting GEMINI_API_KEY from secure storage.');
                    env['GEMINI_API_KEY'] = apiKey;
                } else {
                    outputChannel.appendLine('No GEMINI_API_KEY found in secure storage. Relying on system/file env.');
                }

                // Execute in the repository root to ensure git commands work
                // We also need to make sure the environment variables are passed correctly if needed
                exec(cmd, { cwd: repository.rootUri.fsPath, env: env }, (error, stdout, stderr) => {
                    if (error) {
                        outputChannel.appendLine(`Exec Error: ${error.message}`);
                        outputChannel.appendLine(`Stderr: ${stderr}`);
                        vscode.window.showErrorMessage(`Auto-Commit Error: Check "Auto-Commit Debug" output channel.`);
                        resolve(null);
                        return;
                    }

                    outputChannel.appendLine(`Stdout raw: ${stdout}`);
                    if (stderr) {
                        outputChannel.appendLine(`Stderr: ${stderr}`);
                    }

                    const message = stdout.trim();
                    if (message) {
                        outputChannel.appendLine(`Generated message: ${message}`);
                        repository.inputBox.value = message;
                        vscode.window.showInformationMessage('Commit message filled!');
                    } else {
                        outputChannel.appendLine('Stdout was empty after trim.');
                        vscode.window.showWarningMessage('Generated message was empty. Check "Auto-Commit Debug" output.');
                    }
                    resolve(null);
                });
            });
        });
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}
