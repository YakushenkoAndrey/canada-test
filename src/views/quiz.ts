// Tests: chapter training, mock exam, "Мои ошибки" review and the Ontario / Brantford quiz.
// All share one question runner: one question at a time, immediate answer, explanation and a link to the brochure.
import { chapter, chapters, chapterSize, findBlock, ontario, ontarioQuestions, questions, TOC, type Question } from '../content';
import { ICON } from '../icons';
import {
  addAttempt,
  attempts,
  dueAt,
  isMistake,
  recordAnswer,
  saveSettings,
  settings,
  weightOf,
  type Lang,
} from '../store';
import { esc } from '../text';
import { plural } from './reader';

export const EXAM_SIZE = 20;
export const EXAM_PASS = 15;
export const EXAM_MINUTES = 30;

type Cleanup = () => void;

function shuffle<T>(a: T[]): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/** Pick k items without replacement, items with bigger weight are picked more often. */
function weightedSample<T>(items: T[], k: number, weight: (x: T) => number): T[] {
  const pool = items.slice();
  const out: T[] = [];
  while (out.length < k && pool.length) {
    const total = pool.reduce((s, x) => s + weight(x), 0);
    let r = Math.random() * total;
    let i = 0;
    for (; i < pool.length - 1; i++) {
      r -= weight(pool[i]);
      if (r <= 0) break;
    }
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

/** 20 questions from all chapters, proportional to chapter text size; mistakes come up more often. */
export function pickExam(lang: Lang, n = EXAM_SIZE): Question[] {
  const chs = chapters(lang)
    .map((c) => ({ c, qs: questions(lang, c.id), size: chapterSize(c) }))
    .filter((x) => x.qs.length);
  const total = chs.reduce((s, x) => s + x.size, 0);
  const quota = chs.map((x) => (x.size / total) * n);
  const take = quota.map((q, i) => Math.min(Math.floor(q), chs[i].qs.length));
  // Largest remainder for the seats left, respecting how many questions each chapter has.
  let left = n - take.reduce((s, x) => s + x, 0);
  const order = chs.map((_, i) => i).sort((a, b) => quota[b] - Math.floor(quota[b]) - (quota[a] - Math.floor(quota[a])));
  while (left > 0) {
    let moved = false;
    for (const i of order) {
      if (left > 0 && take[i] < chs[i].qs.length) {
        take[i]++;
        left--;
        moved = true;
      }
    }
    if (!moved) break;
  }
  const picked = chs.flatMap((x, i) => weightedSample(x.qs, take[i], (q) => weightOf(q.id)));
  return shuffle(picked);
}

/** Questions to review: answered wrong and not learned yet, the most overdue first. */
export function mistakeQuestions(lang: Lang): Question[] {
  const all = [...questions(lang), ...ontarioQuestions(lang)];
  return all.filter((q) => isMistake(q.id)).sort((a, b) => dueAt(a.id) - dueAt(b.id));
}

function chapterTitle(lang: Lang, id: string): string {
  if (id === 'ontario') return lang === 'ru' ? 'Онтарио и Брантфорд' : 'Ontario and Brantford';
  const t = TOC.find((x) => x.id === id);
  return t ? (lang === 'ru' ? t.ru : t.en) : id;
}

function fmtDate(t: number): string {
  try {
    return new Date(t).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return new Date(t).toISOString().slice(0, 16).replace('T', ' ');
  }
}

function fmtClock(secs: number): string {
  const s = Math.max(0, Math.round(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function blockLink(lang: Lang, q: Question, full = true): string {
  if (!q.blockId) return '';
  const fb = findBlock(lang, q.blockId);
  if (!fb) return '';
  const name = full ? `: «${esc(fb.block.heading || fb.chapter.title)}», стр. ${fb.block.page}` : `, стр. ${fb.block.page}`;
  return `<a href="#/${lang}/${fb.chapter.id}/${fb.block.id}?hl=1">Прочитать в брошюре${name} →</a>`;
}

// ---------------------------------------------------------------- menu

export function renderQuizMenu(host: HTMLElement, lang: Lang): Cleanup {
  const nMist = mistakeQuestions(lang).length;
  const rows = TOC.map((t) => {
    const n = questions(lang, t.id).length;
    const title = lang === 'ru' ? t.ru : t.en;
    return n
      ? `<a class="qrow" href="#/quiz/${t.id}"><span>${esc(title)}</span><b>${n} ${plural(n, 'вопрос', 'вопроса', 'вопросов')} →</b></a>`
      : `<div class="qrow off"><span>${esc(title)}</span><b>скоро</b></div>`;
  }).join('');
  const hist = attempts.slice(0, 10);
  host.innerHTML = `<div class="page">
    <div class="kicker">Тест</div>
    <h1 class="ptitle">Подготовка к тесту</h1>
    <div class="redbar"></div>
    <p class="muted">Вопросы на английском, как на настоящем экзамене. После ответа — объяснение${lang === 'ru' ? ' по-русски' : ''} и ссылка на нужное место брошюры.</p>

    <section class="qcard exam-card">
      <h2>Пробный экзамен</h2>
      <p>${EXAM_SIZE} случайных вопросов из всех глав (больше — из больших глав). Чтобы сдать, нужно ${EXAM_PASS} верных ответов из ${EXAM_SIZE}.</p>
      <label class="switch"><span>Таймер ${EXAM_MINUTES} минут</span><input type="checkbox" data-timer ${settings.examTimer ? 'checked' : ''}><i></i></label>
      <a class="btn-main wide" href="#/exam">Начать экзамен →</a>
    </section>

    <section class="qcard">
      <h2>Мои ошибки</h2>
      <p>${nMist
        ? `${nMist} ${plural(nMist, 'вопрос', 'вопроса', 'вопросов')}, в которых вы ошиблись. Вопрос уходит из списка, когда вы ответите на него верно 3 раза подряд. В экзамене такие вопросы попадаются чаще.`
        : 'Пока ошибок нет. Вопросы, в которых вы ошибётесь, появятся здесь и будут чаще попадаться в экзамене.'}</p>
      ${nMist ? `<a class="btn-main wide" href="#/mistakes">Повторить ошибки (${Math.min(nMist, EXAM_SIZE)}) →</a>` : ''}
    </section>

    <section class="qcard">
      <h2>Онтарио и Брантфорд</h2>
      <p>Кто сейчас премьер Онтарио, вице-губернатор, ваш депутат и мэр. Проверено: ${fmtDay(ontario.checked)}.</p>
      <a class="btn-ghost wide" href="#/ontario">Открыть раздел →</a>
    </section>

    <h2 class="sub">Тренировка по главам</h2>
    <div class="qlist">${rows}</div>

    <h2 class="sub">История экзаменов</h2>
    ${hist.length
      ? `<ul class="hist">${hist
          .map(
            (a) => `<li class="${a.passed ? 'pass' : 'fail'}"><span>${fmtDate(a.t)}${a.lang === 'en' ? ' · EN' : ''}</span>
              <b>${a.score} / ${a.total}</b><i>${a.passed ? 'сдан' : a.timeUp ? 'время вышло' : 'не сдан'}</i></li>`,
          )
          .join('')}</ul>`
      : '<p class="muted small">Здесь появятся дата и результат каждого пробного экзамена.</p>'}
  </div>`;
  host.querySelector<HTMLInputElement>('[data-timer]')!.addEventListener('change', (e) => {
    settings.examTimer = (e.target as HTMLInputElement).checked;
    saveSettings();
  });
  return () => {};
}

function fmtDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  return y && m && d ? `${d} ${months[m - 1]} ${y} г.` : iso;
}

// ---------------------------------------------------------------- runner

interface SessionOpts {
  title: string;
  questions: Question[];
  mode: 'train' | 'exam' | 'mistakes' | 'ontario';
  timerMin: number | null;
  back: string;
  restart: () => void;
}

function runSession(host: HTMLElement, lang: Lang, o: SessionOpts): Cleanup {
  const order = o.questions;
  const exam = o.mode === 'exam';
  const need = Math.ceil(order.length * (EXAM_PASS / EXAM_SIZE));
  const started = Date.now();
  let i = 0;
  let correct = 0;
  let answeredCount = 0;
  let done = false;
  const wrong: { q: Question; chosen: number }[] = [];
  let tick = 0;

  const remaining = () => (o.timerMin ? o.timerMin * 60 - (Date.now() - started) / 1000 : 0);
  const stopTimer = () => window.clearInterval(tick);
  if (o.timerMin) {
    tick = window.setInterval(() => {
      const left = remaining();
      const el = host.querySelector<HTMLElement>('.timer');
      if (el) {
        el.textContent = fmtClock(left);
        el.classList.toggle('low', left < 120);
      }
      if (left <= 0) finish(true);
    }, 1000);
  }

  const topLine = () =>
    `<span>Вопрос <b>${i + 1}</b> из ${order.length}</span><span>Верно: <b>${correct}</b> из ${answeredCount}${exam ? ` · нужно ${need}` : ''}</span>`;

  const show = () => {
    if (done) return;
    const q = order[i];
    const opts = shuffle(q.options.map((text, idx) => ({ text, idx, ru: q.optionsRu?.[idx] })));
    let answered = false;
    const tr = lang === 'ru' && settings.showTranslation;
    host.innerHTML = `<div class="page quiz">
      <div class="qhead"><b>${esc(o.title)}</b>${o.timerMin ? `<span class="timer" aria-label="Осталось времени">${fmtClock(remaining())}</span>` : ''}</div>
      <div class="qtop">${topLine()}</div>
      <div class="qprog"><i style="width:${Math.round((i / order.length) * 100)}%"></i></div>
      <div class="kicker">Глава «${esc(chapterTitle(lang, q.chapter))}»</div>
      <h1 class="qtext">${esc(q.question)}</h1>
      ${lang === 'ru' && q.questionRu ? `<button class="btn-small btn-tr" type="button">${tr ? 'Скрыть перевод' : 'Показать перевод'}</button>
        <p class="qru" ${tr ? '' : 'hidden'}>${esc(q.questionRu)}</p>` : ''}
      <div class="opts">${opts
        .map(
          (op, n) => `<button class="opt" type="button" data-idx="${op.idx}">
            <span class="ol">${'ABCD'[n] ?? n + 1}</span>
            <span class="ot"><span>${esc(op.text)}</span>${op.ru ? `<span class="oru" ${tr ? '' : 'hidden'}>${esc(op.ru)}</span>` : ''}<span class="onote"></span></span>
          </button>`,
        )
        .join('')}</div>
      <div class="explain" hidden></div>
      <div class="qnav">
        <button class="btn-ghost btn-end" type="button">Завершить</button>
        <button class="btn-main btn-next" type="button" disabled>${i + 1 < order.length ? 'Дальше →' : 'Результат →'}</button>
      </div>
    </div>`;
    host.querySelector('.btn-tr')?.addEventListener('click', () => {
      settings.showTranslation = !settings.showTranslation;
      saveSettings();
      const on = settings.showTranslation;
      host.querySelector<HTMLElement>('.qru')!.hidden = !on;
      host.querySelectorAll<HTMLElement>('.oru').forEach((e) => (e.hidden = !on));
      host.querySelector('.btn-tr')!.textContent = on ? 'Скрыть перевод' : 'Показать перевод';
    });
    host.querySelectorAll<HTMLButtonElement>('.opt').forEach((b) =>
      b.addEventListener('click', () => {
        if (answered || done) return;
        answered = true;
        answeredCount++;
        const idx = Number(b.dataset.idx);
        const ok = idx === q.answer;
        if (ok) correct++;
        else wrong.push({ q, chosen: idx });
        recordAnswer(q.id, ok);
        host.querySelectorAll<HTMLButtonElement>('.opt').forEach((x) => {
          const xi = Number(x.dataset.idx);
          x.disabled = true;
          if (xi === q.answer) {
            x.classList.add('right');
            x.querySelector('.ol')!.innerHTML = ICON.check;
            x.querySelector('.onote')!.textContent = 'Правильный ответ';
          } else if (xi === idx) {
            x.classList.add('wrong');
            x.querySelector('.ol')!.innerHTML = ICON.cross;
            x.querySelector('.onote')!.textContent = 'Ваш ответ';
          }
        });
        const ex = host.querySelector<HTMLElement>('.explain')!;
        ex.hidden = false;
        ex.innerHTML = `<div class="ex-title">${ok ? 'Верно!' : 'Почему так'}</div><p>${esc(q.explanation)}</p>${blockLink(lang, q)}`;
        host.querySelector<HTMLButtonElement>('.btn-next')!.disabled = false;
        host.querySelector('.qtop')!.innerHTML = topLine();
      }),
    );
    host.querySelector('.btn-next')!.addEventListener('click', () => {
      i++;
      if (i < order.length) show();
      else finish(false);
      window.scrollTo(0, 0);
    });
    host.querySelector('.btn-end')!.addEventListener('click', () => {
      if (exam && answeredCount < order.length && !confirm('Завершить экзамен? Вопросы без ответа считаются неверными.')) return;
      finish(false);
    });
  };

  const finish = (timeUp: boolean) => {
    if (done) return;
    done = true;
    stopTimer();
    window.scrollTo(0, 0);
    const total = order.length;
    const unanswered = total - answeredCount;
    const secs = Math.round((Date.now() - started) / 1000);
    const passed = correct >= need;
    if (exam) addAttempt({ t: Date.now(), score: correct, total, passed, secs, lang, timeUp });
    const pct = total ? Math.round((correct / total) * 100) : 0;
    let verdict: string;
    if (exam) {
      verdict = passed
        ? `Экзамен сдан: ${correct} из ${total} (нужно ${need}). Время: ${fmtClock(secs)}.`
        : `Пока не сдан: ${correct} из ${total}, нужно ${need}.${timeUp ? ' Время вышло.' : ''} Повторите блоки ниже и попробуйте ещё раз.`;
    } else {
      verdict = `${pct}% — ${pct >= 75 ? 'хорошо! На экзамене нужно 15 из 20, то есть 75%.' : 'пока меньше 75%, нужных на экзамене. Повторите блоки ниже.'}`;
    }
    host.innerHTML = `<div class="page quiz">
      <div class="kicker">${esc(o.title)}</div>
      <h1 class="ptitle">Результат: ${correct} из ${total}</h1>
      <div class="redbar"></div>
      <p class="score ${(exam ? passed : pct >= 75) ? 'pass' : 'fail'}">${verdict}</p>
      ${unanswered && answeredCount < total ? `<p class="muted">Без ответа: ${unanswered} ${plural(unanswered, 'вопрос', 'вопроса', 'вопросов')}.</p>` : ''}
      ${wrong.length ? `<h2 class="sub">Ошибки</h2><ul class="mistakes">${wrong
        .map(
          ({ q, chosen }) => `<li><b>${esc(q.question)}</b>
            <span class="was">Ваш ответ: ${esc(q.options[chosen])}</span>
            <span>Правильно: ${esc(q.options[q.answer])}</span><p>${esc(q.explanation)}</p>${blockLink(lang, q, false)}</li>`,
        )
        .join('')}</ul><p class="muted small">Эти вопросы добавлены в «Мои ошибки».</p>` : ''}
      <div class="qnav">
        <a class="btn-ghost" href="${o.back}">К тестам</a>
        <button class="btn-main btn-again" type="button">${exam ? 'Новый экзамен' : 'Ещё раз'}</button>
      </div>
    </div>`;
    host.querySelector('.btn-again')!.addEventListener('click', () => o.restart());
  };

  if (!order.length) {
    host.innerHTML = `<div class="page"><h1 class="ptitle">${esc(o.title)}</h1><div class="redbar"></div>
      <p class="muted">Здесь пока нет вопросов.</p><a class="btn-ghost" href="${o.back}">К тестам</a></div>`;
  } else show();
  return stopTimer;
}

// ---------------------------------------------------------------- entry points

export function renderQuiz(host: HTMLElement, lang: Lang, chapterId: string): Cleanup {
  const ch = chapter(lang, chapterId);
  if (!ch) return renderQuizMenu(host, lang);
  const start = (): Cleanup =>
    runSession(host, lang, {
      title: `Тренировка: ${ch.title}`,
      questions: shuffle(questions(lang, chapterId)),
      mode: 'train',
      timerMin: null,
      back: '#/quiz',
      restart: () => start(),
    });
  return start();
}

export function renderExam(host: HTMLElement, lang: Lang): Cleanup {
  let stop: Cleanup = () => {};
  const start = () => {
    stop();
    stop = runSession(host, lang, {
      title: 'Пробный экзамен',
      questions: pickExam(lang),
      mode: 'exam',
      timerMin: settings.examTimer ? EXAM_MINUTES : null,
      back: '#/quiz',
      restart: start,
    });
  };
  start();
  return () => stop();
}

export function renderMistakes(host: HTMLElement, lang: Lang): Cleanup {
  const start = (): Cleanup =>
    runSession(host, lang, {
      title: 'Мои ошибки',
      questions: mistakeQuestions(lang).slice(0, EXAM_SIZE),
      mode: 'mistakes',
      timerMin: null,
      back: '#/quiz',
      restart: () => start(),
    });
  return start();
}

export function renderOntarioQuiz(host: HTMLElement, lang: Lang): Cleanup {
  const start = (): Cleanup =>
    runSession(host, lang, {
      title: 'Онтарио и Брантфорд',
      questions: shuffle(ontarioQuestions(lang)),
      mode: 'ontario',
      timerMin: null,
      back: '#/ontario',
      restart: () => start(),
    });
  return start();
}

export function renderOntario(host: HTMLElement, lang: Lang): Cleanup {
  const n = ontario.questions.length;
  host.innerHTML = `<div class="page ontario">
    <div class="kicker">Раздел вне брошюры</div>
    <h1 class="ptitle">Онтарио и Брантфорд</h1>
    <div class="redbar"></div>
    <p>На экзамене могут спросить, кто сейчас возглавляет вашу провинцию и кто ваши депутаты. Этих данных нет в брошюре, и они меняются после выборов.</p>
    <p class="checked">Проверено по официальным источникам: <b>${fmtDay(ontario.checked)}</b> ${esc(ontario.recheckNote)}</p>
    <dl class="facts-table">${ontario.facts
      .map(
        (f) => `<div><dt>${esc(lang === 'ru' ? f.ru : f.en)}</dt>
          <dd>${esc(lang === 'ru' ? f.valueRu : f.value)}
          <a class="src" href="${esc(f.source)}" target="_blank" rel="noopener">источник ↗</a></dd></div>`,
      )
      .join('')}</dl>
    <a class="btn-main wide" href="#/ontario/quiz">Пройти тест (${n} ${plural(n, 'вопрос', 'вопроса', 'вопросов')}) →</a>
    <p class="muted small">Если что-то изменилось (выборы, отставка), сверьтесь с источником по ссылке — сайт обновляется вручную.</p>
  </div>`;
  return () => {};
}
