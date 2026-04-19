import { EXIT_CODES, type CommitCopilotError } from './errors';
import { LOCALES } from './i18n/locales';
import type {
  DisplayLanguage,
  EffectiveDisplayLanguage,
  ErrorInfo,
  ExtensionText,
  LanguageOption,
  MainViewText,
  WebviewLanguagePack,
} from './i18n/types';

export type {
  DisplayLanguage,
  EffectiveDisplayLanguage,
  ExtensionText,
  LanguageOption,
  MainViewText,
  WebviewLanguagePack,
} from './i18n/types';

export const DISPLAY_LANGUAGE_STATE_KEY = 'DISPLAY_LANGUAGE';
export const DEFAULT_DISPLAY_LANGUAGE: DisplayLanguage = 'auto';

export const DISPLAY_LANGUAGE_OPTIONS: LanguageOption[] = [
  {
    value: 'auto',
    labels: {
      ar: 'تلقائي (حسب VS Code)',
      cs: 'Automaticky (podle VS Code)',
      de: 'Automatisch (laut VS Code)',
      en: 'Auto (Follow VS Code)',
      es: 'Automático (según VS Code)',
      fr: 'Automatique (selon VS Code)',
      hi: 'स्वचालित (VS Code के अनुसार)',
      hu: 'Automatikus (a VS Code szerint)',
      id: 'Otomatis (menurut VS Code)',
      it: 'Automatico (secondo VS Code)',
      ja: '自動（VS Code に従う）',
      ko: '자동 (VS Code 설정 따름)',
      nl: 'Automatisch (volgens VS Code)',
      pl: 'Automatycznie (według VS Code)',
      'pt-br': 'Automático (de acordo com o VS Code)',
      ru: 'Автоматически (согласно VS Code)',
      tr: "Otomatik (VS Code'a göre)",
      vi: 'Tự động (theo VS Code)',
      'zh-CN': '自动（跟随 VS Code）',
      'zh-TW': '自動（跟隨 VS Code）',
    },
  },
  { value: 'ar', label: 'العربية' },
  { value: 'cs', label: 'Čeština' },
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'hi', label: 'हिन्दी' },
  { value: 'hu', label: 'Magyar' },
  { value: 'id', label: 'Bahasa Indonesia' },
  { value: 'it', label: 'Italiano' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'nl', label: 'Nederlands' },
  { value: 'pl', label: 'Polski' },
  { value: 'pt-br', label: 'Português (Brasil)' },
  { value: 'ru', label: 'Русский' },
  { value: 'tr', label: 'Türkçe' },
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
];

export const WEBVIEW_LANGUAGE_PACKS: Record<
  EffectiveDisplayLanguage,
  WebviewLanguagePack
> = {
  ar: LOCALES.ar.webviewLanguagePack,
  cs: LOCALES.cs.webviewLanguagePack,
  de: LOCALES.de.webviewLanguagePack,
  en: LOCALES.en.webviewLanguagePack,
  es: LOCALES.es.webviewLanguagePack,
  fr: LOCALES.fr.webviewLanguagePack,
  hi: LOCALES.hi.webviewLanguagePack,
  hu: LOCALES.hu.webviewLanguagePack,
  id: LOCALES.id.webviewLanguagePack,
  it: LOCALES.it.webviewLanguagePack,
  ja: LOCALES.ja.webviewLanguagePack,
  ko: LOCALES.ko.webviewLanguagePack,
  nl: LOCALES.nl.webviewLanguagePack,
  pl: LOCALES.pl.webviewLanguagePack,
  'pt-br': LOCALES['pt-br'].webviewLanguagePack,
  ru: LOCALES.ru.webviewLanguagePack,
  tr: LOCALES.tr.webviewLanguagePack,
  vi: LOCALES.vi.webviewLanguagePack,
  'zh-CN': LOCALES['zh-CN'].webviewLanguagePack,
  'zh-TW': LOCALES['zh-TW'].webviewLanguagePack,
};

export function normalizeDisplayLanguage(value: unknown): DisplayLanguage {
  if (
    value === 'ar' ||
    value === 'cs' ||
    value === 'de' ||
    value === 'en' ||
    value === 'es' ||
    value === 'fr' ||
    value === 'hi' ||
    value === 'hu' ||
    value === 'id' ||
    value === 'it' ||
    value === 'ja' ||
    value === 'ko' ||
    value === 'nl' ||
    value === 'pl' ||
    value === 'pt-br' ||
    value === 'ru' ||
    value === 'tr' ||
    value === 'vi' ||
    value === 'zh-CN' ||
    value === 'zh-TW' ||
    value === 'auto'
  ) {
    return value;
  }
  return DEFAULT_DISPLAY_LANGUAGE;
}

export function resolveEffectiveDisplayLanguage(
  displayLanguage: DisplayLanguage,
  vscodeLanguage?: string,
): EffectiveDisplayLanguage {
  if (displayLanguage !== 'auto') {
    return displayLanguage;
  }

  const normalized = (vscodeLanguage ?? '').trim().toLowerCase();
  const normalizedPrefixMap: [
    prefix: string,
    language: EffectiveDisplayLanguage,
  ][] = [
    ['ar', 'ar'],
    ['cs', 'cs'],
    ['de', 'de'],
    ['es', 'es'],
    ['fr', 'fr'],
    ['hi', 'hi'],
    ['hu', 'hu'],
    ['id', 'id'],
    ['it', 'it'],
    ['ja', 'ja'],
    ['ko', 'ko'],
    ['nl', 'nl'],
    ['pl', 'pl'],
    ['pt-br', 'pt-br'],
    ['ru', 'ru'],
    ['tr', 'tr'],
    ['vi', 'vi'],
  ];

  for (const [prefix, language] of normalizedPrefixMap) {
    if (normalized.startsWith(prefix)) {
      return language;
    }
  }
  if (normalized.startsWith('zh-cn') || normalized.startsWith('zh-hans')) {
    return 'zh-CN';
  }
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
  if (Object.prototype.hasOwnProperty.call(messages, exitCode)) {
    return messages[exitCode];
  }
  return messages[EXIT_CODES.UNKNOWN_ERROR];
}

export function getLocalizedCommitCopilotErrorMessage(
  language: EffectiveDisplayLanguage,
  error: CommitCopilotError,
): string | undefined {
  const key = error.messageKey;
  if (!key) {
    return undefined;
  }

  const text = LOCALES[language].extensionText;
  switch (key) {
    case 'git.notRepository':
      return text.notification.repoNotFound;
    case 'rewrite.workspaceNotCleanBoth':
      return text.notification.rewriteWorkspaceDirtyBoth;
    case 'rewrite.workspaceNotCleanStaged':
      return text.notification.rewriteWorkspaceDirtyStaged;
    case 'rewrite.workspaceNotCleanUnstaged':
      return text.notification.rewriteWorkspaceDirtyUnstaged;
    case 'rewrite.emptyMessage':
      return text.notification.commitMessageCannotBeEmpty;
    default:
      return LOCALES[language].commitCopilotErrorMessages[key](
        error.messageArgs ?? {},
      );
  }
}

export function getExtensionText(
  language: EffectiveDisplayLanguage,
): ExtensionText {
  return LOCALES[language].extensionText;
}

export function getMainViewText(
  language: EffectiveDisplayLanguage,
): MainViewText {
  return LOCALES[language].mainViewText;
}

export function getModelNameRequiredText(
  language: EffectiveDisplayLanguage,
): string {
  return LOCALES[language].webviewLanguagePack.statuses.modelNameRequired;
}

export function getDisplayLanguageLabel(
  language: DisplayLanguage,
  uiLanguage: EffectiveDisplayLanguage,
): string {
  const option = DISPLAY_LANGUAGE_OPTIONS.find(
    (item) => item.value === language,
  );
  if (!option) return language;
  return option.label ?? option.labels?.[uiLanguage] ?? language;
}

function replacePlaceholders(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : '';
  });
}

export function formatWebviewText(
  template: string,
  values: Record<string, string>,
): string {
  return replacePlaceholders(template, values);
}
