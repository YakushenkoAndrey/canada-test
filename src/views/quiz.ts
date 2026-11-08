// Tests: chapter training, mock exam, "Мои ошибки" review and the "My city and province" quiz.
// All share one question runner: one question at a time, immediate answer, explanation and a link to the brochure.
import { allLocalQuestions, chapter, chapters, chapterSize, chapterTitle, findBlock, local, localCity, localQuestions, questions, TOC, tri, type LocalFact, type Question } from '../content';
import { ICON } from '../icons';
import { L, langInfo, nQuestions, plural, ui, uiLocale, type Lang } from '../langs';
import {
  activate,
  canMistakes,
  canLocalQuiz,
  canStartExam,
  canTrain,
  freeExamsLeft,
  isUnlocked,
  noteExamStarted,
  PAYWALL,
  paywallOn,
  unlockInfo,
} from '../paywall';
import { trackEvent } from '../analytics';
import { addAttempt, attempts, dueAt, isMistake, recordAnswer, saveSettings, settings, weightOf } from '../store';
import { esc } from '../text';

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
  const all = [...questions(lang), ...allLocalQuestions(lang)];
  return all.filter((q) => isMistake(q.id)).sort((a, b) => dueAt(a.id) - dueAt(b.id));
}

const localTitle = () => L('Мой город и провинция', 'My city and province', 'Моє місто і провінція');

/** "Brantford, Ontario" in the interface language. */
function cityLine(cityId: string): string {
  const c = localCity(cityId);
  return `${tri(c.name, ui())}, ${tri(local.provinces[c.province].name, ui())}`;
}

function qChapterTitle(lang: Lang, id: string): string {
  return id === 'local' ? localTitle() : chapterTitle(lang, id);
}

function fmtDate(t: number): string {
  try {
    return new Date(t).toLocaleString(uiLocale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return new Date(t).toISOString().slice(0, 16).replace('T', ' ');
  }
}

function fmtClock(secs: number): string {
  const s = Math.max(0, Math.round(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  if (ui() === 'en') return new Date(y, m - 1, d).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
  const uk = ui() === 'uk';
  const months = uk
    ? ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня']
    : ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  return `${d} ${months[m - 1]} ${y} ${uk ? 'р.' : 'г.'}`;
}

function blockLink(lang: Lang, q: Question, full = true): string {
  if (!q.blockId) return '';
  const fb = findBlock(lang, q.blockId);
  if (!fb) return '';
  const p = L('стр.', 'p.', 'с.');
  const name = full ? `: «${esc(fb.block.heading || fb.chapter.title)}», ${p} ${fb.block.page}` : `, ${p} ${fb.block.page}`;
  return `<a href="#/${lang}/${fb.chapter.id}/${fb.block.id}?hl=1">${L('Прочитать в брошюре', 'Read in the brochure', 'Прочитати в брошурі')}${name} →</a>`;
}

// ---------------------------------------------------------------- menu

function accessCard(): string {
  if (!paywallOn()) return '';
  if (isUnlocked()) {
    const u = unlockInfo();
    return `<p class="access-ok">✓ ${L('Полный доступ к тестам активирован', 'Full access to the tests is active', 'Повний доступ до тестів активовано')}${u?.email ? ` (${esc(u.email)})` : ''}.</p>`;
  }
  return `<section class="qcard buy-card">
    <h2>${L('Полный доступ к тестам', 'Full access to the tests', 'Повний доступ до тестів')} — ${PAYWALL.price}</h2>
    <p>${L(
      'Бесплатно: вся брошюра с озвучкой, тренировка по главе «Кто мы» и один пробный экзамен. Полный доступ открывает все 12 глав, безлимитные экзамены, «Мои ошибки» и тест «Мой город и провинция». Разовая покупка.',
      'Free: the whole brochure with audio, practice on “Who We Are” and one practice exam. Full access unlocks all 12 chapters, unlimited exams, “My mistakes” and the “My city and province” quiz. One-time purchase.', 'Безкоштовно: уся брошура з озвученням, тренування з розділу «Хто ми» та один пробний іспит. Повний доступ відкриває всі 12 розділів, необмежені іспити, «Мої помилки» та тест «Моє місто і провінція». Разова покупка.',
    )}</p>
    <a class="btn-main wide" href="#/unlock">${L('Подробнее и купить →', 'Details and purchase →', 'Докладніше та купити →')}</a>
  </section>`;
}

export function renderQuizMenu(host: HTMLElement, lang: Lang): Cleanup {
  const nMist = mistakeQuestions(lang).length;
  const rows = TOC.map((t) => {
    const n = questions(lang, t.id).length;
    const title = chapterTitle(lang, t.id);
    const mark = canTrain(t.id)
      ? paywallOn() && !isUnlocked() ? ` <em class="free">${L('бесплатно', 'free', 'безкоштовно')}</em>` : ''
      : ` <span class="lock" aria-label="${L('Полный доступ', 'Full access', 'Повний доступ')}">🔒</span>`;
    return n
      ? `<a class="qrow" href="#/quiz/${t.id}"><span>${esc(title)}${mark}</span><b>${nQuestions(n)} →</b></a>`
      : `<div class="qrow off"><span>${esc(title)}</span><b>${L('скоро', 'soon', 'незабаром')}</b></div>`;
  }).join('');
  const hist = attempts.slice(0, 10);
  const explLang = lang === 'en' ? '' : ` (${langInfo(lang).native})`;
  host.innerHTML = `<div class="page">
    <div class="kicker">${L('Тест', 'Test', 'Тест')}</div>
    <h1 class="ptitle">${L('Подготовка к тесту', 'Test preparation', 'Підготовка до тесту')}</h1>
    <div class="redbar"></div>
    <p class="muted">${L(
      `Вопросы на английском, как на настоящем экзамене. После ответа — объяснение${explLang} и ссылка на нужное место брошюры.`,
      `Questions are in English, like the real test. After each answer you get an explanation${explLang} and a link to the right place in the brochure.`, `Питання англійською, як на справжньому іспиті. Після відповіді — пояснення${explLang} і посилання на потрібне місце брошури.`,
    )}</p>
    ${accessCard()}

    <section class="qcard exam-card">
      <h2>${L('Пробный экзамен', 'Practice exam', 'Пробний іспит')}</h2>
      <p>${L(
        `${EXAM_SIZE} случайных вопросов из всех глав (больше — из больших глав). Чтобы сдать, нужно ${EXAM_PASS} верных ответов из ${EXAM_SIZE}.`,
        `${EXAM_SIZE} random questions from all chapters (more from longer chapters). To pass you need ${EXAM_PASS} correct answers out of ${EXAM_SIZE}.`, `${EXAM_SIZE} випадкових питань з усіх розділів (більше — з великих розділів). Щоб скласти, потрібно ${EXAM_PASS} правильних відповідей з ${EXAM_SIZE}.`,
      )}</p>
      <label class="switch"><span>${L(`Таймер ${EXAM_MINUTES} минут`, `${EXAM_MINUTES}-minute timer`, `Таймер ${EXAM_MINUTES} хвилин`)}</span><input type="checkbox" data-timer ${settings.examTimer ? 'checked' : ''}><i></i></label>
      ${isUnlocked() ? '' : `<p class="free-note">${freeExamsLeft()
        ? L('Первый пробный экзамен — бесплатно.', 'Your first practice exam is free.', 'Перший пробний іспит — безкоштовно.')
        : L(`Бесплатный экзамен использован. Безлимитные экзамены — в полном доступе (${PAYWALL.price}).`, `The free exam has been used. Unlimited exams come with full access (${PAYWALL.price}).`, `Безкоштовний іспит використано. Необмежені іспити — у повному доступі (${PAYWALL.price}).`)}</p>`}
      <a class="btn-main wide" href="#/exam">${canStartExam() ? L('Начать экзамен →', 'Start the exam →', 'Почати іспит →') : L('🔒 Открыть полный доступ →', '🔒 Get full access →', '🔒 Відкрити повний доступ →')}</a>
    </section>

    <section class="qcard">
      <h2>${L('Мои ошибки', 'My mistakes', 'Мої помилки')}</h2>
      <p>${nMist
        ? L(
            `${nQuestions(nMist)}, в которых вы ошиблись. Вопрос уходит из списка, когда вы ответите на него верно 3 раза подряд. В экзамене такие вопросы попадаются чаще.`,
            `${nQuestions(nMist)} you got wrong. A question leaves the list after 3 correct answers in a row. In the exam such questions come up more often.`, `${nQuestions(nMist)}, у яких ви помилилися. Питання зникає зі списку, коли ви відповісте на нього правильно 3 рази поспіль. На іспиті такі питання трапляються частіше.`,
          )
        : L('Пока ошибок нет. Вопросы, в которых вы ошибётесь, появятся здесь и будут чаще попадаться в экзамене.', 'No mistakes yet. Questions you get wrong will appear here and come up more often in the exam.', 'Поки помилок немає. Питання, у яких ви помилитеся, з’являться тут і частіше трапляться на іспиті.')}</p>
      ${nMist ? `<a class="btn-main wide" href="#/mistakes">${canMistakes() ? '' : '🔒 '}${L('Повторить ошибки', 'Review mistakes', 'Повторити помилки')} (${Math.min(nMist, EXAM_SIZE)}) →</a>` : ''}
    </section>

    <section class="qcard">
      <h2>${localTitle()}</h2>
      <p>${L('Кто сейчас премьер вашей провинции, вице-губернатор, мэр и как найти своего депутата.', 'Who is the Premier of your province, the Lieutenant Governor, your mayor, and how to find your MP.', 'Хто зараз прем’єр вашої провінції, лейтенант-губернатор, мер і як знайти свого депутата.')}
        ${L('Ваш город', 'Your city', 'Ваше місто')}: <b>${esc(cityLine(settings.city))}</b>. ${L('Проверено', 'Checked', 'Перевірено')}: ${fmtDay(local.checked)}</p>
      <a class="btn-ghost wide" href="#/local">${L('Открыть раздел →', 'Open →', 'Відкрити розділ →')}</a>
    </section>

    <h2 class="sub">${L('Тренировка по главам', 'Practice by chapter', 'Тренування за розділами')}</h2>
    <div class="qlist">${rows}</div>

    <h2 class="sub">${L('История экзаменов', 'Exam history', 'Історія іспитів')}</h2>
    ${hist.length
      ? `<ul class="hist">${hist
          .map(
            (a) => `<li class="${a.passed ? 'pass' : 'fail'}"><span>${fmtDate(a.t)} · ${a.lang.toUpperCase()}</span>
              <b>${a.score} / ${a.total}</b><i>${a.passed ? L('сдан', 'passed', 'складено') : a.timeUp ? L('время вышло', 'time is up', 'час вийшов') : L('не сдан', 'not passed', 'не складено')}</i></li>`,
          )
          .join('')}</ul>`
      : `<p class="muted small">${L('Здесь появятся дата и результат каждого пробного экзамена.', 'The date and score of each practice exam will appear here.', 'Тут з’являться дата й результат кожного пробного іспиту.')}</p>`}
  </div>`;
  host.querySelector<HTMLInputElement>('[data-timer]')!.addEventListener('change', (e) => {
    settings.examTimer = (e.target as HTMLInputElement).checked;
    saveSettings();
  });
  return () => {};
}

// ---------------------------------------------------------------- runner

interface SessionOpts {
  title: string;
  questions: Question[];
  mode: 'train' | 'exam' | 'mistakes' | 'local';
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
    L(
      `<span>Вопрос <b>${i + 1}</b> из ${order.length}</span><span>Верно: <b>${correct}</b> из ${answeredCount}${exam ? ` · нужно ${need}` : ''}</span>`,
      `<span>Question <b>${i + 1}</b> of ${order.length}</span><span>Correct: <b>${correct}</b> of ${answeredCount}${exam ? ` · need ${need}` : ''}</span>`, `<span>Питання <b>${i + 1}</b> з ${order.length}</span><span>Правильно: <b>${correct}</b> з ${answeredCount}${exam ? ` · потрібно ${need}` : ''}</span>`,
    );
  const dir = langInfo(lang).dir;

  const show = () => {
    if (done) return;
    const q = order[i];
    const opts = shuffle(q.options.map((text, idx) => ({ text, idx, tr: q.optionsTr?.[idx] })));
    let answered = false;
    const hasTr = lang !== 'en' && !!q.questionTr;
    const tr = hasTr && settings.showTranslation;
    host.innerHTML = `<div class="page quiz">
      <div class="qhead"><b>${esc(o.title)}</b>${o.timerMin ? `<span class="timer" aria-label="${L('Осталось времени', 'Time left', 'Залишилось часу')}">${fmtClock(remaining())}</span>` : ''}</div>
      <div class="qtop">${topLine()}</div>
      <div class="qprog"><i style="width:${Math.round((i / order.length) * 100)}%"></i></div>
      <div class="kicker">${L('Глава', 'Chapter', 'Розділ')} «${esc(qChapterTitle(lang, q.chapter))}»</div>
      <h1 class="qtext" lang="en">${esc(q.question)}</h1>
      ${hasTr ? `<button class="btn-small btn-tr" type="button">${tr ? L('Скрыть перевод', 'Hide translation', 'Сховати переклад') : L('Показать перевод', 'Show translation', 'Показати переклад')}</button>
        <p class="qru" lang="${lang}" dir="${dir}" ${tr ? '' : 'hidden'}>${esc(q.questionTr!)}</p>` : ''}
      <div class="opts">${opts
        .map(
          (op, n) => `<button class="opt" type="button" data-idx="${op.idx}">
            <span class="ol">${'ABCD'[n] ?? n + 1}</span>
            <span class="ot"><span lang="en">${esc(op.text)}</span>${op.tr ? `<span class="oru" lang="${lang}" dir="${dir}" ${tr ? '' : 'hidden'}>${esc(op.tr)}</span>` : ''}<span class="onote"></span></span>
          </button>`,
        )
        .join('')}</div>
      <div class="explain" hidden></div>
      <div class="qnav">
        <button class="btn-ghost btn-end" type="button">${L('Завершить', 'Finish', 'Завершити')}</button>
        <button class="btn-main btn-next" type="button" disabled>${i + 1 < order.length ? L('Дальше →', 'Next →', 'Далі →') : L('Результат →', 'Result →', 'Результат →')}</button>
      </div>
    </div>`;
    host.querySelector('.btn-tr')?.addEventListener('click', () => {
      settings.showTranslation = !settings.showTranslation;
      saveSettings();
      const on = settings.showTranslation;
      host.querySelector<HTMLElement>('.qru')!.hidden = !on;
      host.querySelectorAll<HTMLElement>('.oru').forEach((e) => (e.hidden = !on));
      host.querySelector('.btn-tr')!.textContent = on ? L('Скрыть перевод', 'Hide translation', 'Сховати переклад') : L('Показать перевод', 'Show translation', 'Показати переклад');
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
            x.querySelector('.onote')!.textContent = L('Правильный ответ', 'Correct answer', 'Правильна відповідь');
          } else if (xi === idx) {
            x.classList.add('wrong');
            x.querySelector('.ol')!.innerHTML = ICON.cross;
            x.querySelector('.onote')!.textContent = L('Ваш ответ', 'Your answer', 'Ваша відповідь');
          }
        });
        const ex = host.querySelector<HTMLElement>('.explain')!;
        ex.hidden = false;
        ex.innerHTML = `<div class="ex-title">${ok ? L('Верно!', 'Correct!', 'Правильно!') : L('Почему так', 'Why', 'Чому так')}</div><p lang="${lang}" dir="${dir}">${esc(q.explanation)}</p>${blockLink(lang, q)}`;
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
      if (exam && answeredCount < order.length && !confirm(L('Завершить экзамен? Вопросы без ответа считаются неверными.', 'Finish the exam? Unanswered questions count as wrong.', 'Завершити іспит? Питання без відповіді вважаються неправильними.'))) return;
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
    if (exam) trackEvent(passed ? 'exam/passed' : timeUp ? 'exam/time-up' : 'exam/failed');
    const pct = total ? Math.round((correct / total) * 100) : 0;
    let verdict: string;
    if (exam) {
      verdict = passed
        ? L(`Экзамен сдан: ${correct} из ${total} (нужно ${need}). Время: ${fmtClock(secs)}.`, `Passed: ${correct} of ${total} (need ${need}). Time: ${fmtClock(secs)}.`, `Іспит складено: ${correct} з ${total} (потрібно ${need}). Час: ${fmtClock(secs)}.`)
        : L(
            `Пока не сдан: ${correct} из ${total}, нужно ${need}.${timeUp ? ' Время вышло.' : ''} Повторите блоки ниже и попробуйте ещё раз.`,
            `Not passed yet: ${correct} of ${total}, need ${need}.${timeUp ? ' Time is up.' : ''} Review the sections below and try again.`, `Поки не складено: ${correct} з ${total}, потрібно ${need}.${timeUp ? ' Час вийшов.' : ''} Повторіть блоки нижче і спробуйте ще раз.`,
          );
    } else {
      verdict = `${pct}% — ${pct >= 75
        ? L('хорошо! На экзамене нужно 15 из 20, то есть 75%.', 'good! The test requires 15 of 20, that is 75%.', 'добре! На іспиті потрібно 15 з 20, тобто 75%.')
        : L('пока меньше 75%, нужных на экзамене. Повторите блоки ниже.', 'below the 75% needed on the test. Review the sections below.', 'поки менше 75%, потрібних на іспиті. Повторіть блоки нижче.')}`;
    }
    host.innerHTML = `<div class="page quiz">
      <div class="kicker">${esc(o.title)}</div>
      <h1 class="ptitle">${L('Результат', 'Result', 'Результат')}: ${correct} ${L('из', 'of', 'з')} ${total}</h1>
      <div class="redbar"></div>
      <p class="score ${(exam ? passed : pct >= 75) ? 'pass' : 'fail'}">${verdict}</p>
      ${unanswered && answeredCount < total ? `<p class="muted">${L('Без ответа', 'Unanswered', 'Без відповіді')}: ${nQuestions(unanswered)}.</p>` : ''}
      ${wrong.length ? `<h2 class="sub">${L('Ошибки', 'Mistakes', 'Помилки')}</h2><ul class="mistakes">${wrong
        .map(
          ({ q, chosen }) => `<li><b lang="en">${esc(q.question)}</b>
            <span class="was">${L('Ваш ответ', 'Your answer', 'Ваша відповідь')}: ${esc(q.options[chosen])}</span>
            <span>${L('Правильно', 'Correct', 'Правильно')}: ${esc(q.options[q.answer])}</span><p lang="${lang}" dir="${dir}">${esc(q.explanation)}</p>${blockLink(lang, q, false)}</li>`,
        )
        .join('')}</ul><p class="muted small">${L('Эти вопросы добавлены в «Мои ошибки».', 'These questions were added to “My mistakes”.', 'Ці питання додано до «Моїх помилок».')}</p>` : ''}
      <div class="qnav">
        <a class="btn-ghost" href="${o.back}">${L('К тестам', 'Back to tests', 'До тестів')}</a>
        <button class="btn-main btn-again" type="button">${exam ? L('Новый экзамен', 'New exam', 'Новий іспит') : L('Ещё раз', 'Again', 'Ще раз')}</button>
      </div>
    </div>`;
    host.querySelector('.btn-again')!.addEventListener('click', () => o.restart());
  };

  if (!order.length) {
    host.innerHTML = `<div class="page"><h1 class="ptitle">${esc(o.title)}</h1><div class="redbar"></div>
      <p class="muted">${L('Здесь пока нет вопросов.', 'No questions here yet.', 'Тут поки немає питань.')}</p><a class="btn-ghost" href="${o.back}">${L('К тестам', 'Back to tests', 'До тестів')}</a></div>`;
  } else show();
  return stopTimer;
}

// ---------------------------------------------------------------- entry points

export function renderQuiz(host: HTMLElement, lang: Lang, chapterId: string): Cleanup {
  const ch = chapter(lang, chapterId);
  if (!ch) return renderQuizMenu(host, lang);
  if (!canTrain(chapterId))
    return renderPaywall(host, L(`Тренировка по главе «${ch.title}» входит в полный доступ.`, `Practice on “${ch.title}” is part of full access.`, `Тренування з розділу «${ch.title}» входить у повний доступ.`));
  const start = (): Cleanup =>
    runSession(host, lang, {
      title: `${L('Тренировка', 'Practice', 'Тренування')}: ${ch.title}`,
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
    if (!canStartExam()) {
      stop = renderPaywall(host, L('Бесплатный пробный экзамен уже использован.', 'The free practice exam has already been used.', 'Безкоштовний пробний іспит уже використано.'));
      return;
    }
    noteExamStarted();
    stop = runSession(host, lang, {
      title: L('Пробный экзамен', 'Practice exam', 'Пробний іспит'),
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
  if (!canMistakes()) return renderPaywall(host, L('«Мои ошибки» входят в полный доступ.', '“My mistakes” is part of full access.', '«Мої помилки» входять у повний доступ.'));
  const start = (): Cleanup =>
    runSession(host, lang, {
      title: L('Мои ошибки', 'My mistakes', 'Мої помилки'),
      questions: mistakeQuestions(lang).slice(0, EXAM_SIZE),
      mode: 'mistakes',
      timerMin: null,
      back: '#/quiz',
      restart: () => start(),
    });
  return start();
}

export function renderLocalQuiz(host: HTMLElement, lang: Lang): Cleanup {
  if (!canLocalQuiz())
    return renderPaywall(
      host,
      L(
        'Тест «Мой город и провинция» входит в полный доступ. Сами факты на странице раздела — бесплатно.',
        'The “My city and province” quiz is part of full access. The facts on the section page are free.',
        'Тест «Моє місто і провінція» входить у повний доступ. Самі факти на сторінці розділу — безкоштовно.',
      ),
    );
  const start = (): Cleanup =>
    runSession(host, lang, {
      title: `${localTitle()}: ${cityLine(settings.city)}`,
      questions: shuffle(localQuestions(lang, settings.city)),
      mode: 'local',
      timerMin: null,
      back: '#/local',
      restart: () => start(),
    });
  return start();
}

function factRows(facts: LocalFact[], lang: Lang): string {
  return facts
    .map(
      (f) => `<div><dt>${esc(tri(f.label, ui()))}</dt>
          <dd>${esc(tri(f.value, lang))}
          <a class="src" href="${esc(f.source)}" target="_blank" rel="noopener">${L('источник', 'source', 'джерело')} ↗</a></dd></div>`,
    )
    .join('');
}

export function renderLocal(host: HTMLElement, lang: Lang): Cleanup {
  const draw = () => {
    const c = localCity(settings.city);
    const prov = local.provinces[c.province];
    const n = localQuestions(lang, c.id).length;
    const byProv = Object.values(local.provinces)
      .map((p) => ({ p, cities: local.cities.filter((x) => x.province === p.code).sort((a, b) => tri(a.name, ui()).localeCompare(tri(b.name, ui()))) }))
      .filter((g) => g.cities.length);
    host.innerHTML = `<div class="page local">
    <div class="kicker">${L('Раздел вне брошюры', 'Not in the brochure', 'Розділ поза брошурою')}</div>
    <h1 class="ptitle">${localTitle()}</h1>
    <div class="redbar"></div>
    <p>${L(
      'На экзамене могут спросить, кто сейчас возглавляет вашу провинцию, кто мэр вашего города и кто ваши депутаты. Этих данных нет в брошюре, и они меняются после выборов.',
      'The test may ask who currently leads your province, who your mayor is and who your representatives are. This is not in the brochure and changes after elections.',
      'На іспиті можуть запитати, хто зараз очолює вашу провінцію, хто мер вашого міста і хто ваші депутати. Цих даних немає в брошурі, і вони змінюються після виборів.',
    )}</p>
    <label class="field"><span>${L('Ваш город', 'Your city', 'Ваше місто')}</span><select data-city>
      ${byProv
        .map(
          (g) => `<optgroup label="${esc(tri(g.p.name, ui()))}">${g.cities
            .map((x) => `<option value="${x.id}" ${x.id === c.id ? 'selected' : ''}>${esc(tri(x.name, ui()))}</option>`)
            .join('')}</optgroup>`,
        )
        .join('')}
    </select></label>
    <p class="muted small">${L(
      'Вашего города нет в списке? Выберите ближайший город вашей провинции: премьер и вице-губернатор будут те же, а мэра и депутатов проверьте по ссылкам ниже.',
      'Your city is not on the list? Pick the nearest city in your province: the Premier and Lieutenant Governor are the same; check your mayor and representatives with the links below.',
      'Вашого міста немає у списку? Виберіть найближче місто вашої провінції: прем’єр і лейтенант-губернатор будуть ті самі, а мера й депутатів перевірте за посиланнями нижче.',
    )}</p>
    <p class="checked">${L('Проверено', 'Checked', 'Перевірено')}: <b>${fmtDay(local.checked)}</b> · ${esc(tri(local.recheckNote, ui()))}</p>
    <h2 class="sub">${esc(tri(c.name, ui()))}</h2>
    <dl class="facts-table">${factRows(c.facts, lang)}</dl>
    <h2 class="sub">${esc(tri(prov.name, ui()))}</h2>
    <dl class="facts-table">${factRows(prov.facts, lang)}</dl>
    <h2 class="sub">${L('Канада', 'Canada', 'Канада')}</h2>
    <dl class="facts-table">${factRows(local.national.facts, lang)}</dl>
    <a class="btn-main wide" href="#/local/quiz">${L('Пройти тест', 'Take the quiz', 'Пройти тест')} (${nQuestions(n)}) →</a>
    <p class="muted small">${L('Если что-то изменилось (выборы, отставка), сверьтесь с источником по ссылке — сайт обновляется вручную.', 'If something has changed (an election, a resignation), check the linked source — the site is updated by hand.', 'Якщо щось змінилося (вибори, відставка), звіртеся з джерелом за посиланням — сайт оновлюється вручну.')}</p>
  </div>`;
    host.querySelector<HTMLSelectElement>('select[data-city]')!.addEventListener('change', (e) => {
      settings.city = (e.target as HTMLSelectElement).value;
      trackEvent(`city/${settings.city}`);
      saveSettings();
      draw();
    });
  };
  draw();
  return () => {};
}

// ---------------------------------------------------------------- paywall

export function renderPaywall(host: HTMLElement, reason = ''): Cleanup {
  if (isUnlocked()) {
    host.innerHTML = `<div class="page"><h1 class="ptitle">${L('Полный доступ', 'Full access', 'Повний доступ')}</h1><div class="redbar"></div>
      <p class="access-ok">✓ ${L('Полный доступ к тестам уже активирован на этом устройстве.', 'Full access is already active on this device.', 'Повний доступ до тестів уже активовано на цьому пристрої.')}</p>
      <a class="btn-main wide" href="#/quiz">${L('К тестам →', 'To the tests →', 'До тестів →')}</a></div>`;
    return () => {};
  }
  const devices = `${PAYWALL.devices} ${plural(PAYWALL.devices, ['устройства', 'устройств', 'устройств'], ['device', 'devices'], ['пристроїв', 'пристроїв', 'пристроїв'])}`;
  host.innerHTML = `<div class="page paywall">
    <div class="kicker">${L('Тесты', 'Tests', 'Тести')}</div>
    <h1 class="ptitle">${L('Полный доступ к тестам', 'Full access to the tests', 'Повний доступ до тестів')}</h1>
    <div class="redbar"></div>
    ${reason ? `<p class="reason">${esc(reason)}</p>` : ''}
    <div class="price">${PAYWALL.price} <span>${L('разово, без подписки', 'one-time, no subscription', 'разово, без підписки')}</span></div>
    <ul class="incl">
      <li>${L('Тренировка по всем 12 главам — 263 вопроса с объяснениями и ссылками на брошюру', 'Practice on all 12 chapters — 263 questions with explanations and links to the brochure', 'Тренування з усіх 12 розділів — 263 питання з поясненнями та посиланнями на брошуру')}</li>
      <li>${L('Пробные экзамены без ограничений: 20 вопросов, таймер 30 минут, нужно 15 из 20', 'Unlimited practice exams: 20 questions, 30-minute timer, 15 of 20 to pass', 'Пробні іспити без обмежень: 20 питань, таймер 30 хвилин, потрібно 15 з 20')}</li>
      <li>${L('«Мои ошибки»: повторение вопросов, в которых вы ошиблись', '“My mistakes”: review the questions you got wrong', '«Мої помилки»: повторення питань, у яких ви помилилися')}</li>
      <li>${L('История экзаменов и тест «Мой город и провинция»', 'Exam history and the “My city and province” quiz', 'Історія іспитів і тест «Моє місто і провінція»')}</li>
      <li>${L(`Работает без интернета; ключ подходит для ${devices}`, `Works offline; the key works on ${devices}`, `Працює без інтернету; ключ підходить для ${devices}`)}</li>
    </ul>
    <p class="muted small">${L(
      'Бесплатно навсегда: вся брошюра с озвучкой и подсветкой, ключевые факты, «Только главное», избранное, тренировка по главе «Кто мы» и один пробный экзамен.',
      'Free forever: the whole brochure with audio and highlighting, key facts, “Key facts only”, favourites, practice on “Who We Are” and one practice exam.', 'Безкоштовно назавжди: уся брошура з озвученням і підсвічуванням, ключові факти, «Лише головне», обране, тренування з розділу «Хто ми» та один пробний іспит.',
    )}</p>
    <a class="btn-main wide" href="${esc(PAYWALL.checkoutUrl)}" target="_blank" rel="noopener">${L('Купить за', 'Buy for', 'Купити за')} ${PAYWALL.price} →</a>
    <p class="muted small">${L(
      'Оплата через Lemon Squeezy (карта, Apple Pay, Google Pay). После оплаты ключ придёт на почту и будет показан на странице заказа.',
      'Payment via Lemon Squeezy (card, Apple Pay, Google Pay). After payment the key is e-mailed to you and shown on the order page.', 'Оплата через Lemon Squeezy (картка, Apple Pay, Google Pay). Після оплати ключ надійде на пошту й буде показаний на сторінці замовлення.',
    )}</p>
    <h2 class="sub">${L('Уже купили?', 'Already bought?', 'Уже купили?')}</h2>
    <label class="field"><span>${L('Ключ из письма', 'Key from the e-mail', 'Ключ із листа')}</span>
      <input class="keyin" type="text" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX">
      <button class="btn-main btn-act" type="button">${L('Активировать', 'Activate', 'Активувати')}</button></label>
    <p class="act-msg" role="status"></p>
    <p class="muted small"><a href="#/about">${L('Условия, возврат и конфиденциальность', 'Terms, refunds and privacy', 'Умови, повернення та конфіденційність')}</a></p>
  </div>`;
  const btn = host.querySelector<HTMLButtonElement>('.btn-act')!;
  const input = host.querySelector<HTMLInputElement>('.keyin')!;
  const msg = host.querySelector<HTMLElement>('.act-msg')!;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    msg.className = 'act-msg';
    msg.textContent = L('Проверяю ключ…', 'Checking the key…', 'Перевіряю ключ…');
    const err = await activate(input.value);
    btn.disabled = false;
    if (err) {
      msg.classList.add('err');
      msg.textContent = err;
    } else {
      msg.classList.add('ok');
      msg.textContent = L('✓ Готово! Полный доступ активирован.', '✓ Done! Full access is active.', '✓ Готово! Повний доступ активовано.');
      window.setTimeout(() => (location.hash = '#/quiz'), 900);
    }
  });
  return () => {};
}
