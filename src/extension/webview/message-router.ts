import type * as vscode from 'vscode';

import {
  asIncomingMessage,
  IncomingMessage,
} from '../../shared/webview-protocol';

export type MessageHandler = (message: IncomingMessage) => void | Promise<void>;

export interface MessageRouterOptions {
  handlers: Partial<Record<IncomingMessage['type'], MessageHandler>>;
}

export class MessageRouter {
  constructor(private readonly options: MessageRouterOptions) {}

  register(webview: vscode.Webview): vscode.Disposable {
    return webview.onDidReceiveMessage(async (data: unknown) => {
      const message = asIncomingMessage(data);
      if (!message) {
        return;
      }
      const handler = this.options.handlers[message.type];
      if (handler) {
        await handler(message);
      }
    });
  }
}
