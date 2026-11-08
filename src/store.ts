// Safe localStorage wrapper: every read/write is wrapped in try/catch, the app works without storage.
const PREFIX = 'dc.';

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage unavailable: ignore */
  }
}

export type Lang = 'en' | 'ru';

export interface Settings {
  lang: Lang;
  rate: number;
  autoNext: boolean;
  readCaptions: boolean;
  showLegend: boolean;
  factsOnly: boolean;
  showTranslation: boolean;
  voices: Partial<Record<Lang, string>>;
}

const DEFAULTS: Settings = {
  lang: 'ru',
  rate: 1,
  autoNext: true,
  readCaptions: false,
  showLegend: true,
  factsOnly: false,
  showTranslation: false,
  voices: {},
};

export const settings: Settings = { ...DEFAULTS, ...load<Partial<Settings>>('settings', {}) };

export function saveSettings(): void {
  save('settings', settings);
}

// Reading progress: blockId -> timestamp when it was listened/marked as read (shared by EN and RU).
export const progress: Record<string, number> = load('progress', {});

export function markDone(blockId: string, done = true): void {
  if (done) progress[blockId] = Date.now();
  else delete progress[blockId];
  save('progress', progress);
}

export function lastPlace(): { lang: Lang; chapter: string; block: string } | null {
  return load('last', null);
}

export function setLastPlace(lang: Lang, chapter: string, block: string): void {
  save('last', { lang, chapter, block });
}

// Wrong answers: questionId -> { wrong count, last time }. Used for "Мои ошибки" later.
export interface Mistake { wrong: number; right: number; t: number }
export const mistakes: Record<string, Mistake> = load('mistakes', {});

export function recordAnswer(qid: string, correct: boolean): void {
  const m = mistakes[qid] ?? { wrong: 0, right: 0, t: 0 };
  if (correct) m.right++;
  else m.wrong++;
  m.t = Date.now();
  mistakes[qid] = m;
  save('mistakes', mistakes);
}

export function resetAll(): void {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
