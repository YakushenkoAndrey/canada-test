// Brochure languages (published ones come from data/languages.json, written by tools/build_data.py)
// and the interface language (Russian or English).
import languagesJson from '../data/languages.json';
import { settings } from './store';

export type Lang = string;
export type Ui = 'ru' | 'en';

export interface LangInfo {
  code: string;
  name: string;
  native: string;
  ui: Ui;
  dir: 'ltr' | 'rtl';
  tts: string[];
  official?: boolean;
  machine?: boolean;
}

export const LANGS = languagesJson as LangInfo[];

export function langInfo(code: Lang): LangInfo {
  return LANGS.find((l) => l.code === code) ?? LANGS[0];
}

export function isLang(code: string | undefined): code is Lang {
  return !!code && LANGS.some((l) => l.code === code);
}

/** Interface language for a brochure language: RU brochure -> Russian, EN -> user's choice, others -> English. */
export function uiFor(lang: Lang): Ui {
  const info = langInfo(lang);
  if (info.code === 'en') return settings.uiLang;
  return info.ui;
}

let current: Ui = 'ru';
export function setUi(ui: Ui): void {
  current = ui;
  document.documentElement.dataset.ui = ui;
}
export function ui(): Ui {
  return current;
}

/** Inline translation: L('Русский текст', 'English text'). */
export function L(ru: string, en: string): string {
  return current === 'ru' ? ru : en;
}

/** Russian/English plural helper. */
export function plural(n: number, ru: [string, string, string], en: [string, string]): string {
  if (current === 'en') return n === 1 ? en[0] : en[1];
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return ru[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return ru[1];
  return ru[2];
}

export const nQuestions = (n: number) => `${n} ${plural(n, ['вопрос', 'вопроса', 'вопросов'], ['question', 'questions'])}`;
export const nSentences = (n: number) => `${n} ${plural(n, ['предложение', 'предложения', 'предложений'], ['sentence', 'sentences'])}`;
