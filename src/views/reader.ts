// Chapter reader: blocks with photos, per-block player, highlighting, "Только главное" mode and the mini-player.
import { FACT_LABELS, imgUrl, type Block, type Chapter } from '../content';
import { ICON } from '../icons';
import { hasVoice, onVoices, speaker, voiceHelp, type SpeakerListener } from '../speech';
import { markDone, progress, saveSettings, setLastPlace, settings, type Lang } from '../store';
import { esc, paragraphPieces, pieceHtml, simplePiece, type Piece } from '../text';

const RATES = [0.8, 1, 1.2, 1.5];

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
const sentencesLabel = (n: number) => `${n} ${plural(n, 'предложение', 'предложения', 'предложений')}`;
const rateLabel = () => String(settings.rate).replace('.', ',') + '×';

const LEGEND = `<div class="legend">
  <span><i class="lg-now"></i>звучит сейчас</span>
  <span><i class="lg-word"></i>текущее слово</span>
  <span><i class="lg-key"></i>ключевой факт</span>
  <span><b class="lg-read">Aa</b>уже прочитано</span>
</div>`;

/** A playable sequence of pieces rendered inside `root` as [data-k] spans. */
class Track implements SpeakerListener {
  private curK = -1;
  constructor(
    readonly owner: string,
    readonly pieces: Piece[],
    readonly root: HTMLElement,
    private hooks: { state(): void; end(): void },
    private lang: Lang,
  ) {}

  span(k: number): HTMLElement | null {
    return this.root.querySelector<HTMLElement>(`[data-k="${k}"]`);
  }

  play(k = 0) {
    speaker.start(this.owner, this.lang, this.pieces.map((p) => p.utt), k, this);
  }

  get active() {
    return speaker.owner === this.owner;
  }

  onIndex(k: number) {
    if (this.curK >= 0 && this.curK !== k) {
      const prev = this.span(this.curK);
      if (prev) prev.innerHTML = pieceHtml(this.pieces[this.curK]);
    }
    this.curK = k;
    this.root.querySelectorAll<HTMLElement>('[data-k]').forEach((el) => {
      const i = Number(el.dataset.k);
      el.classList.toggle('read', i < k);
      el.classList.toggle('cur', i === k);
    });
    const el = this.span(k);
    if (el) {
      const r = el.getBoundingClientRect();
      const bottomLimit = window.innerHeight - 140; // mini-player height
      if (r.top < 70 || r.bottom > bottomLimit) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    this.hooks.state();
  }

  onWord(k: number, start: number, end: number) {
    const el = this.span(k);
    if (el) el.innerHTML = pieceHtml(this.pieces[k], { start, end });
  }

  onState() {
    if (!this.active) this.reset();
    this.hooks.state();
  }

  onEnd() {
    this.reset(true);
    this.hooks.end();
  }

  reset(keepRead = false) {
    if (this.curK >= 0) {
      const el = this.span(this.curK);
      if (el) el.innerHTML = pieceHtml(this.pieces[this.curK]);
    }
    this.curK = -1;
    this.root.querySelectorAll<HTMLElement>('[data-k]').forEach((el) => {
      el.classList.remove('cur');
      if (!keepRead) el.classList.remove('read');
    });
  }
}

class BlockView {
  el: HTMLElement;
  track: Track;
  factTrack: Track | null = null;
  private pieces: Piece[] = [];
  private factPieces: Piece[] = [];

  constructor(
    readonly block: Block,
    readonly chapter: Chapter,
    private lang: Lang,
    private reader: Reader,
  ) {
    this.el = document.createElement('section');
    this.el.className = `block kind-${block.kind}`;
    this.el.id = `b-${block.id}`;
    this.el.dataset.id = block.id;
    this.build();
    this.track = new Track(block.id, this.pieces, this.el.querySelector('.full')!, {
      state: () => this.updateUi(),
      end: () => this.reader.blockEnded(this),
    }, lang);
    if (this.factPieces.length) {
      this.factTrack = new Track(block.id + '#facts', this.factPieces, this.el.querySelector('.factlist')!, {
        state: () => this.updateUi(),
        end: () => this.updateUi(),
      }, lang);
    }
    this.bind();
    this.updateUi();
  }

  get title(): string {
    return this.block.heading || this.chapter.title;
  }

  private build() {
    const b = this.block;
    const lang = this.lang;
    let k = 0;
    let html = '<div class="full">';
    if (b.heading) {
      this.pieces.push(simplePiece(b.heading, lang, k));
      html += `<h2 class="bh"><span class="s" data-k="${k}">${esc(b.heading)}</span></h2>`;
      k++;
    }
    if (b.images.length) {
      html += `<div class="imgs n${Math.min(b.images.length, 3)}">`;
      b.images.forEach((img, i) => {
        let cap = '';
        if (img.caption) {
          if (settings.readCaptions) {
            const p = simplePiece(img.caption, lang, k);
            this.pieces.push(p);
            cap = `<figcaption><span class="s" data-k="${k}">${pieceHtml(p)}</span></figcaption>`;
            k++;
          } else cap = `<figcaption>${esc(img.caption)}</figcaption>`;
        }
        const cls = [i === 0 ? 'lead' : '', (img.w ?? 0) >= 500 ? 'wide' : ''].join(' ').trim();
        html += `<figure class="${cls}"><img src="${imgUrl(img.src)}" alt="${esc(img.caption)}" ${img.w ? `width="${img.w}" height="${img.h}"` : ''} loading="lazy">${cap}</figure>`;
      });
      html += '</div>';
    }
    html += '<div class="paras">';
    for (const para of b.paragraphs) {
      const ps = paragraphPieces(para, b.keyFacts, lang, k);
      k += ps.length;
      this.pieces.push(...ps);
      html += '<p>' + ps.map((p) => `<span class="s" data-k="${p.k}">${pieceHtml(p)}</span>`).join(' ') + '</p>';
    }
    html += '</div>';
    const sentences = this.pieces.length;
    html += `<div class="player">
      <button class="btn-play" type="button">${ICON.play}<span>Слушать</span></button>
      <button class="btn-round btn-stop" type="button" aria-label="Стоп">${ICON.stop}</button>
      <button class="btn-round btn-rate" type="button" aria-label="Скорость">${rateLabel()}</button>
      <span class="pinfo">${sentencesLabel(sentences)}</span>
      <button class="btn-done" type="button" aria-pressed="false" title="Отметить как прочитанное">${ICON.check}<span>Прочитано</span></button>
    </div>
    <div class="simnote" hidden></div>
    ${settings.showLegend ? LEGEND : ''}
    </div>`;

    // "Только главное": the sentences that contain key facts.
    const withFacts = this.pieces.filter((p) => p.facts.length);
    this.factPieces = withFacts.map((p, i) => ({ ...p, k: i }));
    html += `<div class="facts">
      <div class="facts-head"><h2>${esc(this.title)}</h2>
        ${this.factPieces.length ? `<button class="btn-round btn-facts" type="button" aria-label="Озвучить факты блока">${ICON.speaker}</button>` : ''}
      </div>
      <ul class="factlist">${this.factPieces
        .map((p) => {
          const types = [...new Set(p.facts.map((f) => f.type))];
          return `<li><div class="chips">${types.map((t) => `<span class="chip chip-${t}">${FACT_LABELS[t] ?? t}</span>`).join('')}</div>
            <div class="ftext"><span class="s" data-k="${p.k}">${pieceHtml(p)}</span></div></li>`;
        })
        .join('')}</ul>
      <a class="readfull" href="#/${lang}/${this.chapter.id}/${b.id}">Читать полностью →</a>
    </div>`;
    if (!this.factPieces.length) this.el.classList.add('nofacts');
    this.el.innerHTML = html;
  }

  private bind() {
    const q = <T extends HTMLElement>(s: string) => this.el.querySelector<T>(s)!;
    q('.btn-play').addEventListener('click', () => {
      if (this.track.active) speaker.toggle();
      else this.track.play(0);
    });
    q('.btn-stop').addEventListener('click', () => {
      if (this.track.active || this.factTrack?.active) speaker.stop();
    });
    q('.btn-rate').addEventListener('click', () => this.reader.cycleRate());
    q('.btn-done').addEventListener('click', () => {
      markDone(this.block.id, !progress[this.block.id]);
      this.updateUi();
    });
    // Tap on a sentence: start reading from it.
    q('.full').addEventListener('click', (e) => {
      const s = (e.target as HTMLElement).closest<HTMLElement>('.full [data-k]');
      if (!s || window.getSelection()?.toString()) return;
      const k = Number(s.dataset.k);
      if (this.track.active) speaker.seek(k);
      else this.track.play(k);
    });
    this.el.querySelector('.btn-facts')?.addEventListener('click', () => {
      if (this.factTrack!.active) speaker.toggle();
      else this.factTrack!.play(0);
    });
    q('.readfull').addEventListener('click', (e) => {
      e.preventDefault();
      this.reader.setFactsOnly(false);
      this.reader.scrollTo(this.block.id, true);
    });
  }

  updateUi() {
    const active = this.track.active;
    const playing = active && speaker.state === 'playing';
    const btn = this.el.querySelector<HTMLElement>('.btn-play')!;
    btn.classList.toggle('on', active);
    btn.innerHTML = playing
      ? `${ICON.pause}<span>Пауза</span>`
      : `${ICON.play}<span>${active && speaker.state === 'paused' ? 'Продолжить' : 'Слушать'}</span>`;
    this.el.querySelector('.pinfo')!.textContent = active
      ? `Предложение ${speaker.k + 1} из ${this.pieces.length}`
      : sentencesLabel(this.pieces.length);
    const note = this.el.querySelector<HTMLElement>('.simnote')!;
    note.hidden = !(active && speaker.sim);
    if (!note.hidden) {
      note.textContent =
        speaker.simReason === 'novoice'
          ? `На этом устройстве нет голоса для языка ${this.lang.toUpperCase()}, поэтому подсветка идёт без звука. ${voiceHelp(this.lang)}`
          : 'Голос не отвечает — подсветка идёт в демо-режиме, без звука. Проверьте голоса в «Настройках».';
    }
    const done = !!progress[this.block.id];
    const d = this.el.querySelector<HTMLElement>('.btn-done')!;
    d.classList.toggle('on', done);
    d.setAttribute('aria-pressed', String(done));
    this.el.classList.toggle('playing', active);
    const fb = this.el.querySelector<HTMLElement>('.btn-facts');
    if (fb) {
      const fp = !!this.factTrack?.active && speaker.state === 'playing';
      fb.innerHTML = fp ? ICON.pause : ICON.speaker;
      fb.classList.toggle('on', !!this.factTrack?.active);
    }
    this.el.querySelector('.btn-rate')!.textContent = rateLabel();
    this.reader.updateMini();
  }
}

export class Reader {
  views: BlockView[] = [];
  private root: HTMLElement;
  private mini: HTMLElement;
  private observer: IntersectionObserver | null = null;
  private visible = new Set<string>();
  private offVoices: () => void = () => {};

  constructor(
    host: HTMLElement,
    readonly lang: Lang,
    readonly chapter: Chapter,
  ) {
    this.root = host;
    this.mini = document.getElementById('mini')!;
    const pages = chapter.pages[0] === chapter.pages[1] ? `${chapter.pages[0]}` : `${chapter.pages[0]}–${chapter.pages[1]}`;
    const kicker = lang === 'ru' ? 'Откройте для себя Канаду' : 'Discover Canada';
    const footer = lang === 'ru' ? 'Учебное пособие для подготовки к экзамену на гражданство' : 'Your Canadian Citizenship Study Guide';
    host.innerHTML = `<article class="reader ${settings.factsOnly ? 'facts-mode' : ''}" lang="${lang}">
      <header class="ch-head">
        <div class="kicker">${kicker} · стр. ${pages}</div>
        <h1>${esc(chapter.title)}</h1>
        <div class="redbar"></div>
        <div class="voicewarn" role="status" hidden></div>
        <label class="switch"><span>Только главное</span><input type="checkbox" ${settings.factsOnly ? 'checked' : ''}><i></i></label>
        <div class="facts-legend">${Object.entries(FACT_LABELS)
          .map(([t, l]) => `<span class="chip chip-${t}">${l}</span>`)
          .join('')}</div>
      </header>
      <div class="blocks"></div>
      <footer class="pagefoot"><span>${footer}</span><b>${pages}</b></footer>
      ${lang === 'ru' ? '<p class="unofficial">Неофициальный перевод; официальны только английская и французская версии.</p>' : ''}
      <a class="to-quiz" href="#/quiz/${chapter.id}">Проверить себя: вопросы по главе →</a>
    </article>`;
    this.bindMini();
    const list = host.querySelector('.blocks')!;
    for (const b of chapter.blocks) {
      const v = new BlockView(b, chapter, lang, this);
      this.views.push(v);
      list.appendChild(v.el);
    }
    host.querySelector<HTMLInputElement>('.switch input')!.addEventListener('change', (e) => {
      this.setFactsOnly((e.target as HTMLInputElement).checked);
    });
    this.mini.hidden = false;
    document.body.classList.add('has-mini');
    const warn = () => {
      const el = host.querySelector<HTMLElement>('.voicewarn');
      if (!el) return;
      const missing = hasVoice(lang) === false;
      el.hidden = !missing;
      if (missing)
        el.innerHTML = `<b>На этом устройстве нет ${lang === 'ru' ? 'русского' : 'английского'} голоса</b> — текст не будет озвучиваться, только подсветка. ${esc(voiceHelp(lang))}`;
    };
    warn();
    this.offVoices = onVoices(warn);
    this.updateMini();
    if ('IntersectionObserver' in window) {
      this.observer = new IntersectionObserver((entries) => {
        for (const en of entries) {
          const id = (en.target as HTMLElement).dataset.id!;
          if (en.isIntersecting) this.visible.add(id);
          else this.visible.delete(id);
        }
        const id = this.currentBlockId();
        if (id) setLastPlace(lang, chapter.id, id);
      });
      this.views.forEach((v) => this.observer!.observe(v.el));
    }
  }

  destroy() {
    this.offVoices();
    speaker.stop();
    this.observer?.disconnect();
    this.mini.hidden = true;
    document.body.classList.remove('has-mini');
  }

  setFactsOnly(on: boolean) {
    if (speaker.owner) speaker.stop();
    settings.factsOnly = on;
    saveSettings();
    this.root.querySelector('.reader')!.classList.toggle('facts-mode', on);
    const cb = this.root.querySelector<HTMLInputElement>('.switch input');
    if (cb) cb.checked = on;
  }

  cycleRate() {
    settings.rate = RATES[(RATES.indexOf(settings.rate) + 1) % RATES.length] ?? 1;
    saveSettings();
    this.views.forEach((v) => v.updateUi());
    speaker.restartCurrent();
  }

  /** Block currently being read, or the top-most visible one. */
  currentBlockId(): string | null {
    const playing = this.views.find((v) => v.track.active || v.factTrack?.active);
    if (playing) return playing.block.id;
    // The first block that reaches below the reading line (just under the sticky header).
    const line = 140;
    const v = this.views.find((x) => x.el.offsetParent !== null && x.el.getBoundingClientRect().bottom > line);
    return v ? v.block.id : null;
  }

  scrollTo(blockId: string, flash = false) {
    const v = this.views.find((x) => x.block.id === blockId);
    if (!v) return;
    v.el.scrollIntoView({ behavior: 'auto', block: 'start' });
    if (flash) {
      v.el.classList.remove('flash');
      void v.el.offsetWidth;
      v.el.classList.add('flash');
    }
  }

  blockEnded(v: BlockView) {
    markDone(v.block.id);
    v.updateUi();
    if (!settings.autoNext) return;
    const i = this.views.indexOf(v);
    const next = this.views[i + 1];
    if (next) {
      next.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      next.track.play(0);
    }
  }

  private activeView(): BlockView | undefined {
    return this.views.find((v) => v.track.active || v.factTrack?.active);
  }

  private bindMini() {
    const m = this.mini;
    m.innerHTML = `<div class="mbar"><i></i></div>
      <div class="mrow">
        <div class="minfo"><div class="mtitle"></div><div class="msub"></div></div>
        <div class="mbtns">
          <button type="button" class="m-pb" aria-label="Предыдущий блок">${ICON.prevBlock}</button>
          <button type="button" class="m-ps" aria-label="Предыдущее предложение">${ICON.prev}</button>
          <button type="button" class="m-toggle" aria-label="Слушать">${ICON.play}</button>
          <button type="button" class="m-ns" aria-label="Следующее предложение">${ICON.next}</button>
          <button type="button" class="m-nb" aria-label="Следующий блок">${ICON.nextBlock}</button>
          <button type="button" class="m-stop" aria-label="Стоп">${ICON.stop}</button>
        </div>
      </div>`;
    const on = (sel: string, f: () => void) => m.querySelector(sel)!.addEventListener('click', f);
    on('.m-toggle', () => {
      if (speaker.owner && this.activeView()) speaker.toggle();
      else {
        const id = this.currentBlockId();
        const v = this.views.find((x) => x.block.id === id) ?? this.views[0];
        if (settings.factsOnly && v.factTrack) v.factTrack.play(0);
        else v.track.play(0);
      }
    });
    on('.m-stop', () => speaker.stop());
    on('.m-ps', () => speaker.seek(Math.max(0, speaker.k - 1)));
    on('.m-ns', () => speaker.seek(speaker.k + 1));
    const jump = (d: number) => {
      const cur = this.activeView() ?? this.views.find((x) => x.block.id === this.currentBlockId());
      const i = cur ? this.views.indexOf(cur) : -1;
      const t = this.views[Math.max(0, Math.min(this.views.length - 1, i + d))];
      if (!t) return;
      t.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (settings.factsOnly && t.factTrack) t.factTrack.play(0);
      else t.track.play(0);
    };
    on('.m-pb', () => jump(-1));
    on('.m-nb', () => jump(1));
  }

  updateMini() {
    const v = this.activeView();
    const m = this.mini;
    const playing = !!v && speaker.state === 'playing';
    m.querySelector('.mtitle')!.textContent = v ? v.title : 'Ничего не звучит';
    m.querySelector('.msub')!.textContent = v
      ? `Предложение ${speaker.k + 1} из ${speaker.count}${speaker.state === 'paused' ? ' · пауза' : ''}`
      : 'Нажмите «Слушать» под блоком';
    m.querySelector('.m-toggle')!.innerHTML = playing ? ICON.pause : ICON.play;
    m.querySelector('.m-toggle')!.setAttribute('aria-label', playing ? 'Пауза' : 'Слушать');
    const pct = v && speaker.count ? Math.round(((speaker.k + 1) / speaker.count) * 100) : 0;
    m.querySelector<HTMLElement>('.mbar i')!.style.width = pct + '%';
    m.querySelectorAll<HTMLButtonElement>('.m-ps,.m-ns,.m-stop').forEach((b) => (b.disabled = !v));
  }
}
