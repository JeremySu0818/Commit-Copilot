import React, { useReducer, useMemo } from 'react';
import type { WebviewBootstrapData } from '../side-panel-webview-bootstrap';
import {
  SidePanelContext,
  createInitialState,
  sidePanelReducer,
} from './side-panel-context';
import { useMessageHandler } from './use-message-handler';
import { MainView } from './views/MainView';
import { SettingsView } from './views/SettingsView';
import { AddProviderView } from './views/AddProviderView';

interface AppProps {
  bootstrap: WebviewBootstrapData;
  vscode: VSCodeWebviewApi;
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

  return (
    <SidePanelContext.Provider value={contextValue}>
      <MainView />
      <SettingsView />
      <AddProviderView />
    </SidePanelContext.Provider>
  );
}
