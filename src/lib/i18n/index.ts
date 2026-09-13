import { translations } from '../translations';
import type { Language } from '../types';
import { common } from './common';
import { errorMessages } from './errors';
import { uiMessages,type UiMessageKey } from './ui';
export function uiMessage(language: string, key: UiMessageKey) { return uiMessages[language === 'vi' ? 'vi' : 'en'][key]; }
export function messages(language: Language) { return { app: translations[language], common: common[language], errors: errorMessages[language], ui: uiMessages[language] }; }
export function localeFor(language: string) { return language === 'vi' ? 'vi-VN' : 'en-US'; }
