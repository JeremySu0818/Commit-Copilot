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
    labels: { en: 'Auto (Follow VS Code)', 'zh-TW': '自動（跟隨 VS Code）', 'zh-CN': '自动（跟随 VS Code）', ja: '自動（VS Code に従う）' },
  },
  { value: 'en', labels: { en: 'English', 'zh-TW': '英文', 'zh-CN': '英文', ja: '英語' } },
  {
    value: 'zh-TW',
    labels: { en: 'Traditional Chinese', 'zh-TW': '繁體中文', 'zh-CN': '繁体中文', ja: '繁体字中国語' },
  },
  {
    value: 'zh-CN',
    labels: { en: 'Simplified Chinese', 'zh-TW': '簡體中文', 'zh-CN': '简体中文', ja: '簡体字中国語' },
  },
  {
    value: 'ja',
    labels: { en: 'Japanese', 'zh-TW': '日文', 'zh-CN': '日文', ja: '日本語' },
  },
];

export const WEBVIEW_LANGUAGE_PACKS: Record<
  EffectiveDisplayLanguage,
  WebviewLanguagePack
> = {
  en: LOCALES.en.webviewLanguagePack,
  'zh-TW': LOCALES['zh-TW'].webviewLanguagePack,
  'zh-CN': LOCALES['zh-CN'].webviewLanguagePack,
  ja: LOCALES.ja.webviewLanguagePack,
};

export function normalizeDisplayLanguage(value: unknown): DisplayLanguage {
  if (value === 'en' || value === 'zh-TW' || value === 'zh-CN' || value === 'ja' || value === 'auto') {
    return value;
  }
  return DEFAULT_DISPLAY_LANGUAGE;
}

export function resolveEffectiveDisplayLanguage(
  displayLanguage: DisplayLanguage,
  vscodeLanguage?: string,
): EffectiveDisplayLanguage {
  if (displayLanguage === 'en' || displayLanguage === 'zh-TW' || displayLanguage === 'zh-CN' || displayLanguage === 'ja') {
    return displayLanguage;
  }
  const normalized = String(vscodeLanguage || '')
    .trim()
    .toLowerCase();
  
  if (normalized.startsWith('zh-cn') || normalized.startsWith('zh-hans')) {
    return 'zh-CN';
  }
  if (normalized.startsWith('zh')) {
    return 'zh-TW';
  }
  if (normalized.startsWith('ja')) {
    return 'ja';
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
