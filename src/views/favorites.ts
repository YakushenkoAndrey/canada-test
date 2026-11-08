// "Избранное": phrases saved from the brochure.
import { ensureLang, findBlock } from '../content';
import { ICON } from '../icons';
import { L, langInfo } from '../langs';
import { speaker } from '../speech';
import { favorites, removeFavorite } from '../store';
import { esc, speechOf } from '../text';

export function renderFavorites(host: HTMLElement): () => void {
  let alive = true;
  const draw = () => {
    if (!alive) return;
    host.innerHTML = `<div class="page favs">
      <div class="kicker">${L('Мои заметки', 'My notes', 'Мої нотатки')}</div>
      <h1 class="ptitle">${L('Избранное', 'Favourites', 'Обране')}</h1>
      <div class="redbar"></div>
      ${favorites.length
        ? `<ul class="favlist">${favorites
            .map((f) => {
              const fb = findBlock(f.lang, f.blockId);
              const where = fb ? `${esc(fb.chapter.title)} · ${esc(fb.block.heading || L('стр. ', 'p. ', 'с. ') + fb.block.page)}` : '';
              return `<li data-id="${f.id}">
                <blockquote lang="${f.lang}" dir="${langInfo(f.lang).dir}">${esc(f.text)}</blockquote>
                <div class="favmeta"><span class="lang-badge">${f.lang.toUpperCase()}</span> ${where}</div>
                <div class="favbtns">
                  <button class="btn-small" type="button" data-play>${ICON.play}&nbsp;${L('Слушать', 'Listen', 'Слухати')}</button>
                  ${fb ? `<a class="btn-small" href="#/${f.lang}/${fb.chapter.id}/${fb.block.id}?hl=1">${L('Открыть в брошюре →', 'Open in the brochure →', 'Відкрити в брошурі →')}</a>` : ''}
                  <button class="btn-small btn-del" type="button" data-del aria-label="${L('Удалить', 'Delete', 'Видалити')}">✕</button>
                </div>
              </li>`;
            })
            .join('')}</ul>`
        : `<p class="muted">${L('Пока пусто.', 'Nothing here yet.', 'Поки порожньо.')}</p>
           <p class="muted small">${L(
             'Как добавить: в тексте брошюры выделите фразу — внизу появится кнопка «★ В избранное». В режиме «Только главное» у каждого факта есть звёздочка ☆.',
             'How to add: select a phrase in the brochure text — a “★ Add to favourites” button appears at the bottom. In “Key facts only” mode every fact has a ☆ star.', 'Як додати: у тексті брошури виділіть фразу — унизу з’явиться кнопка «★ До обраного». У режимі «Лише головне» біля кожного факту є зірочка ☆.',
           )}</p>`}
      <p class="muted small">${L('Избранное хранится только на этом устройстве.', 'Favourites are stored on this device only.', 'Обране зберігається лише на цьому пристрої.')}</p>
    </div>`;
    host.querySelectorAll<HTMLElement>('.favlist li').forEach((li) => {
      const f = favorites.find((x) => x.id === li.dataset.id)!;
      li.querySelector('[data-play]')!.addEventListener('click', () => {
        const noop = () => {};
        speaker.start('fav:' + f.id, f.lang, [speechOf(f.text, f.lang)], 0, { onIndex: noop, onWord: noop, onEnd: noop, onState: noop });
      });
      li.querySelector('[data-del]')!.addEventListener('click', () => {
        removeFavorite(f.id);
        draw();
      });
    });
  };
  draw();
  // Load every language that has saved phrases, then redraw with chapter names and links.
  Promise.all([...new Set(favorites.map((f) => f.lang))].map((l) => ensureLang(l).catch(() => undefined))).then(draw);
  return () => {
    alive = false;
    speaker.stop();
  };
}
