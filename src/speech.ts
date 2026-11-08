// Speech engine on top of the Web Speech API.
// Each sentence is a separate SpeechSynthesisUtterance (reliable highlighting, avoids the Chrome ~15 s cut-off).
// Falls back to a silent "demo" mode that moves the highlight on a timer if no voice is available.
import { L, langInfo, type Lang } from './langs';
import { settings } from './store';
import { wordLen, type Utt } from './text';

export interface SpeakerListener {
  onIndex(k: number): void;
  onWord(k: number, start: number, end: number): void;
  onEnd(): void;
  onState(): void;
}

const synth: SpeechSynthesis | undefined =
  typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : undefined;
const MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const ANDROID = /Android/i.test(navigator.userAgent);

let voices: SpeechSynthesisVoice[] = [];
const voiceListeners = new Set<() => void>();

function refreshVoices() {
  try {
    voices = synth?.getVoices() ?? [];
  } catch {
    voices = [];
  }
  voiceListeners.forEach((f) => f());
}
if (synth) {
  refreshVoices();
  try {
    synth.addEventListener('voiceschanged', refreshVoices);
  } catch {
    synth.onvoiceschanged = refreshVoices;
  }
}

export function onVoices(f: () => void): () => void {
  voiceListeners.add(f);
  return () => voiceListeners.delete(f);
}

const norm = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-').toLowerCase();

/** Locale prefixes for a language, e.g. ['zh-cn', 'cmn-cn', 'zh-tw', 'zh'] (lower case). */
const prefixes = (lang: Lang) => langInfo(lang).tts.map((x) => x.toLowerCase());

export function voicesFor(lang: Lang): SpeechSynthesisVoice[] {
  const pre = prefixes(lang).map((x) => x.split('-')[0]);
  return voices.filter((v) => pre.some((p) => norm(v) === p || norm(v).startsWith(p + '-')));
}

export function pickVoice(lang: Lang): SpeechSynthesisVoice | null {
  const wanted = settings.voices[lang];
  if (wanted) {
    const v = voices.find((x) => x.name === wanted);
    if (v) return v;
  }
  for (const p of prefixes(lang)) {
    const list = voices.filter((x) => norm(x).startsWith(p) && !NOVELTY.test(x.name));
    if (list.length) return list.sort((a, b) => voiceScore(b) - voiceScore(a))[0];
  }
  return null;
}

// Apple "fun" voices (Bubbles, Zarvox…) — never pick them automatically.
const NOVELTY =
  /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Deranged|Good News|Hysterical|Jester|Junior|Kathy|Organ|Pipe Organ|Princess|Ralph|Superstar|Trinoids|Whisper|Wobble|Zarvox|Fred)\b/i;

/** Higher = better sounding: premium/enhanced/natural voices first, then local voices. */
export function voiceScore(v: SpeechSynthesisVoice): number {
  const n = `${v.name} ${v.voiceURI}`.toLowerCase();
  let s = 0;
  if (/premium|высокое|высококач/.test(n)) s += 30;
  if (/enhanced|улучш|natural|neural/.test(n)) s += 20;
  if (/google/.test(n)) s += 5;
  if (v.localService) s += 1; // works offline, sends word boundaries
  return s;
}

/** null = voice list not loaded yet (unknown), otherwise whether this device has a voice for the language. */
export function hasVoice(lang: Lang): boolean | null {
  if (!synth) return false;
  if (!voices.length) return null;
  return !!pickVoice(lang);
}

/** Short instruction (in the interface language) how to get a voice for the language on this device. */
export function voiceHelp(lang: Lang): string {
  const name = langInfo(lang).native;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua))
    return L(
      `iPhone: «Настройки → Универсальный доступ → Устный контент → Голоса» — добавьте голос «${name}», затем перезагрузите страницу.`,
      `iPhone: Settings → Accessibility → Spoken Content → Voices — add a “${name}” voice, then reload the page.`, `iPhone: «Параметри → Доступність → Озвучений вміст → Голоси» — додайте голос «${name}», потім перезавантажте сторінку.`,
    );
  if (/Android/.test(ua))
    return L(
      `Android: «Настройки → Специальные возможности → Синтез речи» — движок Google, в «Языке» скачайте голос «${name}», затем перезагрузите страницу.`,
      `Android: Settings → Accessibility → Text-to-speech — Google engine, download the “${name}” voice, then reload the page.`, `Android: «Налаштування → Спеціальні можливості → Синтез мовлення» — рушій Google, у «Мові» завантажте голос «${name}», потім перезавантажте сторінку.`,
    );
  if (/Edg\//.test(ua))
    return L(
      `Windows: «Параметры → Время и язык → Речь → Добавить голоса» — добавьте «${name}», затем перезапустите браузер.`,
      `Windows: Settings → Time & language → Speech → Add voices — add “${name}”, then restart the browser.`, `Windows: «Параметри → Час і мова → Мовлення → Додати голоси» — додайте «${name}», потім перезапустіть браузер.`,
    );
  if (/Windows/.test(ua))
    return L(
      `Windows: проще всего открыть сайт в Microsoft Edge — в нём есть онлайн-голоса на многих языках. Или «Параметры → Время и язык → Речь → Добавить голоса» — «${name}».`,
      `Windows: the easiest is to open the site in Microsoft Edge — it has online voices for many languages. Or Settings → Time & language → Speech → Add voices — “${name}”.`, `Windows: найпростіше відкрити сайт у Microsoft Edge — у ньому є онлайн-голоси багатьма мовами. Або «Параметри → Час і мова → Мовлення → Додати голоси» — «${name}».`,
    );
  if (/Mac/.test(ua))
    return L(
      `Mac: «Системные настройки → Универсальный доступ → Устный контент → Системный голос → Управление голосами» — добавьте голос «${name}».`,
      `Mac: System Settings → Accessibility → Spoken Content → System voice → Manage voices — add a “${name}” voice.`, `Mac: «Системні параметри → Доступність → Озвучений вміст → Системний голос → Керувати голосами» — додайте голос «${name}».`,
    );
  return L(`Установите голос «${name}» в настройках синтеза речи и перезагрузите страницу.`, `Install a “${name}” voice in your system text-to-speech settings and reload the page.`, `Установіть голос «${name}» у налаштуваннях синтезу мовлення і перезавантажте сторінку.`);
}

export type SpeakerState = 'idle' | 'playing' | 'paused';

class Speaker {
  state: SpeakerState = 'idle';
  /** true = no working voice, highlight moves silently on a timer */
  sim = !synth;
  /** why sim mode is on: no voice for the language on this device, or the engine failed */
  simReason: 'novoice' | 'error' | null = synth ? null : 'error';
  owner: string | null = null;
  k = -1;
  count = 0;

  private utts: Utt[] = [];
  private lang: Lang = 'en';
  private listener: SpeakerListener | null = null;
  private token = 0;
  private timer = 0;
  current: SpeechSynthesisUtterance | null = null; // keep a reference: Chrome may GC it and drop onend
  private lastWord = 0;
  private lastEvent = 0;
  private resumeFn: (() => void) | null = null;

  /** Must be called synchronously from a click/tap handler (iOS requirement for the first utterance). */
  start(owner: string, lang: Lang, utts: Utt[], k: number, listener: SpeakerListener) {
    const prev = this.listener;
    this.halt();
    this.owner = owner;
    this.lang = lang;
    this.utts = utts;
    this.count = utts.length;
    this.listener = listener;
    this.state = 'playing';
    // Never read text with a voice of another language (an English voice reads only the digits
    // of Russian text). If the voice list is loaded and has no voice for this language -> silent mode.
    if (synth && this.simReason !== 'error') {
      const missing = voices.length > 0 && !pickVoice(lang);
      this.sim = missing;
      this.simReason = missing ? 'novoice' : null;
    }
    if (prev && prev !== listener) prev.onState();
    listener.onState();
    this.speakFrom(Math.max(0, Math.min(k, utts.length - 1)), 0);
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    clearTimeout(this.timer);
    if (!this.sim && synth) {
      try {
        if (ANDROID) synth.cancel(); // Android resume() is unreliable: restart from the last word instead
        else synth.pause();
      } catch {
        /* ignore */
      }
      if (ANDROID) this.token++;
    }
    this.listener?.onState();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.listener?.onState();
    if (this.sim) {
      const f = this.resumeFn;
      this.resumeFn = null;
      if (f) f();
      else this.speakFrom(this.k, this.lastWord);
      return;
    }
    if (ANDROID || !synth) {
      this.speakFrom(this.k, this.lastWord);
      return;
    }
    const tok = this.token;
    const stamp = this.lastEvent;
    try {
      synth.resume();
    } catch {
      /* ignore */
    }
    // If resume() silently failed, repeat from the last spoken word.
    this.timer = window.setTimeout(() => {
      if (tok !== this.token || this.state !== 'playing' || this.lastEvent !== stamp) return;
      if (synth.paused || !synth.speaking) {
        this.halt();
        this.speakFrom(this.k, this.lastWord);
      }
    }, 900);
  }

  toggle() {
    if (this.state === 'playing') this.pause();
    else if (this.state === 'paused') this.resume();
  }

  stop() {
    const l = this.listener;
    this.halt();
    this.state = 'idle';
    this.k = -1;
    this.owner = null;
    this.listener = null;
    l?.onState();
  }

  /** Jump to sentence k of the current track. */
  seek(k: number) {
    if (this.state === 'idle' || k < 0 || k >= this.utts.length) return;
    this.halt();
    this.state = 'playing';
    this.listener?.onState();
    this.speakFrom(k, 0);
  }

  /** Apply a new rate immediately (restarts the current sentence from the last word). */
  restartCurrent() {
    if (this.state !== 'playing') return;
    this.halt();
    this.speakFrom(this.k, this.lastWord);
  }

  private halt() {
    this.token++;
    clearTimeout(this.timer);
    this.resumeFn = null;
    if (synth) {
      try {
        synth.cancel();
      } catch {
        /* ignore */
      }
    }
    this.current = null;
  }

  private finish() {
    const l = this.listener;
    this.state = 'idle';
    this.k = -1;
    this.owner = null;
    this.listener = null;
    this.current = null;
    l?.onState();
    l?.onEnd();
  }

  private emitWord(k: number, ci: number, len: number) {
    const u = this.utts[k];
    if (!u || !u.map.length) return;
    const a = u.map[Math.min(ci, u.map.length - 1)];
    const b = u.map[Math.min(ci + Math.max(len, 1) - 1, u.map.length - 1)] + 1;
    this.listener?.onWord(k, a, b);
  }

  private goSim(k: number, from: number) {
    this.halt();
    this.sim = true;
    this.simReason = 'error';
    this.listener?.onState();
    this.speakFrom(k, from);
  }

  private speakFrom(k: number, from: number) {
    const tok = ++this.token;
    clearTimeout(this.timer);
    if (k >= this.utts.length) {
      this.finish();
      return;
    }
    const changed = k !== this.k || from === 0;
    this.k = k;
    this.lastWord = from;
    if (changed) this.listener?.onIndex(k);
    const u = this.utts[k];
    const text = u.speech.slice(from);
    if (!text.trim()) {
      this.timer = window.setTimeout(() => tok === this.token && this.speakFrom(k + 1, 0), 0);
      return;
    }
    if (this.sim || !synth) {
      this.simulate(k, from, tok);
      return;
    }
    const v = pickVoice(this.lang);
    if (!v && voices.length > 0) {
      // Voice list arrived and has no voice for this language: switch to silent mode.
      this.sim = true;
      this.simReason = 'novoice';
      this.listener?.onState();
      this.simulate(k, from, tok);
      return;
    }
    let alive = false;
    try {
      const ut = new SpeechSynthesisUtterance(text);
      ut.lang = langInfo(this.lang).tts[0];
      if (v) {
        ut.voice = v;
        ut.lang = v.lang;
      }
      ut.rate = settings.rate;
      ut.onstart = () => {
        alive = true;
        this.lastEvent++;
      };
      ut.onboundary = (e) => {
        if (tok !== this.token) return;
        alive = true;
        this.lastEvent++;
        if (e.name && e.name !== 'word') return;
        const ci = from + e.charIndex;
        this.lastWord = ci;
        this.emitWord(k, ci, e.charLength || wordLen(u.speech, ci));
      };
      ut.onend = () => {
        if (tok !== this.token) return;
        this.lastEvent++;
        this.speakFrom(k + 1, 0);
      };
      ut.onerror = (e) => {
        if (tok !== this.token) return;
        if (e.error === 'interrupted' || e.error === 'canceled') return;
        if (!alive) this.goSim(k, from);
        else this.speakFrom(k + 1, 0);
      };
      this.current = ut;
      synth.speak(ut);
      this.timer = window.setTimeout(() => {
        if (tok === this.token && !alive && this.state === 'playing' && !synth.speaking) this.goSim(k, from);
      }, 5000);
    } catch {
      this.goSim(k, from);
    }
  }

  private simulate(k: number, from: number, tok: number) {
    const speech = this.utts[k].speech;
    const words: [number, number][] = [];
    const re = /\S+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(speech))) if (m.index >= from) words.push([m.index, m[0].length]);
    const step = (i: number) => {
      if (tok !== this.token) return;
      if (this.state === 'paused') {
        this.resumeFn = () => step(i);
        return;
      }
      if (i >= words.length) {
        this.speakFrom(k + 1, 0);
        return;
      }
      this.lastWord = words[i][0];
      this.emitWord(k, words[i][0], wordLen(speech, words[i][0]));
      this.timer = window.setTimeout(() => step(i + 1), (230 + words[i][1] * 38) / settings.rate);
    };
    step(0);
  }
}

export const speaker = new Speaker();

// Phones may cut speech when the tab is hidden or the screen locks: show it as paused.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && MOBILE && speaker.state === 'playing') speaker.pause();
});
