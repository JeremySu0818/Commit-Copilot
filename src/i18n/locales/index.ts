import type { EffectiveDisplayLanguage, LocaleTextBundle } from '../types';
import { enLocale } from './en';
import { zhTWLocale } from './zh-TW';
import { zhCNLocale } from './zh-CN';
import { jaLocale } from './ja';
import { koLocale } from './ko';
import { esLocale } from './es';
import { arLocale } from './ar';
import { csLocale } from './cs';
import { nlLocale } from './nl';
import { frLocale } from './fr';
import { deLocale } from './de';
import { hiLocale } from './hi';
import { huLocale } from './hu';
import { idLocale } from './id';
import { itLocale } from './it';
import { plLocale } from './pl';

export const LOCALES: Record<EffectiveDisplayLanguage, LocaleTextBundle> = {
  en: enLocale,
  'zh-TW': zhTWLocale,
  'zh-CN': zhCNLocale,
  ja: jaLocale,
  ko: koLocale,
  es: esLocale,
  ar: arLocale,
  cs: csLocale,
  nl: nlLocale,
  fr: frLocale,
  de: deLocale,
  hi: hiLocale,
  hu: huLocale,
  id: idLocale,
  it: itLocale,
  pl: plLocale,
};
