import type { EffectiveDisplayLanguage, LocaleTextBundle } from '../types';
import { enLocale } from './en';
import { zhTWLocale } from './zh-TW';
import { zhCNLocale } from './zh-CN';
import { jaLocale } from './ja';

export const LOCALES: Record<EffectiveDisplayLanguage, LocaleTextBundle> = {
  en: enLocale,
  'zh-TW': zhTWLocale,
  'zh-CN': zhCNLocale,
  ja: jaLocale,
};
