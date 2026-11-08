import { brochureFooter, chapter, chapterProgress, chapterTitle, translationNotice, TOC } from '../content';
import { L, langInfo, type Lang } from '../langs';
import { lastPlace, progress } from '../store';
import { esc } from '../text';

/** Chapter list with progress; used on the home page and in the side menu. */
export function tocHtml(lang: Lang): string {
  return TOC.map((t) => {
    const c = chapter(lang, t.id);
    const title = chapterTitle(lang, t.id);
    if (!c) return `<li class="off"><span class="tp">${t.page}</span><span class="tt">${esc(title)}</span><span class="tpct">${L('скоро', 'soon', 'незабаром')}</span></li>`;
    const pct = chapterProgress(c, progress);
    return `<li><a href="#/${lang}/${t.id}"><span class="tp">${t.page}</span><span class="tt" lang="${lang}" dir="${langInfo(lang).dir}">${esc(title)}</span>
      <span class="tpct">${pct}%</span><i class="tbar"><i style="width:${pct}%"></i></i></a></li>`;
  }).join('');
}

export function renderHome(host: HTMLElement, lang: Lang) {
  const last = lastPlace();
  const lastCh = last && last.lang === lang ? chapter(last.lang, last.chapter) : undefined;
  const notice = translationNotice(lang);
  host.innerHTML = `<div class="page home">
    <div class="kicker">${esc(brochureFooter(lang))}</div>
    <h1 class="cover">Discover Canada</h1>
    <p class="cover-sub">${lang === 'ru' ? 'Права и обязанности гражданина' : lang === 'uk' ? 'Права та обов’язки громадянина' : 'The Rights and Responsibilities of Citizenship'}</p>
    <div class="redbar"></div>
    <p class="langline">${L('Язык брошюры', 'Brochure language', 'Мова брошури')}: <b>${esc(langInfo(lang).native)}</b> · ${L('сменить — кнопка языка вверху', 'change it with the language button at the top', 'змінити — кнопка мови вгорі')}</p>
    ${last && lastCh ? `<a class="btn-main continue" href="#/${last.lang}/${last.chapter}/${last.block}">${L('Продолжить', 'Continue', 'Продовжити')}: ${esc(lastCh.title)} →</a>` : ''}
    <h2 class="sub">${L('Оглавление', 'Contents', 'Зміст')}</h2>
    <ul class="toc">${tocHtml(lang)}</ul>
    <a class="btn-main wide" href="#/exam">${L('Пробный экзамен →', 'Practice exam →', 'Пробний іспит →')}</a>
    <a class="btn-ghost wide" href="#/quiz">${L('Все тесты и «Мои ошибки» →', 'All tests and “My mistakes” →', 'Усі тести та «Мої помилки» →')}</a>
    <a class="btn-ghost wide" href="#/favorites">${L('★ Избранное →', '★ Favourites →', '★ Обране →')}</a>
    <p class="muted small">${L(
      'Вся брошюра: 12 глав, ключевые факты, тренировка по главам, пробный экзамен, «Мои ошибки» и раздел «Мой город и провинция» (21 город по всей Канаде).',
      'The whole brochure: 12 chapters, key facts, chapter practice, a practice exam, “My mistakes” and a “My city and province” section (21 cities across Canada).', 'Уся брошура: 12 розділів, ключові факти, тренування за розділами, пробний іспит, «Мої помилки» та розділ «Моє місто і провінція» (21 місто по всій Канаді).',
    )}
    ${notice ? `<br>${esc(notice)}` : ''}</p>
  </div>`;
}
