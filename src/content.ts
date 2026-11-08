import blocksEn from '../data/blocks.en.json';
import blocksRu from '../data/blocks.ru.json';
import questionsEn from '../data/questions.en.json';
import questionsRu from '../data/questions.ru.json';
import ontarioJson from '../data/ontario.json';
import type { Lang } from './store';

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
  questionRu?: string;
  optionsRu?: string[];
}

const BLOCKS: Record<Lang, Chapter[]> = {
  en: (blocksEn as { chapters: Chapter[] }).chapters,
  ru: (blocksRu as { chapters: Chapter[] }).chapters,
};
const QUESTIONS: Record<Lang, Question[]> = {
  en: questionsEn as Question[],
  ru: questionsRu as Question[],
};

// Full table of contents of the brochure (pages by the English edition). Chapters without data are "coming soon".
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

export function chapters(lang: Lang): Chapter[] {
  return BLOCKS[lang];
}

export function chapter(lang: Lang, id: string): Chapter | undefined {
  return BLOCKS[lang].find((c) => c.id === id);
}

export function findBlock(lang: Lang, blockId: string): { chapter: Chapter; block: Block } | undefined {
  for (const c of BLOCKS[lang]) {
    const b = c.blocks.find((x) => x.id === blockId);
    if (b) return { chapter: c, block: b };
  }
  return undefined;
}

export function questions(lang: Lang, chapterId?: string): Question[] {
  return QUESTIONS[lang].filter((q) => !chapterId || q.chapter === chapterId);
}

export interface OntarioFact { en: string; ru: string; value: string; valueRu: string; source: string }
export const ontario = ontarioJson as {
  checked: string;
  recheckNote: string;
  facts: OntarioFact[];
  questions: (Omit<Question, 'chapter' | 'blockId' | 'explanation'> & { explanationEn: string; explanationRu: string })[];
};

/** Ontario / Brantford questions (not from the brochure; no blockId). */
export function ontarioQuestions(lang: Lang): Question[] {
  return ontario.questions.map((q) => ({
    id: q.id,
    chapter: 'ontario',
    blockId: '',
    question: q.question,
    options: q.options,
    answer: q.answer,
    explanation: lang === 'ru' ? q.explanationRu : q.explanationEn,
    questionRu: q.questionRu,
    optionsRu: q.optionsRu,
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

export const FACT_LABELS: Record<string, string> = {
  definition: 'Определение',
  'right-duty': 'Право / обязанность',
  place: 'Место',
  number: 'Число',
  date: 'Дата',
  person: 'Народы и люди',
  symbol: 'Символ',
};

export function imgUrl(src: string): string {
  return import.meta.env.BASE_URL + src;
}
