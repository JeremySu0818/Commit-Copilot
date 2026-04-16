import type { EffectiveDisplayLanguage, LocaleTextBundle } from '../types';

import { arLocale } from './ar';
import { csLocale } from './cs';
import { deLocale } from './de';
import { enLocale } from './en';
import { esLocale } from './es';
import { frLocale } from './fr';
import { hiLocale } from './hi';
import { huLocale } from './hu';
import { idLocale } from './id';
import { itLocale } from './it';
import { jaLocale } from './ja';
import { koLocale } from './ko';
import { nlLocale } from './nl';
import { plLocale } from './pl';
import { ptBRLocale } from './pt-BR';
import { ruLocale } from './ru';
import { trLocale } from './tr';
import { viLocale } from './vi';
import { zhCNLocale } from './zh-CN';
import { zhTWLocale } from './zh-TW';

export const LOCALES: Record<EffectiveDisplayLanguage, LocaleTextBundle> = {
  ar: arLocale,
  cs: csLocale,
  de: deLocale,
  en: enLocale,
  es: esLocale,
  fr: frLocale,
  hi: hiLocale,
  hu: huLocale,
  id: idLocale,
  it: itLocale,
  ja: jaLocale,
  ko: koLocale,
  nl: nlLocale,
  pl: plLocale,
  'pt-br': ptBRLocale,
  ru: ruLocale,
  tr: trLocale,
  vi: viLocale,
  'zh-CN': zhCNLocale,
  'zh-TW': zhTWLocale,
};
