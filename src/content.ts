// Brochure data. Each language is loaded on demand (one file per language) to keep the app small.
import ontarioJson from '../data/ontario.json';
import { L, langInfo, type Lang } from './langs';

export type FactType = 'date' | 'person' | 'number' | 'definition' | 'place' | 'symbol' | 'right-duty';

export interface KeyFact { text: string; type: FactType | string }
export interface Image { src: string; caption: string; w?: number; h?: number }
export interface Block {
  id: string;
  kind: 'intro' | 'section' | 'aside' | 'photo' | string;
  page: number;
  heading: string;
  images: Image[];
  paragraphs: string[];
  keyFacts: KeyFact[];
}
export interface Chapter { id: string; title: string; pages: number[]; blocks: Block[] }
export interface Question {
  id: string;
  chapter: string;
  blockId: string;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  /** question and options translated into the brochure language (not for EN) */
  questionTr?: string;
  optionsTr?: string[];
}

const blockFiles = import.meta.glob<{ default: { chapters: Chapter[] } }>('../data/blocks.*.json');
const questionFiles = import.meta.glob<{ default: Question[] }>('../data/questions.*.json');

const BLOCKS: Record<Lang, Chapter[]> = {};
const QUESTIONS: Record<Lang, Question[]> = {};

/** Load a language's brochure and questions (cached). */
export async function ensureLang(lang: Lang): Promise<void> {
  if (BLOCKS[lang] && QUESTIONS[lang]) return;
  const b = blockFiles[`../data/blocks.${lang}.json`];
  const q = questionFiles[`../data/questions.${lang}.json`];
  if (!b || !q) throw new Error(`language ${lang} is not available`);
  const [bm, qm] = await Promise.all([b(), q()]);
  BLOCKS[lang] = bm.default.chapters;
  QUESTIONS[lang] = qm.default;
}

export const isLoaded = (lang: Lang) => !!BLOCKS[lang];

// Table of contents (pages by the English edition).
export const TOC: { id: string; en: string; ru: string; page: number }[] = [
  { id: 'oath', en: 'Message to Our Readers', ru: 'Обращение к читателям', page: 2 },
  { id: 'applying', en: 'Applying for Citizenship', ru: 'Подача заявления на гражданство', page: 6 },
  { id: 'rights', en: 'Rights and Responsibilities of Citizenship', ru: 'Права и обязанности гражданина', page: 8 },
  { id: 'who-we-are', en: 'Who We Are', ru: 'Кто мы', page: 10 },
  { id: 'history', en: 'Canada’s History', ru: 'История Канады', page: 14 },
  { id: 'modern', en: 'Modern Canada', ru: 'Современная Канада', page: 24 },
  { id: 'government', en: 'How Canadians Govern Themselves', ru: 'Как канадцы управляют собой', page: 28 },
  { id: 'elections', en: 'Federal Elections', ru: 'Федеральные выборы', page: 30 },
  { id: 'justice', en: 'The Justice System', ru: 'Система правосудия', page: 36 },
  { id: 'symbols', en: 'Canadian Symbols', ru: 'Символы Канады', page: 38 },
  { id: 'economy', en: 'Canada’s Economy', ru: 'Экономика Канады', page: 42 },
  { id: 'regions', en: 'Canada’s Regions', ru: 'Регионы Канады', page: 44 },
];

/** Chapter title in the brochure language (falls back to English / Russian table). */
export function chapterTitle(lang: Lang, id: string): string {
  const c = BLOCKS[lang]?.find((x) => x.id === id);
  if (c) return c.title;
  const t = TOC.find((x) => x.id === id);
  return t ? (lang === 'ru' ? t.ru : t.en) : id;
}

export function chapters(lang: Lang): Chapter[] {
  return BLOCKS[lang] ?? [];
}

export function chapter(lang: Lang, id: string): Chapter | undefined {
  return chapters(lang).find((c) => c.id === id);
}

export function findBlock(lang: Lang, blockId: string): { chapter: Chapter; block: Block } | undefined {
  for (const c of chapters(lang)) {
    const b = c.blocks.find((x) => x.id === blockId);
    if (b) return { chapter: c, block: b };
  }
  return undefined;
}

export function questions(lang: Lang, chapterId?: string): Question[] {
  return (QUESTIONS[lang] ?? []).filter((q) => !chapterId || q.chapter === chapterId);
}

export interface OntarioFact { en: string; ru: string; uk: string; value: string; valueRu: string; valueUk: string; source: string }
export const ontario = ontarioJson as {
  checked: string;
  recheckNote: string;
  recheckNoteUk: string;
  facts: OntarioFact[];
  questions: { id: string; question: string; options: string[]; answer: number; explanationEn: string; explanationRu: string; questionRu: string; optionsRu: string[]; explanationUk: string; questionUk: string; optionsUk: string[] }[];
};

/** Ontario / Brantford questions (not from the brochure; no blockId). English, with Russian and Ukrainian translations. */
export function ontarioQuestions(lang: Lang): Question[] {
  return ontario.questions.map((q) => ({
    id: q.id,
    chapter: 'ontario',
    blockId: '',
    question: q.question,
    options: q.options,
    answer: q.answer,
    explanation: lang === 'ru' ? q.explanationRu : lang === 'uk' ? q.explanationUk : q.explanationEn,
    questionTr: lang === 'ru' ? q.questionRu : lang === 'uk' ? q.questionUk : undefined,
    optionsTr: lang === 'ru' ? q.optionsRu : lang === 'uk' ? q.optionsUk : undefined,
  }));
}

/** Size of a chapter's text, used to give the mock exam a proportional share of questions. */
export function chapterSize(c: Chapter): number {
  return c.blocks.reduce((s, b) => s + b.paragraphs.reduce((t, p) => t + p.length, 0), 0);
}

export function chapterProgress(c: Chapter, done: Record<string, number>): number {
  if (!c.blocks.length) return 0;
  return Math.round((c.blocks.filter((b) => done[b.id]).length / c.blocks.length) * 100);
}

export function factLabel(type: string): string {
  const labels: Record<string, [string, string, string]> = {
    definition: ['Определение', 'Definition', 'Визначення'],
    'right-duty': ['Право / обязанность', 'Right / duty', 'Право / обов’язок'],
    place: ['Место', 'Place', 'Місце'],
    number: ['Число', 'Number', 'Число'],
    date: ['Дата', 'Date', 'Дата'],
    person: ['Народы и люди', 'People', 'Народи й люди'],
    symbol: ['Символ', 'Symbol', 'Символ'],
  };
  const l = labels[type];
  return l ? L(l[0], l[1], l[2]) : type;
}
export const FACT_TYPES = ['definition', 'right-duty', 'place', 'number', 'date', 'person', 'symbol'];

/** Brochure "chrome" texts (kicker, footer) in the brochure language where we have them. */
export function brochureKicker(lang: Lang): string {
  return lang === 'ru' ? 'Откройте для себя Канаду' : lang === 'uk' ? 'Відкрийте для себе Канаду' : 'Discover Canada';
}
export function brochureFooter(lang: Lang): string {
  return lang === 'ru'
    ? 'Учебное пособие для подготовки к экзамену на гражданство'
    : lang === 'uk'
      ? 'Навчальний посібник для підготовки до іспиту на громадянство'
      : 'Your Canadian Citizenship Study Guide';
}
/** Notice for unofficial translations, in the interface language. */
export function translationNotice(lang: Lang): string {
  const info = langInfo(lang);
  if (info.official) return '';
  if (info.machine)
    return L(
      `Машинный перевод (${info.native}), неофициальный — возможны неточности. Официальны только английская и французская версии.`,
      `Machine translation (${info.native}), unofficial — it may contain mistakes. Only the English and French versions are official.`, `Машинний переклад (${info.native}), неофіційний — можливі неточності. Офіційні лише англійська та французька версії.`,
    );
  return L('Неофициальный перевод; официальны только английская и французская версии.', 'Unofficial translation; only the English and French versions are official.', 'Неофіційний переклад; офіційні лише англійська та французька версії.');
}

export function imgUrl(src: string): string {
  return import.meta.env.BASE_URL + src;
}
