import '@fontsource/pt-sans/400.css';
import '@fontsource/pt-sans/400-italic.css';
import '@fontsource/pt-sans/700.css';
import '@fontsource/pt-serif/400.css';
import '@fontsource/pt-serif/700.css';
import './style.css';

import { chapter } from './content';
import { ICON } from './icons';
import { saveSettings, settings, type Lang } from './store';
import { applyTheme, watchTheme } from './theme';
import { renderHome, tocHtml } from './views/home';
import { recheck } from './paywall';
import { renderAbout } from './views/about';
import { renderExam, renderMistakes, renderOntario, renderOntarioQuiz, renderPaywall, renderQuiz, renderQuizMenu } from './views/quiz';
import { Reader } from './views/reader';
import { renderFavorites } from './views/favorites';
import { renderSettings } from './views/settings';

// We scroll to the block from the URL ourselves; the browser's own restore would fight with it on reload.
try {
  history.scrollRestoration = 'manual';
} catch {
  /* ignore */
}

applyTheme();
watchTheme();

const app = document.getElementById('app')!;
app.innerHTML = `
  <header class="top">
    <button class="icon-btn" id="menuBtn" type="button" aria-label="Оглавление">${ICON.menu}</button>
    <a class="logo" href="#/">Discover Canada</a>
    <div class="top-right">
      <div class="langsw" role="group" aria-label="Язык брошюры">
        <button type="button" data-lang="en">EN</button><button type="button" data-lang="ru">RU</button>
      </div>
      <a class="testbtn" href="#/quiz">Тест</a>
    </div>
  </header>
  <div class="layout">
    <main id="view"></main>
    <div class="strip" aria-hidden="true"><span>Discover Canada</span></div>
  </div>
  <div id="mini" class="mini" hidden></div>
  <div id="drawer" class="drawer" hidden>
    <nav class="drawer-panel" aria-label="Оглавление">
      <div class="drawer-head"><b>Оглавление</b><button type="button" class="icon-btn" data-close aria-label="Закрыть">✕</button></div>
      <ul class="toc"></ul>
      <a class="dlink" href="#/">Главная</a>
      <a class="dlink" href="#/quiz">Тест: экзамен, ошибки, главы</a>
      <a class="dlink" href="#/favorites">★ Избранное</a>
      <a class="dlink" href="#/ontario">Онтарио и Брантфорд</a>
      <a class="dlink" href="#/settings">Настройки</a>
      <a class="dlink" href="#/about">О сайте и условия</a>
    </nav>
  </div>`;

const view = document.getElementById('view')!;
const drawer = document.getElementById('drawer')!;
let reader: Reader | null = null;
let cleanup: (() => void) | null = null;
let readerKey = '';

function setLang(lang: Lang) {
  settings.lang = lang;
  saveSettings();
  document.documentElement.lang = lang;
  document.querySelectorAll<HTMLElement>('.langsw [data-lang]').forEach((b) => {
    b.classList.toggle('on', b.dataset.lang === lang);
    b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
  });
}

function leave() {
  reader?.destroy();
  reader = null;
  readerKey = '';
  cleanup?.();
  cleanup = null;
}

function route() {
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const parts = path.split('/').filter(Boolean);
  const params = new URLSearchParams(query);
  drawer.hidden = true;

  if (parts[0] === 'en' || parts[0] === 'ru') {
    const lang = parts[0] as Lang;
    setLang(lang);
    const ch = chapter(lang, parts[1] ?? '') ?? undefined;
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
    cleanup = parts[1] ? renderQuiz(view, settings.lang, parts[1]) : renderQuizMenu(view, settings.lang);
  } else if (parts[0] === 'exam') {
    cleanup = renderExam(view, settings.lang);
  } else if (parts[0] === 'mistakes') {
    cleanup = renderMistakes(view, settings.lang);
  } else if (parts[0] === 'ontario') {
    cleanup = parts[1] === 'quiz' ? renderOntarioQuiz(view, settings.lang) : renderOntario(view, settings.lang);
  } else if (parts[0] === 'unlock') {
    cleanup = renderPaywall(view);
  } else if (parts[0] === 'about') {
    cleanup = renderAbout(view);
  } else if (parts[0] === 'favorites') {
    cleanup = renderFavorites(view, settings.lang);
  } else if (parts[0] === 'settings') {
    cleanup = renderSettings(view);
  } else {
    renderHome(view, settings.lang);
  }
}

document.querySelectorAll<HTMLElement>('.langsw [data-lang]').forEach((b) =>
  b.addEventListener('click', () => {
    const lang = b.dataset.lang as Lang;
    if (lang === settings.lang) return;
    if (reader) {
      // Same place in the other language (block ids are identical in EN and RU).
      const block = reader.currentBlockId();
      location.hash = `#/${lang}/${reader.chapter.id}${block ? '/' + block : ''}`;
    } else {
      setLang(lang);
      route();
    }
  }),
);

document.getElementById('menuBtn')!.addEventListener('click', () => {
  drawer.querySelector('.toc')!.innerHTML = tocHtml(settings.lang);
  drawer.hidden = false;
});
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

window.addEventListener('hashchange', route);
void recheck();
setLang(settings.lang);
route();
