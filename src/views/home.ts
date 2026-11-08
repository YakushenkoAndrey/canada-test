import { chapter, chapterProgress, TOC } from '../content';
import { lastPlace, progress, type Lang } from '../store';
import { esc } from '../text';

/** Chapter list with progress; used on the home page and in the side menu. */
export function tocHtml(lang: Lang): string {
  return TOC.map((t) => {
    const c = chapter(lang, t.id);
    const title = lang === 'ru' ? t.ru : t.en;
    if (!c) return `<li class="off"><span class="tp">${t.page}</span><span class="tt">${esc(title)}</span><span class="tpct">скоро</span></li>`;
    const pct = chapterProgress(c, progress);
    return `<li><a href="#/${lang}/${t.id}"><span class="tp">${t.page}</span><span class="tt">${esc(title)}</span>
      <span class="tpct">${pct}%</span><i class="tbar"><i style="width:${pct}%"></i></i></a></li>`;
  }).join('');
}

export function renderHome(host: HTMLElement, lang: Lang) {
  const last = lastPlace();
  const lastCh = last ? chapter(last.lang, last.chapter) : undefined;
  host.innerHTML = `<div class="page home">
    <div class="kicker">${lang === 'ru' ? 'Учебное пособие для подготовки к экзамену на гражданство' : 'Your Canadian Citizenship Study Guide'}</div>
    <h1 class="cover">Discover Canada</h1>
    <p class="cover-sub">${lang === 'ru' ? 'Права и обязанности гражданина' : 'The Rights and Responsibilities of Citizenship'}</p>
    <div class="redbar"></div>
    ${last && lastCh ? `<a class="btn-main continue" href="#/${last.lang}/${last.chapter}/${last.block}">Продолжить: ${esc(lastCh.title)} →</a>` : ''}
    <h2 class="sub">Оглавление</h2>
    <ul class="toc">${tocHtml(lang)}</ul>
    <a class="btn-main wide" href="#/exam">Пробный экзамен →</a>
    <a class="btn-ghost wide" href="#/quiz">Все тесты и «Мои ошибки» →</a>
    <a class="btn-ghost wide" href="#/favorites">★ Избранное →</a>
    <p class="muted small">Вся брошюра: 12 глав, ключевые факты, тренировка по главам, пробный экзамен, «Мои ошибки» и раздел «Онтарио и Брантфорд».
    ${lang === 'ru' ? '<br>Неофициальный перевод; официальны только английская и французская версии.' : ''}</p>
  </div>`;
}
