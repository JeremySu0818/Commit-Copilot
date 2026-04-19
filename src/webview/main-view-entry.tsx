import React from 'react';
import { createRoot } from 'react-dom/client';

import type { WebviewBootstrapData } from '../main-view-webview-bootstrap';

import { MainViewApp } from './main-view-app';
import './main-view.css';

declare global {
  interface Window {
    __COMMIT_COPILOT_WEBVIEW_BOOTSTRAP__?: WebviewBootstrapData;
  }
}

const vscode = acquireVsCodeApi();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Missing #root element for Commit-Copilot webview');
}

const bootstrap = window.__COMMIT_COPILOT_WEBVIEW_BOOTSTRAP__;
if (!bootstrap) {
  throw new Error('Missing webview bootstrap data');
}

createRoot(rootElement).render(
  <MainViewApp bootstrap={bootstrap} vscode={vscode} />,
);
