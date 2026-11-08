// Chapter training: one question at a time, immediate answer + explanation + link to the brochure block.
import { chapter, findBlock, questions, TOC, type Question } from '../content';
import { ICON } from '../icons';
import { recordAnswer, saveSettings, settings, type Lang } from '../store';
import { esc } from '../text';
import { plural } from './reader';

function shuffle<T>(a: T[]): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

export function renderQuizMenu(host: HTMLElement, lang: Lang) {
  const rows = TOC.map((t) => {
    const n = questions(lang, t.id).length;
    const title = lang === 'ru' ? t.ru : t.en;
    return n
      ? `<a class="qrow" href="#/quiz/${t.id}"><span>${esc(title)}</span><b>${n} ${plural(n, 'вопрос', 'вопроса', 'вопросов')} →</b></a>`
      : `<div class="qrow off"><span>${esc(title)}</span><b>скоро</b></div>`;
  }).join('');
  host.innerHTML = `<div class="page">
    <div class="kicker">Тест</div>
    <h1 class="ptitle">Тренировка по главам</h1>
    <div class="redbar"></div>
    <p class="muted">Вопросы на английском, как на настоящем экзамене. После ответа — объяснение${lang === 'ru' ? ' по-русски' : ''} и ссылка на нужное место брошюры.</p>
    <div class="qlist">${rows}</div>
    <div class="qrow off"><span>Пробный экзамен: 20 вопросов, 30 минут</span><b>этап 3</b></div>
  </div>`;
}

export function renderQuiz(host: HTMLElement, lang: Lang, chapterId: string) {
  const pool = questions(lang, chapterId);
  const ch = chapter(lang, chapterId);
  if (!pool.length || !ch) {
    renderQuizMenu(host, lang);
    return;
  }
  const order = shuffle(pool);
  let i = 0;
  let correct = 0;
  const wrong: Question[] = [];

  const show = () => {
    const q = order[i];
    const opts = shuffle(q.options.map((text, idx) => ({ text, idx, ru: q.optionsRu?.[idx] })));
    let answered = false;
    const tr = lang === 'ru' && settings.showTranslation;
    host.innerHTML = `<div class="page quiz">
      <div class="qtop"><span>Вопрос <b>${i + 1}</b> из ${order.length}</span><span>Верно: <b>${correct}</b> из ${i}</span></div>
      <div class="qprog"><i style="width:${Math.round((i / order.length) * 100)}%"></i></div>
      <div class="kicker">Глава «${esc(ch.title)}»</div>
      <h1 class="qtext">${esc(q.question)}</h1>
      ${lang === 'ru' && q.questionRu ? `<button class="btn-small btn-tr" type="button">${tr ? 'Скрыть перевод' : 'Показать перевод'}</button>
        <p class="qru" ${tr ? '' : 'hidden'}>${esc(q.questionRu)}</p>` : ''}
      <div class="opts">${opts
        .map(
          (o, n) => `<button class="opt" type="button" data-idx="${o.idx}">
            <span class="ol">${'ABCD'[n] ?? n + 1}</span>
            <span class="ot"><span>${esc(o.text)}</span>${o.ru ? `<span class="oru" ${tr ? '' : 'hidden'}>${esc(o.ru)}</span>` : ''}<span class="onote"></span></span>
          </button>`,
        )
        .join('')}</div>
      <div class="explain" hidden></div>
      <div class="qnav">
        <a class="btn-ghost" href="#/quiz">Завершить</a>
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
        if (answered) return;
        answered = true;
        const idx = Number(b.dataset.idx);
        const ok = idx === q.answer;
        if (ok) correct++;
        else wrong.push(q);
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
        const fb = findBlock(lang, q.blockId);
        const ex = host.querySelector<HTMLElement>('.explain')!;
        ex.hidden = false;
        ex.innerHTML = `<div class="ex-title">${ok ? 'Верно!' : 'Почему так'}</div>
          <p>${esc(q.explanation)}</p>
          ${fb ? `<a href="#/${lang}/${fb.chapter.id}/${fb.block.id}?hl=1">Прочитать в брошюре: «${esc(fb.block.heading || fb.chapter.title)}», стр. ${fb.block.page} →</a>` : ''}`;
        host.querySelector<HTMLButtonElement>('.btn-next')!.disabled = false;
        host.querySelector('.qtop')!.innerHTML = `<span>Вопрос <b>${i + 1}</b> из ${order.length}</span><span>Верно: <b>${correct}</b> из ${i + 1}</span>`;
      }),
    );
    host.querySelector('.btn-next')!.addEventListener('click', () => {
      i++;
      if (i < order.length) show();
      else result();
      window.scrollTo(0, 0);
    });
  };

  const result = () => {
    const pct = Math.round((correct / order.length) * 100);
    host.innerHTML = `<div class="page quiz">
      <div class="kicker">Глава «${esc(ch.title)}»</div>
      <h1 class="ptitle">Результат: ${correct} из ${order.length}</h1>
      <div class="redbar"></div>
      <p class="score ${pct >= 75 ? 'pass' : 'fail'}">${pct}% — ${pct >= 75 ? 'хорошо! (на экзамене нужно 15 из 20, то есть 75%)' : 'пока меньше 75%, нужных на экзамене. Повторите блоки ниже.'}</p>
      ${wrong.length ? `<h2 class="sub">Ошибки</h2><ul class="mistakes">${wrong
        .map((q) => {
          const fb = findBlock(lang, q.blockId);
          return `<li><b>${esc(q.question)}</b><span>Правильно: ${esc(q.options[q.answer])}</span><p>${esc(q.explanation)}</p>
            ${fb ? `<a href="#/${lang}/${fb.chapter.id}/${fb.block.id}?hl=1">Прочитать в брошюре, стр. ${fb.block.page} →</a>` : ''}</li>`;
        })
        .join('')}</ul>` : ''}
      <div class="qnav">
        <a class="btn-ghost" href="#/${lang}/${chapterId}">К главе</a>
        <button class="btn-main btn-again" type="button">Ещё раз</button>
      </div>
    </div>`;
    host.querySelector('.btn-again')!.addEventListener('click', () => renderQuiz(host, lang, chapterId));
  };

  show();
}
