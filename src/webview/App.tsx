import React, { useReducer, useMemo } from 'react';

import type { WebviewBootstrapData } from '../side-panel-webview-bootstrap';

import {
  SidePanelContext,
  createInitialState,
  sidePanelReducer,
} from './side-panel-context';
import { useMessageHandler } from './use-message-handler';
import { AddProviderView } from './views/AddProviderView';
import { MainView } from './views/MainView';
import { RewriteEditorView } from './views/RewriteEditorView';
import { SettingsView } from './views/SettingsView';

interface AppProps {
  readonly bootstrap: WebviewBootstrapData;
  readonly vscode: VSCodeWebviewApi;
}

export function App({ bootstrap, vscode }: AppProps) {
  const [state, dispatch] = useReducer(
    sidePanelReducer,
    bootstrap,
    createInitialState,
  );

  useMessageHandler(vscode, bootstrap, state, dispatch);

  const contextValue = useMemo(
    () => ({
      state,
      dispatch,
      vscode,
      bootstrap,
    }),
    [state, dispatch, vscode, bootstrap],
  );

  const activeView = (() => {
    if (state.screen === 'settings') {
      return <SettingsView />;
    }
    if (state.screen === 'addProvider') {
      return <AddProviderView />;
    }
    if (state.screen === 'rewriteEditor') {
      return <RewriteEditorView />;
    }
    return <MainView />;
  })();

  return (
    <SidePanelContext.Provider value={contextValue}>
      {activeView}
    </SidePanelContext.Provider>
  );
}
