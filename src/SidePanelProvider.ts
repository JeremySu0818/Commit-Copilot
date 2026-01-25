import * as vscode from "vscode";
import { GEMINI_MODELS } from "./models";

export class SidePanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "auto-commit.view";
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext,
  ) {}

  private async validateApiKey(
    apiKey: string,
  ): Promise<{ valid: boolean; error?: string; models?: string[] }> {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (response.ok) {
        return { valid: true, models: GEMINI_MODELS };
      }

      const errorData = (await response.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      const errorMessage = errorData?.error?.message || response.statusText;

      if (
        response.status === 400 ||
        response.status === 401 ||
        response.status === 403
      ) {
        return { valid: false, error: `Invalid API Key: ${errorMessage}` };
      } else if (response.status === 429) {
        return { valid: false, error: `API quota exceeded: ${errorMessage}` };
      } else {
        return {
          valid: false,
          error: `API request failed (${response.status}): ${errorMessage}`,
        };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return { valid: false, error: `Connection error: ${errorMessage}` };
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

    const checkGitStatus = () => {
      const gitExtension =
        vscode.extensions.getExtension<any>("vscode.git")?.exports;
      if (!gitExtension) {
        return;
      }

      const git = gitExtension.getAPI(1);
      if (git.repositories.length > 0) {
        const repo = git.repositories[0];
        const hasChanges =
          repo.state.workingTreeChanges.length > 0 ||
          repo.state.indexChanges.length > 0;
        webviewView.webview.postMessage({ type: "repoUpdate", hasChanges });
      } else {
        webviewView.webview.postMessage({
          type: "repoUpdate",
          hasChanges: false,
        });
      }
    };

    const gitExtension = vscode.extensions.getExtension<any>("vscode.git");
    if (gitExtension) {
      const git = gitExtension.exports.getAPI(1);

      const setupRepoListeners = () => {
        if (git.repositories.length > 0) {
          checkGitStatus(); // Check immediately
          git.repositories.forEach((repo: any) => {
            repo.state.onDidChange(() => {
              checkGitStatus();
            });
          });
        }
      };

      if (git.state === "initialized") {
        setupRepoListeners();
      } else {
        git.onDidChangeState((state: any) => {
          if (state === "initialized") {
            setupRepoListeners();
          }
        });
      }

      git.onDidOpenRepository((repo: any) => {
        repo.state.onDidChange(() => {
          checkGitStatus();
        });
        checkGitStatus();
      });

      // Attempt to check immediately in case already initialized
      if (git.repositories.length > 0) {
        setupRepoListeners();
      }
    }

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case "saveKey": {
          if (!data.value) {
            vscode.window.showErrorMessage("API Key cannot be empty");
            this._view?.webview.postMessage({
              type: "validationResult",
              success: false,
            });
            return;
          }

          this._view?.webview.postMessage({ type: "validating" });
          const validationResult = await this.validateApiKey(data.value);

          if (!validationResult.valid) {
            vscode.window.showWarningMessage(
              `API Key validation failed: ${validationResult.error || "Unable to connect to Gemini API"}`,
            );
            this._view?.webview.postMessage({
              type: "validationResult",
              success: false,
              error: validationResult.error,
            });
            return;
          }

          try {
            await this._context.secrets.store("GEMINI_API_KEY", data.value);
            vscode.window.showInformationMessage(
              "API Key validated and saved successfully!",
            );
            this._view?.webview.postMessage({
              type: "validationResult",
              success: true,
              models: validationResult.models,
            });
            this._view?.webview.postMessage({
              type: "keyStatus",
              hasKey: true,
            });
          } catch (e) {
            vscode.window.showErrorMessage("Failed to save API Key");
            this._view?.webview.postMessage({
              type: "validationResult",
              success: false,
            });
          }
          break;
        }
        case "generate": {
          try {
            await vscode.commands.executeCommand("auto-commit.generate");
          } finally {
            this._view?.webview.postMessage({ type: "generationDone" });
          }
          break;
        }
        case "checkKey": {
          const key = await this._context.secrets.get("GEMINI_API_KEY");
          this._view?.webview.postMessage({ type: "keyStatus", hasKey: !!key });
          break;
        }
        case "checkGit": {
          checkGitStatus();
          break;
        }
        case "getModels": {
          const key = await this._context.secrets.get("GEMINI_API_KEY");
          if (key) {
            const result = await this.validateApiKey(key);
            if (result.valid) {
              const savedModel = this._context.globalState.get("GEMINI_MODEL");
              this._view?.webview.postMessage({
                type: "modelsList",
                models: GEMINI_MODELS,
                currentModel: savedModel,
              });
            }
          }
          break;
        }
        case "saveModel": {
          await this._context.globalState.update("GEMINI_MODEL", data.value);
          break;
        }
      }
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Auto Commit</title>
  <style>
    body { font-family: var(--vscode-font-family); padding: 10px; }
    .container { display: flex; flex-direction: column; gap: 15px; }
    .input-group { display: flex; flex-direction: column; gap: 5px; }
    label { font-weight: bold; }
    input { 
      padding: 5px; 
      background: var(--vscode-input-background); 
      color: var(--vscode-input-foreground); 
      border: 1px solid var(--vscode-input-border); 
    }
    button { 
      padding: 8px; 
      background: var(--vscode-button-background); 
      color: var(--vscode-button-foreground); 
      border: none; 
      cursor: pointer; 
    }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button:disabled, select:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    select {
      padding: 5px;
      background: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border: 1px solid var(--vscode-dropdown-border);
    }
    .status { font-size: 0.9em; color: var(--vscode-descriptionForeground); margin-top: 5px; }
    hr { border: 0; border-top: 1px solid var(--vscode-widget-border); width: 100%; }
  </style>
</head>
<body>
  <div class="container">
    <div class="input-group">
      <label>Gemini API Key</label>
      <input type="password" id="apiKey" placeholder="Enter your Gemini API Key">
      <button id="saveBtn" disabled>Save Key</button>
      <span id="keyStatus" class="status">Checking key status...</span>
    </div>

    <div class="input-group">
      <label>Model</label>
      <select id="modelSelect" disabled>
        <option value="" disabled selected>Select a model...</option>
      </select>
    </div>
    
    <hr />

    <div class="input-group">
      <button id="generateBtn" disabled>Generate Commit Message</button>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    
    const saveBtn = document.getElementById('saveBtn');
    const generateBtn = document.getElementById('generateBtn');
    const apiKeyInput = document.getElementById('apiKey');
    const keyStatus = document.getElementById('keyStatus');
    const modelSelect = document.getElementById('modelSelect');

    let isGenerating = false;
    let hasChanges = false;

    function updateGenerateBtn() {
      // Only enable if: NOT generating AND has changes
      if (isGenerating) {
        generateBtn.disabled = true;
        generateBtn.textContent = 'Generating...';
      } else if (!hasChanges) {
        generateBtn.disabled = true;
        generateBtn.textContent = 'Generate Commit Message';
        generateBtn.title = 'No changes detected';
      } else {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate Commit Message';
        generateBtn.title = '';
      }
    }

    // Initial check for saved key
    vscode.postMessage({ type: 'checkKey' });
    vscode.postMessage({ type: 'checkGit' });

    // Save Button Logic
    apiKeyInput.addEventListener('input', () => {
      saveBtn.disabled = !apiKeyInput.value.trim();
    });

    saveBtn.addEventListener('click', () => {
      const key = apiKeyInput.value;
      if(key) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Validating...';
        keyStatus.textContent = 'Validating API Key...';
        keyStatus.style.color = 'var(--vscode-descriptionForeground)';
        vscode.postMessage({ type: 'saveKey', value: key });
      }
    });

    // Generate Button Logic
    generateBtn.addEventListener('click', () => {
      isGenerating = true;
      updateGenerateBtn();
      vscode.postMessage({ 
        type: 'generate'
      });
    });

    window.addEventListener('message', event => {
      const message = event.data;
      switch (message.type) {
        case 'repoUpdate':
          hasChanges = message.hasChanges;
          updateGenerateBtn();
          break;
        case 'status':
          keyStatus.textContent = message.value;
          break;
        case 'keyStatus':
          if (message.hasKey) {
            keyStatus.textContent = 'API Key is set';
            keyStatus.style.color = 'var(--vscode-testing-iconPassed)';
            vscode.postMessage({ type: 'getModels' });
          } else {
            keyStatus.textContent = 'API Key not set';
            keyStatus.style.color = 'var(--vscode-testing-iconFailed)';
          }
          break;
        case 'modelsList':
          populateModels(message.models, message.currentModel);
          break;
        case 'validating':
          saveBtn.disabled = true;
          saveBtn.textContent = 'Validating...';
          keyStatus.textContent = 'Validating API Key...';
          keyStatus.style.color = 'var(--vscode-descriptionForeground)';
          break;
        case 'validationResult':
          // Re-evaluate button state based on input
          if (message.success) {
            keyStatus.textContent = 'API Key validated and saved!';
            keyStatus.style.color = 'var(--vscode-testing-iconPassed)';
            apiKeyInput.value = '';
            saveBtn.disabled = true; // Input is empty now
            saveBtn.textContent = 'Save Key';
            if (message.models) {
              populateModels(message.models);
            }
          } else {
            keyStatus.textContent = message.error || 'Validation failed';
            keyStatus.style.color = 'var(--vscode-testing-iconFailed)';
            saveBtn.disabled = !apiKeyInput.value.trim(); // Re-enable based on input
            saveBtn.textContent = 'Save Key';
          }
          break;
        case 'generationDone':
          isGenerating = false;
          updateGenerateBtn();
          break;
      }
    });

    function populateModels(models, currentModel) {
        modelSelect.innerHTML = '';
        let foundCurrent = false;
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            if (model === currentModel) {
                option.selected = true;
                foundCurrent = true;
            }
            modelSelect.appendChild(option);
        });
        modelSelect.disabled = false;
        
        if (!foundCurrent && models.length > 0) {
             const preferred = models.find(m => m.includes('gemini-2.5-flash')) || models[0];
             modelSelect.value = preferred;
             vscode.postMessage({ type: 'saveModel', value: preferred });
        }
    }

    modelSelect.addEventListener('change', () => {
        vscode.postMessage({ type: 'saveModel', value: modelSelect.value });
    });
  </script>
</body>
</html>`;
  }
}

function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
