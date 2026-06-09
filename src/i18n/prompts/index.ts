import type { EffectiveDisplayLanguage, LocalePromptBundle } from '../types';

import { arPrompt } from './ar';
import { csPrompt } from './cs';
import { dePrompt } from './de';
import { enPrompt } from './en';
import { esPrompt } from './es';
import { frPrompt } from './fr';
import { hiPrompt } from './hi';
import { huPrompt } from './hu';
import { idPrompt } from './id';
import { itPrompt } from './it';
import { jaPrompt } from './ja';
import { koPrompt } from './ko';
import { nlPrompt } from './nl';
import { plPrompt } from './pl';
import { ptBRPrompt } from './pt-BR';
import { ruPrompt } from './ru';
import { trPrompt } from './tr';
import { viPrompt } from './vi';
import { zhCNPrompt } from './zh-CN';
import { zhTWPrompt } from './zh-TW';

export const LOCALIZED_PROMPTS: Record<
  EffectiveDisplayLanguage,
  LocalePromptBundle
> = {
  en: enPrompt,
  ar: arPrompt,
  cs: csPrompt,
  de: dePrompt,
  es: esPrompt,
  fr: frPrompt,
  hi: hiPrompt,
  hu: huPrompt,
  id: idPrompt,
  it: itPrompt,
  ja: jaPrompt,
  ko: koPrompt,
  nl: nlPrompt,
  pl: plPrompt,
  'pt-br': ptBRPrompt,
  ru: ruPrompt,
  tr: trPrompt,
  vi: viPrompt,
  'zh-CN': zhCNPrompt,
  'zh-TW': zhTWPrompt,
};
