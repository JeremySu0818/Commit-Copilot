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
  HybridGenerationOptions,
  ModelConfig,
} from './models';

export type MainViewScreen =
  | 'main'
  | 'settings'
  | 'addProvider'
  | 'addModel'
  | 'about';

export interface WebviewBootstrapData {
  providers: Record<APIProvider, string>;
  generateModes: Record<GenerateMode, string>;
  modelsByProvider: Record<APIProvider, ModelConfig[]>;
  defaultModels: Record<APIProvider, string>;
  defaultProvider: APIProvider;
  defaultGenerateMode: GenerateMode;
  defaultCommitOutputOptions: CommitOutputOptions;
  defaultHybridGenerationOptions: HybridGenerationOptions;
  ollamaDefaultHost: string;
  languagePacks: Record<EffectiveDisplayLanguage, WebviewLanguagePack>;
  initialDisplayLanguage: DisplayLanguage;
  initialEffectiveLanguage: EffectiveDisplayLanguage;
  initialVSCodeLanguage?: string;
  displayLanguageOptions: LanguageOption[];
  initialCommitMessageLanguage: EffectiveDisplayLanguage;
  commitMessageLanguageOptions: LanguageOption[];
  initialScreen: MainViewScreen;
  customProviderPrefix: string;
  customProviders: CustomProviderConfig[];
  extensionVersion: string;
  extensionAuthor: string;
}
