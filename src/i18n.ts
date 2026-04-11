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
    labels: { en: 'Auto (Follow VS Code)', 'zh-TW': '自動（跟隨 VS Code）', 'zh-CN': '自动（跟随 VS Code）', ja: '自動（VS Code に従う）', ko: '자동 (VS Code 설정 따름)', es: 'Automático (según VS Code)', ar: 'تلقائي (حسب VS Code)', cs: 'Automaticky (podle VS Code)', nl: 'Automatisch (volgens VS Code)', fr: 'Automatique (selon VS Code)' },
  },
  { value: 'en', label: 'English' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'zh-CN', label: '简体中文' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'es', label: 'Español' },
  { value: 'ar', label: 'العربية' },
  { value: 'cs', label: 'Čeština' },
  { value: 'nl', label: 'Nederlands' },
  { value: 'fr', label: 'Français' },
];

export const WEBVIEW_LANGUAGE_PACKS: Record<
  EffectiveDisplayLanguage,
  WebviewLanguagePack
> = {
  en: LOCALES.en.webviewLanguagePack,
  'zh-TW': LOCALES['zh-TW'].webviewLanguagePack,
  'zh-CN': LOCALES['zh-CN'].webviewLanguagePack,
  ja: LOCALES.ja.webviewLanguagePack,
  ko: LOCALES.ko.webviewLanguagePack,
  es: LOCALES.es.webviewLanguagePack,
  ar: LOCALES.ar.webviewLanguagePack,
  cs: LOCALES.cs.webviewLanguagePack,
  nl: LOCALES.nl.webviewLanguagePack,
  fr: LOCALES.fr.webviewLanguagePack,
};

export function normalizeDisplayLanguage(value: unknown): DisplayLanguage {
  if (value === 'en' || value === 'zh-TW' || value === 'zh-CN' || value === 'ja' || value === 'ko' || value === 'es' || value === 'ar' || value === 'cs' || value === 'nl' || value === 'fr' || value === 'auto') {
    return value;
  }
  return DEFAULT_DISPLAY_LANGUAGE;
}

export function resolveEffectiveDisplayLanguage(
  displayLanguage: DisplayLanguage,
  vscodeLanguage?: string,
): EffectiveDisplayLanguage {
  if (displayLanguage === 'en' || displayLanguage === 'zh-TW' || displayLanguage === 'zh-CN' || displayLanguage === 'ja' || displayLanguage === 'ko' || displayLanguage === 'es' || displayLanguage === 'ar' || displayLanguage === 'cs' || displayLanguage === 'nl' || displayLanguage === 'fr') {
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
  if (normalized.startsWith('ko')) {
    return 'ko';
  }
  if (normalized.startsWith('es')) {
    return 'es';
  }
  if (normalized.startsWith('ar')) {
    return 'ar';
  }
  if (normalized.startsWith('cs')) {
    return 'cs';
  }
  if (normalized.startsWith('nl')) {
    return 'nl';
  }
  if (normalized.startsWith('fr')) {
    return 'fr';
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
  if (!option) return language;
  return option.label || (option.labels && option.labels[uiLanguage]) || language;
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
