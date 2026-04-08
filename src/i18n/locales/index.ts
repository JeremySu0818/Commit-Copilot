import type { EffectiveDisplayLanguage, LocaleTextBundle } from '../types';
import { enLocale } from './en';
import { zhTWLocale } from './zh-TW';

export const LOCALES: Record<EffectiveDisplayLanguage, LocaleTextBundle> = {
  en: enLocale,
  'zh-TW': zhTWLocale,
};
