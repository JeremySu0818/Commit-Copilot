import { EXIT_CODES } from './errors';
import { LOCALES } from './i18n/locales';
import type {
  DisplayLanguage,
  EffectiveDisplayLanguage,
  ErrorInfo,
  ExtensionText,
  LanguageOption,
  SidePanelText,
  WebviewLanguagePack,
} from './i18n/types';

export type {
  DisplayLanguage,
  EffectiveDisplayLanguage,
  ExtensionText,
  LanguageOption,
  SidePanelText,
  WebviewLanguagePack,
} from './i18n/types';

export const DISPLAY_LANGUAGE_STATE_KEY = 'DISPLAY_LANGUAGE';
export const DEFAULT_DISPLAY_LANGUAGE: DisplayLanguage = 'auto';

export const DISPLAY_LANGUAGE_OPTIONS: LanguageOption[] = [
  {
    value: 'auto',
    labels: { en: 'Auto (Follow VS Code)', 'zh-TW': '自動（跟隨 VS Code）' },
  },
  { value: 'en', labels: { en: 'English', 'zh-TW': '英文' } },
  {
    value: 'zh-TW',
    labels: { en: 'Traditional Chinese', 'zh-TW': '繁體中文' },
  },
];

export const WEBVIEW_LANGUAGE_PACKS: Record<
  EffectiveDisplayLanguage,
  WebviewLanguagePack
> = {
  en: LOCALES.en.webviewLanguagePack,
  'zh-TW': LOCALES['zh-TW'].webviewLanguagePack,
};

export function normalizeDisplayLanguage(value: unknown): DisplayLanguage {
  if (value === 'en' || value === 'zh-TW' || value === 'auto') {
    return value;
  }
  return DEFAULT_DISPLAY_LANGUAGE;
}

export function resolveEffectiveDisplayLanguage(
  displayLanguage: DisplayLanguage,
  vscodeLanguage?: string,
): EffectiveDisplayLanguage {
  if (displayLanguage === 'en' || displayLanguage === 'zh-TW') {
    return displayLanguage;
  }
  const normalized = String(vscodeLanguage || '')
    .trim()
    .toLowerCase();
  if (normalized.startsWith('zh')) {
    return 'zh-TW';
  }
  return 'en';
}

export function getLocalizedErrorInfo(
  language: EffectiveDisplayLanguage,
  exitCode: number,
): ErrorInfo {
  const messages = LOCALES[language].errorMessages;
  return messages[exitCode] || messages[EXIT_CODES.UNKNOWN_ERROR];
}

export function getExtensionText(
  language: EffectiveDisplayLanguage,
): ExtensionText {
  return LOCALES[language].extensionText;
}

export function getSidePanelText(
  language: EffectiveDisplayLanguage,
): SidePanelText {
  return LOCALES[language].sidePanelText;
}



export function getDisplayLanguageLabel(
  language: DisplayLanguage,
  uiLanguage: EffectiveDisplayLanguage,
): string {
  const option = DISPLAY_LANGUAGE_OPTIONS.find(
    (item) => item.value === language,
  );
  return option ? option.labels[uiLanguage] : language;
}

function replacePlaceholders(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) => {
    return values[key] ?? '';
  });
}

export function formatWebviewText(
  template: string,
  values: Record<string, string>,
): string {
  return replacePlaceholders(template, values);
}
