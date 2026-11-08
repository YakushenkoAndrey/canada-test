import '@fontsource/pt-sans/400.css';
import '@fontsource/pt-sans/400-italic.css';
import '@fontsource/pt-sans/700.css';
import '@fontsource/pt-serif/400.css';
import '@fontsource/pt-serif/700.css';
import './style.css';

import { initAnalytics, trackEvent, trackPage } from './analytics';
import { chapter, ensureLang } from './content';
import { ICON } from './icons';
import { isLang, L, LANGS, setUi, ui, uiFor, type Lang } from './langs';
import { recheck } from './paywall';
import { saveSettings, settings } from './store';
import { applyTheme, watchTheme } from './theme';
import { renderAbout } from './views/about';
import { renderFavorites } from './views/favorites';
import { renderHome, tocHtml } from './views/home';
import { renderExam, renderMistakes, renderLocal, renderLocalQuiz, renderPaywall, renderQuiz, renderQuizMenu } from './views/quiz';
import { Reader } from './views/reader';
import { renderSettings } from './views/settings';

// We scroll to the block from the URL ourselves; the browser's own restore would fight with it on reload.
try {
  history.scrollRestoration = 'manual';
} catch {
  /* ignore */
}

applyTheme();
watchTheme();
if (!isLang(settings.lang)) settings.lang = 'en';
setUi(uiFor(settings.lang));

const app = document.getElementById('app')!;
app.innerHTML = `
  <header class="top"></header>
  <div class="layout">
    <main id="view"></main>
    <div class="strip" aria-hidden="true"><span>Discover Canada</span></div>
  </div>
  <div id="mini" class="mini" hidden></div>
  <div id="drawer" class="drawer" hidden></div>`;

const top = app.querySelector<HTMLElement>('.top')!;
const view = document.getElementById('view')!;
const drawer = document.getElementById('drawer')!;
let reader: Reader | null = null;
let cleanup: (() => void) | null = null;
let readerKey = '';
let shellUi = '';

/** Header and side menu, re-rendered when the interface language changes. */
function renderShell() {
  if (shellUi === ui() + settings.lang) return;
  shellUi = ui() + settings.lang;
  top.innerHTML = `
    <button class="icon-btn" id="menuBtn" type="button" aria-label="${L('Оглавление', 'Contents', 'Зміст')}">${ICON.menu}</button>
    <a class="logo" href="#/">Discover Canada</a>
    <div class="top-right">
      <label class="langpick" title="${L('Язык брошюры', 'Brochure language', 'Мова брошури')}">
        <span class="sr">${L('Язык брошюры', 'Brochure language', 'Мова брошури')}</span>
        <select aria-label="${L('Язык брошюры', 'Brochure language', 'Мова брошури')}">
          ${LANGS.map((l) => `<option value="${l.code}" ${l.code === settings.lang ? 'selected' : ''}>${l.code.toUpperCase()} · ${l.native}</option>`).join('')}
        </select>
        <b aria-hidden="true">${settings.lang.toUpperCase()}</b>
      </label>
      <a class="testbtn" href="#/quiz">${L('Тест', 'Test', 'Тест')}</a>
    </div>`;
  drawer.innerHTML = `
    <nav class="drawer-panel" aria-label="${L('Оглавление', 'Contents', 'Зміст')}">
      <div class="drawer-head"><b>${L('Оглавление', 'Contents', 'Зміст')}</b><button type="button" class="icon-btn" data-close aria-label="${L('Закрыть', 'Close', 'Закрити')}">✕</button></div>
      <ul class="toc"></ul>
      <a class="dlink" href="#/">${L('Главная', 'Home', 'Головна')}</a>
      <a class="dlink" href="#/quiz">${L('Тест: экзамен, ошибки, главы', 'Tests: exam, mistakes, chapters', 'Тест: іспит, помилки, розділи')}</a>
      <a class="dlink" href="#/favorites">${L('★ Избранное', '★ Favourites', '★ Обране')}</a>
      <a class="dlink" href="#/local">${L('Мой город и провинция', 'My city and province', 'Моє місто і провінція')}</a>
      <a class="dlink" href="#/settings">${L('Настройки', 'Settings', 'Налаштування')}</a>
      <a class="dlink" href="#/about">${L('О сайте и условия', 'About and terms', 'Про сайт і умови')}</a>
    </nav>`;
  top.querySelector('#menuBtn')!.addEventListener('click', () => {
    drawer.querySelector('.toc')!.innerHTML = tocHtml(settings.lang);
    drawer.hidden = false;
  });
  top.querySelector<HTMLSelectElement>('.langpick select')!.addEventListener('change', (e) => {
    const lang = (e.target as HTMLSelectElement).value;
    if (lang === settings.lang) return;
    if (reader) {
      // Same place in the other language (block ids are identical in every language).
      const block = reader.currentBlockId();
      location.hash = `#/${lang}/${reader.chapter.id}${block ? '/' + block : ''}`;
    } else {
      setLang(lang);
      void route();
    }
  });
}

function setLang(lang: Lang) {
  if (settings.lang !== lang) trackEvent(`lang/${lang}`);
  settings.lang = lang;
  saveSettings();
  setUi(uiFor(lang));
  document.documentElement.lang = ui();
  document.title = `Discover Canada — ${L('подготовка к тесту', 'citizenship test prep', 'підготовка до тесту')}`;
  renderShell();
}

function leave() {
  reader?.destroy();
  reader = null;
  readerKey = '';
  cleanup?.();
  cleanup = null;
}

let routeSeq = 0;
async function route() {
  const seq = ++routeSeq;
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const parts = path.split('/').filter(Boolean);
  const params = new URLSearchParams(query);
  drawer.hidden = true;

  const brochure = isLang(parts[0]) ? parts[0] : null;
  const lang = brochure ?? settings.lang;
  try {
    await ensureLang(lang);
    if (lang !== 'en') await ensureLang('en');
  } catch {
    view.innerHTML = `<div class="page"><p class="muted">${L('Не удалось загрузить язык. Проверьте интернет.', 'Could not load the language. Check your internet connection.', 'Не вдалося завантажити мову. Перевірте інтернет.')}</p></div>`;
    return;
  }
  if (seq !== routeSeq) return; // a newer navigation started meanwhile
  setLang(lang);
  // Statistics: chapter level for the brochure (not every section), first two parts elsewhere.
  trackPage(brochure ? `/${lang}/${parts[1] ?? ''}` : `/${parts.slice(0, 2).join('/')}`);

  if (brochure) {
    const ch = chapter(lang, parts[1] ?? '');
    if (!ch) {
      leave();
      renderHome(view, lang);
      return;
    }
    const key = `${lang}/${ch.id}`;
    if (key !== readerKey) {
      leave();
      reader = new Reader(view, lang, ch);
      readerKey = key;
      if (!parts[2]) window.scrollTo(0, 0);
    }
    if (parts[2]) reader!.scrollTo(parts[2], params.has('hl'));
    return;
  }

  leave();
  window.scrollTo(0, 0);
  if (parts[0] === 'quiz') {
    cleanup = parts[1] ? renderQuiz(view, lang, parts[1]) : renderQuizMenu(view, lang);
  } else if (parts[0] === 'exam') {
    cleanup = renderExam(view, lang);
  } else if (parts[0] === 'mistakes') {
    cleanup = renderMistakes(view, lang);
  } else if (parts[0] === 'local' || parts[0] === 'ontario') {
    // #/ontario is the old address of this section (kept for saved links)
    cleanup = parts[1] === 'quiz' ? renderLocalQuiz(view, lang) : renderLocal(view, lang);
  } else if (parts[0] === 'unlock') {
    cleanup = renderPaywall(view);
  } else if (parts[0] === 'about') {
    cleanup = renderAbout(view);
  } else if (parts[0] === 'favorites') {
    cleanup = renderFavorites(view);
  } else if (parts[0] === 'settings') {
    cleanup = renderSettings(view, lang);
  } else {
    renderHome(view, lang);
  }
}

drawer.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  if (t === drawer || t.closest('[data-close]')) drawer.hidden = true;
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') drawer.hidden = true;
});

// Offline mode: the service worker caches the whole site (built only for production).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {
      /* offline mode unavailable: the site still works online */
    });
  });
}

initAnalytics();
window.addEventListener('hashchange', () => void route());
void recheck();
renderShell();
void route();
