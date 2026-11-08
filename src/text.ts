// Text preparation: sentence splitting, speech text with a map back to the displayed text,
// and rendering of one sentence with key facts / English insertions / current word.
import type { KeyFact } from './content';
import type { Lang } from './langs';

const fixFiles = import.meta.glob<Record<string, string>>('../data/tts-fixes.*.json', { eager: true, import: 'default' });

export interface Range { start: number; end: number }
export interface Utt { speech: string; map: number[] }

/** One spoken unit (a sentence, a heading or a caption) with its display data. */
export interface Piece {
  k: number;
  text: string;
  facts: (Range & { type: string })[];
  en: Range[];
  utt: Utt;
}

const ABBR = new Set([
  'St', 'Mr', 'Mrs', 'Ms', 'Dr', 'Lt', 'Gen', 'Col', 'Capt', 'Sgt', 'Jr', 'Sr', 'No', 'vs', 'Mt', 'Ft',
  'т', 'е', 'д', 'п', 'г', 'гг', 'др', 'см', 'стр', 'им', 'св', 'ул', 'н', 'э', 'в', 'вв',
]);

/** Split a paragraph into sentence ranges (indices into the paragraph). */
export function splitSentences(p: string): Range[] {
  const out: Range[] = [];
  // Latin/Cyrillic/Arabic: punctuation + space before a capital/digit/quote.
  // Chinese (。！？) and Hindi/Punjabi (।) end a sentence by themselves.
  const re = /[。！？][”」』）)]*\s*|[।॥]\s*|[.!?…؟]+["»”’)\]]*\s+/g;
  let start = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(p))) {
    const next = p[m.index + m[0].length];
    if (next && /^[。！？।॥]/.test(m[0])) {
      out.push({ start, end: m.index + m[0].trimEnd().length });
      start = m.index + m[0].length;
      continue;
    }
    if (m[0].startsWith('؟') || (next && /[؀-ۿ]/.test(next) && /[.!؟]/.test(m[0]))) {
      out.push({ start, end: m.index + m[0].trimEnd().length });
      start = m.index + m[0].length;
      continue;
    }
    if (!next || !/[\p{Lu}\p{N}«“"(\[‘¿¡]/u.test(next)) continue;
    const word = /(\p{L}+)$/u.exec(p.slice(start, m.index))?.[1];
    if (word && (ABBR.has(word) || (word.length === 1 && /\p{Lu}/u.test(word)))) continue;
    out.push({ start, end: m.index + m[0].trimEnd().length });
    start = m.index + m[0].length;
  }
  if (start < p.length && p.slice(start).trim()) out.push({ start, end: p.trimEnd().length });
  return out;
}

function fixesFor(lang: Lang): [string, string][] {
  const f = fixFiles[`../data/tts-fixes.${lang}.json`] ?? {};
  return Object.entries(f).sort((a, b) => b[0].length - a[0].length);
}

const EN_IN_PARENS = /\s*\((?=[^)]*[A-Za-z])[^)]*\)/g;
const BULLETS = /^\s*[•▪]\s*/g;
const URLS = /\s*\(?(?:https?:\/\/|www\.)[^\s)]+\)?/g;
const PAGE_REFS = /\s*\((?:стр|с|p|page)\.?\s*\d+(?:[–-]\d+)?\)/gi;

/** Build the text sent to the speech engine and a map speech index -> display index. */
export function speechOf(text: string, lang: Lang): Utt {
  let s = text;
  let map = Array.from({ length: text.length }, (_, i) => i);

  const cut = (re: RegExp) => {
    let out = '';
    const m2: number[] = [];
    let last = 0;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) {
      out += s.slice(last, m.index);
      m2.push(...map.slice(last, m.index));
      last = m.index + m[0].length;
      if (!m[0].length) re.lastIndex++;
    }
    out += s.slice(last);
    m2.push(...map.slice(last));
    s = out;
    map = m2;
  };
  const replace = (from: string, to: string) => {
    let pos = s.indexOf(from);
    if (pos < 0) return;
    let out = '';
    const m2: number[] = [];
    let last = 0;
    while (pos >= 0) {
      out += s.slice(last, pos) + to;
      m2.push(...map.slice(last, pos));
      for (let j = 0; j < to.length; j++) {
        m2.push(map[pos + Math.min(from.length - 1, Math.floor((j * from.length) / to.length))]);
      }
      last = pos + from.length;
      pos = s.indexOf(from, last);
    }
    out += s.slice(last);
    m2.push(...map.slice(last));
    s = out;
    map = m2;
  };

  cut(BULLETS);
  cut(URLS);
  cut(PAGE_REFS);
  if (lang !== 'en') cut(EN_IN_PARENS);
  for (const [from, to] of fixesFor(lang)) replace(from, to);
  return { speech: s, map };
}

/** Length of the word starting at i (letters, digits and inner punctuation, without trailing commas). */
export function wordLen(s: string, i: number): number {
  const m = /^[\p{L}\p{N}’'%\-–.]*[\p{L}\p{N}%]/u.exec(s.slice(i));
  return m ? m[0].length : 1;
}

function findAll(text: string, needle: string): number[] {
  const out: number[] = [];
  if (!needle) return out;
  let i = text.indexOf(needle);
  while (i >= 0) {
    out.push(i);
    i = text.indexOf(needle, i + needle.length);
  }
  return out;
}

/** Turn a paragraph into pieces (one per sentence); k numbering starts at k0. */
export function paragraphPieces(p: string, facts: KeyFact[], lang: Lang, k0: number): Piece[] {
  const factRanges: (Range & { type: string })[] = [];
  for (const f of facts) {
    for (const at of findAll(p, f.text)) factRanges.push({ start: at, end: at + f.text.length, type: f.type });
  }
  const enRanges: Range[] = [];
  if (lang !== 'en') {
    const re = /\((?=[^)]*[A-Za-z])[^)]*\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(p))) enRanges.push({ start: m.index, end: m.index + m[0].length });
  }
  return splitSentences(p).map((r, i) => {
    const text = p.slice(r.start, r.end);
    const clip = <T extends Range>(x: T): T | null => {
      const a = Math.max(x.start, r.start);
      const b = Math.min(x.end, r.end);
      return a < b ? { ...x, start: a - r.start, end: b - r.start } : null;
    };
    return {
      k: k0 + i,
      text,
      facts: factRanges.map(clip).filter((x): x is Range & { type: string } => !!x),
      en: enRanges.map(clip).filter((x): x is Range => !!x),
      utt: speechOf(text, lang),
    };
  });
}

export function simplePiece(text: string, lang: Lang, k: number): Piece {
  return { k, text, facts: [], en: [], utt: speechOf(text, lang) };
}

export function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

/** HTML for one piece. `word` = currently spoken word range in display coordinates. */
export function pieceHtml(p: Piece, word?: Range | null): string {
  const cuts = new Set([0, p.text.length]);
  const ranges: (Range & { cls: string })[] = [
    ...p.facts.map((f) => ({ ...f, cls: `kf kf-${f.type}` })),
    ...p.en.map((e) => ({ ...e, cls: 'en' })),
  ];
  if (word) ranges.push({ ...word, cls: 'w' });
  for (const r of ranges) {
    cuts.add(r.start);
    cuts.add(r.end);
  }
  const pts = [...cuts].sort((a, b) => a - b);
  let html = '';
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (b <= a) continue;
    const cls = ranges.filter((r) => r.start <= a && r.end >= b).map((r) => r.cls);
    const t = esc(p.text.slice(a, b));
    html += cls.length ? `<span class="${cls.join(' ')}">${t}</span>` : t;
  }
  return html;
}
