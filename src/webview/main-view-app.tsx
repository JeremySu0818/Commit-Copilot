import React, { useReducer, useMemo } from 'react';

import type { WebviewBootstrapData } from '../main-view-webview-bootstrap';

import {
  MainViewContext,
  createInitialState,
  mainViewStateReducer,
} from './main-view-context';
import { useMainViewMessageHandler } from './main-view-message-handler';
import { AddProviderView } from './views/AddProviderView';
import { MainView } from './views/MainView';
import { RewriteEditorView } from './views/RewriteEditorView';
import { SettingsView } from './views/SettingsView';

interface MainViewAppProps {
  readonly bootstrap: WebviewBootstrapData;
  readonly vscode: VSCodeWebviewApi;
}

export function MainViewApp({ bootstrap, vscode }: MainViewAppProps) {
  const [state, dispatch] = useReducer(
    mainViewStateReducer,
    bootstrap,
    createInitialState,
  );

  useMainViewMessageHandler(vscode, bootstrap, state, dispatch);

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
    <MainViewContext.Provider value={contextValue}>
      {activeView}
    </MainViewContext.Provider>
  );
}
