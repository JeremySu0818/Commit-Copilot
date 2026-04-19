import type {
  DisplayLanguage,
  EffectiveDisplayLanguage,
  LanguageOption,
  WebviewLanguagePack,
} from './i18n';
import type {
  APIProvider,
  CommitOutputOptions,
  CustomProviderConfig,
  GenerateMode,
  ModelConfig,
} from './models';

export type MainViewScreen =
  | 'main'
  | 'settings'
  | 'addProvider'
  | 'advanced'
  | 'rewriteEditor';

export interface WebviewBootstrapData {
  providers: Record<APIProvider, string>;
  generateModes: Record<GenerateMode, string>;
  modelsByProvider: Record<APIProvider, ModelConfig[]>;
  defaultModels: Record<APIProvider, string>;
  defaultProvider: APIProvider;
  defaultGenerateMode: GenerateMode;
  defaultCommitOutputOptions: CommitOutputOptions;
  ollamaDefaultHost: string;
  languagePacks: Record<EffectiveDisplayLanguage, WebviewLanguagePack>;
  initialDisplayLanguage: DisplayLanguage;
  initialEffectiveLanguage: EffectiveDisplayLanguage;
  initialVSCodeLanguage?: string;
  displayLanguageOptions: LanguageOption[];
  initialScreen: MainViewScreen;
  customProviderPrefix: string;
  customProviders: CustomProviderConfig[];
}
