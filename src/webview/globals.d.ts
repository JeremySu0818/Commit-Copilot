interface VSCodeWebviewApi {
  postMessage(message: unknown): void;
  setState?(newState: unknown): void;
  getState?(): unknown;
}

declare function acquireVsCodeApi(): VSCodeWebviewApi;
