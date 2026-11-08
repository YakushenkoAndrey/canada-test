// "Избранное": phrases saved from the brochure.
import { findBlock } from '../content';
import { ICON } from '../icons';
import { speaker } from '../speech';
import { favorites, removeFavorite, type Lang } from '../store';
import { esc, speechOf } from '../text';

export function renderFavorites(host: HTMLElement, lang: Lang): () => void {
  const draw = () => {
    host.innerHTML = `<div class="page favs">
      <div class="kicker">Мои заметки</div>
      <h1 class="ptitle">Избранное</h1>
      <div class="redbar"></div>
      ${favorites.length
        ? `<ul class="favlist">${favorites
            .map((f) => {
              const fb = findBlock(f.lang, f.blockId);
              const where = fb ? `${esc(fb.chapter.title)} · ${esc(fb.block.heading || 'стр. ' + fb.block.page)}` : '';
              return `<li data-id="${f.id}">
                <blockquote lang="${f.lang}">${esc(f.text)}</blockquote>
                <div class="favmeta"><span class="lang-badge">${f.lang.toUpperCase()}</span> ${where}</div>
                <div class="favbtns">
                  <button class="btn-small" type="button" data-play>${ICON.play}&nbsp;Слушать</button>
                  ${fb ? `<a class="btn-small" href="#/${f.lang}/${fb.chapter.id}/${fb.block.id}?hl=1">Открыть в брошюре →</a>` : ''}
                  <button class="btn-small btn-del" type="button" data-del aria-label="Удалить">✕</button>
                </div>
              </li>`;
            })
            .join('')}</ul>`
        : `<p class="muted">Пока пусто.</p>
           <p class="muted small">Как добавить: в тексте брошюры выделите фразу — внизу появится кнопка «★ В избранное». В режиме «Только главное» у каждого факта есть звёздочка ☆.</p>`}
      <p class="muted small">${lang === 'ru' ? 'Избранное хранится только на этом устройстве.' : 'Favourites are stored on this device only.'}</p>
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
  return () => speaker.stop();
}
