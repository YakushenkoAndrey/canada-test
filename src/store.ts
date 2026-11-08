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
  examTimer: boolean;
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
  examTimer: true,
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

// Answers per question with a simple Leitner scheme ("Мои ошибки"):
// a wrong answer puts the question into box 0 (due again in 10 minutes);
// each right answer moves it up one box: due in 1, 3, 7, 14, 30 days.
// A question counts as "learned" again from box 3.
export interface Mistake { wrong: number; right: number; t: number; box?: number; due?: number }
export const mistakes: Record<string, Mistake> = load('mistakes', {});

const DAY = 86_400_000;
const BOX_DAYS = [0, 1, 3, 7, 14, 30];
export const LEARNED_BOX = 3;

export function recordAnswer(qid: string, correct: boolean): void {
  const m = mistakes[qid] ?? { wrong: 0, right: 0, t: 0, box: 0 };
  const now = Date.now();
  if (correct) {
    m.right++;
    m.box = Math.min((m.box ?? 0) + 1, BOX_DAYS.length - 1);
    m.due = now + BOX_DAYS[m.box] * DAY;
  } else {
    m.wrong++;
    m.box = 0;
    m.due = now + 10 * 60_000;
  }
  m.t = now;
  mistakes[qid] = m;
  save('mistakes', mistakes);
}

/** The question was answered wrong at least once and is not learned yet. */
export function isMistake(qid: string): boolean {
  const m = mistakes[qid];
  return !!m && m.wrong > 0 && (m.box ?? 0) < LEARNED_BOX;
}

/** Selection weight: unlearned mistakes come up 4× more often, once-wrong-now-learned 1.5×. */
export function weightOf(qid: string): number {
  const m = mistakes[qid];
  if (!m || !m.wrong) return 1;
  return (m.box ?? 0) < LEARNED_BOX ? 4 : 1.5;
}

export function dueAt(qid: string): number {
  return mistakes[qid]?.due ?? 0;
}

// Mock exam attempts (newest first).
export interface Attempt { t: number; score: number; total: number; passed: boolean; secs: number; lang: Lang; timeUp?: boolean }
export const attempts: Attempt[] = load('attempts', []);

export function addAttempt(a: Attempt): void {
  attempts.unshift(a);
  attempts.splice(50);
  save('attempts', attempts);
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
