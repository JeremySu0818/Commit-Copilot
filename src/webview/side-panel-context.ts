import { createContext, useContext } from 'react';
import './globals.d.ts';
import type { WebviewBootstrapData } from '../side-panel-webview-bootstrap';
import type {
  CommitOutputOptions,
  CustomProviderConfig,
  GenerateMode,
  ModelConfig,
} from '../models';
import type {
  DisplayLanguage,
  EffectiveDisplayLanguage,
  WebviewLanguagePack,
} from '../i18n';

export type Screen = 'main' | 'settings' | 'addProvider';

export interface ModelState {
  models: ModelConfig[];
  currentModel: string;
  allowCustomModel: boolean;
  customModelValue: string;
  disabled: boolean;
}

export interface AddProviderDraft {
  editingId: string | null;
  originalName: string;
  originalBaseUrl: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  statusHtml: string;
}

export interface SidePanelState {
  screen: Screen;
  currentProvider: string;
  currentGenerateMode: GenerateMode;
  preferredGenerateMode: GenerateMode;
  isGenerating: boolean;
  pendingStatusCheck: boolean;
  hasChanges: boolean;
  commitOutputOptions: CommitOutputOptions;
  displayLanguage: DisplayLanguage;
  effectiveLanguage: EffectiveDisplayLanguage;
  currentPack: WebviewLanguagePack;
  providerKeyStatuses: Record<string, boolean>;
  ollamaStoredHost: string;
  modelState: ModelState;
  customProviders: CustomProviderConfig[];
  currentMaxAgentSteps: number;
  addProviderDraft: AddProviderDraft;
  keyStatusHtml: string;
  languageStatusHtml: string;
  saveBtnDisabled: boolean;
  saveBtnText: string;
  apiKeyValue: string;
  apiKeyType: string;
}

export type SidePanelAction =
  | { type: 'SET_SCREEN'; screen: Screen }
  | { type: 'SET_PROVIDER'; provider: string }
  | { type: 'SET_GENERATE_MODE'; mode: GenerateMode }
  | { type: 'SET_PREFERRED_GENERATE_MODE'; mode: GenerateMode }
  | { type: 'SET_IS_GENERATING'; value: boolean }
  | { type: 'SET_PENDING_STATUS_CHECK'; value: boolean }
  | { type: 'SET_HAS_CHANGES'; value: boolean }
  | { type: 'SET_COMMIT_OUTPUT_OPTIONS'; options: CommitOutputOptions }
  | {
      type: 'SET_LANGUAGE';
      displayLanguage: DisplayLanguage;
      effectiveLanguage: EffectiveDisplayLanguage;
      pack: WebviewLanguagePack;
    }
  | { type: 'SET_KEY_STATUS'; provider: string; hasKey: boolean }
  | { type: 'SET_ALL_KEY_STATUSES'; statuses: Record<string, boolean> }
  | { type: 'SET_OLLAMA_HOST'; host: string }
  | { type: 'SET_MODEL_STATE'; state: ModelState }
  | { type: 'SET_CUSTOM_PROVIDERS'; providers: CustomProviderConfig[] }
  | { type: 'SET_MAX_AGENT_STEPS'; value: number }
  | { type: 'SET_ADD_PROVIDER_DRAFT'; draft: AddProviderDraft }
  | { type: 'UPDATE_ADD_PROVIDER_DRAFT'; partial: Partial<AddProviderDraft> }
  | { type: 'SET_KEY_STATUS_HTML'; html: string }
  | { type: 'SET_LANGUAGE_STATUS_HTML'; html: string }
  | { type: 'SET_SAVE_BTN'; disabled: boolean; text: string }
  | { type: 'SET_API_KEY_VALUE'; value: string }
  | { type: 'SET_API_KEY_TYPE'; inputType: string };

export function createInitialState(
  bootstrap: WebviewBootstrapData,
): SidePanelState {
  const effectiveLang = bootstrap.initialEffectiveLanguage;
  const pack = bootstrap.languagePacks[effectiveLang];
  return {
    screen: bootstrap.initialScreen === 'settings' ? 'settings' : 'main',
    currentProvider: bootstrap.defaultProvider,
    currentGenerateMode: bootstrap.defaultGenerateMode,
    preferredGenerateMode: bootstrap.defaultGenerateMode,
    isGenerating: false,
    pendingStatusCheck: true,
    hasChanges: false,
    commitOutputOptions: bootstrap.defaultCommitOutputOptions,
    displayLanguage: bootstrap.initialDisplayLanguage,
    effectiveLanguage: effectiveLang,
    currentPack: pack,
    providerKeyStatuses: {},
    ollamaStoredHost: bootstrap.ollamaDefaultHost,
    modelState: {
      models: [],
      currentModel: '',
      allowCustomModel: false,
      customModelValue: '',
      disabled: true,
    },
    customProviders: bootstrap.customProviders,
    currentMaxAgentSteps: 0,
    addProviderDraft: {
      editingId: null,
      originalName: '',
      originalBaseUrl: '',
      name: '',
      baseUrl: '',
      apiKey: '',
      statusHtml: '',
    },
    keyStatusHtml: '',
    languageStatusHtml: '',
    saveBtnDisabled: true,
    saveBtnText: pack.buttons.save,
    apiKeyValue: '',
    apiKeyType: 'password',
  };
}

export function sidePanelReducer(
  state: SidePanelState,
  action: SidePanelAction,
): SidePanelState {
  switch (action.type) {
    case 'SET_SCREEN':
      return { ...state, screen: action.screen };
    case 'SET_PROVIDER':
      return { ...state, currentProvider: action.provider };
    case 'SET_GENERATE_MODE':
      return { ...state, currentGenerateMode: action.mode };
    case 'SET_PREFERRED_GENERATE_MODE':
      return { ...state, preferredGenerateMode: action.mode };
    case 'SET_IS_GENERATING':
      return { ...state, isGenerating: action.value };
    case 'SET_PENDING_STATUS_CHECK':
      return { ...state, pendingStatusCheck: action.value };
    case 'SET_HAS_CHANGES':
      return { ...state, hasChanges: action.value };
    case 'SET_COMMIT_OUTPUT_OPTIONS':
      return { ...state, commitOutputOptions: action.options };
    case 'SET_LANGUAGE':
      return {
        ...state,
        displayLanguage: action.displayLanguage,
        effectiveLanguage: action.effectiveLanguage,
        currentPack: action.pack,
      };
    case 'SET_KEY_STATUS':
      return {
        ...state,
        providerKeyStatuses: {
          ...state.providerKeyStatuses,
          [action.provider]: action.hasKey,
        },
      };
    case 'SET_ALL_KEY_STATUSES':
      return { ...state, providerKeyStatuses: action.statuses };
    case 'SET_OLLAMA_HOST':
      return { ...state, ollamaStoredHost: action.host };
    case 'SET_MODEL_STATE':
      return { ...state, modelState: action.state };
    case 'SET_CUSTOM_PROVIDERS':
      return { ...state, customProviders: action.providers };
    case 'SET_MAX_AGENT_STEPS':
      return { ...state, currentMaxAgentSteps: action.value };
    case 'SET_ADD_PROVIDER_DRAFT':
      return { ...state, addProviderDraft: action.draft };
    case 'UPDATE_ADD_PROVIDER_DRAFT':
      return {
        ...state,
        addProviderDraft: { ...state.addProviderDraft, ...action.partial },
      };
    case 'SET_KEY_STATUS_HTML':
      return { ...state, keyStatusHtml: action.html };
    case 'SET_LANGUAGE_STATUS_HTML':
      return { ...state, languageStatusHtml: action.html };
    case 'SET_SAVE_BTN':
      return {
        ...state,
        saveBtnDisabled: action.disabled,
        saveBtnText: action.text,
      };
    case 'SET_API_KEY_VALUE':
      return { ...state, apiKeyValue: action.value };
    case 'SET_API_KEY_TYPE':
      return { ...state, apiKeyType: action.inputType };
    default:
      return state;
  }
}

export interface SidePanelContextValue {
  state: SidePanelState;
  dispatch: React.Dispatch<SidePanelAction>;
  vscode: VSCodeWebviewApi;
  bootstrap: WebviewBootstrapData;
}

export const SidePanelContext = createContext<
  SidePanelContextValue | undefined
>(undefined);

export function useSidePanel(): SidePanelContextValue {
  const context = useContext(SidePanelContext);
  if (!context) {
    throw new Error('SidePanelContext is not available.');
  }
  return context;
}
