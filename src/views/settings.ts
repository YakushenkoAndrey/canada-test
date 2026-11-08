import { chapter, factLabel, FACT_TYPES } from '../content';
import { L, LANGS, langInfo, ui, UIS, type Lang, type Ui } from '../langs';
import { onVoices, pickVoice, speaker, voiceScore, voicesFor } from '../speech';
import { resetAll, saveSettings, settings } from '../store';
import { esc, speechOf } from '../text';
import { applyTheme } from '../theme';
import { trackEvent } from '../analytics';

/** A sample sentence in the language: the first sentence of "Who We Are". */
function sample(lang: Lang): string {
  const p = chapter(lang, 'who-we-are')?.blocks[0]?.paragraphs[0] ?? 'Canada is known around the world as a strong and free country.';
  const m = /^.+?[.!?。।؟](\s|$)/u.exec(p);
  return (m ? m[0] : p).trim();
}

function offlineStatus(): string {
  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller)
      return L('✓ Сайт сохранён на этом устройстве и открывается без интернета.', '✓ The site is saved on this device and opens without internet.', '✓ Сайт збережено на цьому пристрої, він відкривається без інтернету.');
  } catch {
    /* ignore */
  }
  return L(
    'Офлайн-режим включится после первой загрузки опубликованного сайта с интернетом (откройте его ещё раз — и всё сохранится).',
    'Offline mode turns on after the published site has loaded once with internet (open it again and everything is saved).', 'Офлайн-режим увімкнеться після першого завантаження опублікованого сайту з інтернетом (відкрийте його ще раз — і все збережеться).',
  );
}

export function renderSettings(host: HTMLElement, current: Lang): () => void {
  const draw = () => {
    const voiceSel = (lang: Lang) => {
      const list = voicesFor(lang).sort((a, b) => voiceScore(b) - voiceScore(a) || a.name.localeCompare(b.name));
      const cur = pickVoice(lang)?.name ?? '';
      return `<label class="field"><span>${L('Голос', 'Voice', 'Голос')}: ${esc(langInfo(lang).native)}</span>
        <select data-lang="${lang}">
          ${list.length ? '' : `<option value="">${L('Голосов не найдено', 'No voices found', 'Голосів не знайдено')}</option>`}
          ${list.map((v) => `<option value="${esc(v.name)}" ${v.name === cur ? 'selected' : ''}>${voiceScore(v) >= 20 ? '★ ' : ''}${esc(v.name)} (${esc(v.lang)})</option>`).join('')}
        </select>
        <button class="btn-small" type="button" data-test="${lang}">${L('Проверить', 'Test', 'Перевірити')}</button></label>`;
    };
    const tog = (key: 'autoNext' | 'readCaptions' | 'showLegend', label: string) =>
      `<label class="switch"><span>${label}</span><input type="checkbox" data-key="${key}" ${settings[key] ? 'checked' : ''}><i></i></label>`;
    const voiceLangs = [...new Set([current, 'en'])].filter((l) => LANGS.some((x) => x.code === l));
    host.innerHTML = `<div class="page settings">
      <div class="kicker">${L('Настройки', 'Settings', 'Налаштування')}</div>
      <h1 class="ptitle">${L('Настройки', 'Settings', 'Налаштування')}</h1>
      <div class="redbar"></div>
      ${current === 'en' ? `<label class="field"><span>${L('Язык интерфейса', 'Interface language', 'Мова інтерфейсу')}</span><select data-ui>
        ${UIS.map((u) => `<option value="${u.code}" ${settings.uiLang === u.code ? 'selected' : ''}>${u.native}</option>`).join('')}
      </select></label>` : ''}
      <h2 class="sub">${L('Озвучка', 'Audio', 'Озвучення')}</h2>
      ${voiceLangs.map(voiceSel).join('')}
      <label class="field"><span>${L('Скорость', 'Speed', 'Швидкість')}</span><select data-rate>
        ${[0.8, 1, 1.2, 1.5].map((r) => `<option value="${r}" ${r === settings.rate ? 'selected' : ''}>${ui() === 'en' ? r : String(r).replace('.', ',')}×</option>`).join('')}
      </select></label>
      ${tog('autoNext', L('Читать дальше: после блока начинать следующий', 'Keep reading: start the next section automatically', 'Читати далі: після блоку починати наступний'))}
      ${tog('readCaptions', L('Читать подписи к фото', 'Read photo captions', 'Читати підписи до фото'))}
      ${tog('showLegend', L('Показывать легенду подсветки под блоками', 'Show the highlight legend under sections', 'Показувати легенду підсвічування під блоками'))}
      <p class="muted small">${L(
        '★ — улучшенный голос, звучит естественнее; если он установлен, сайт выбирает его сам. Если голоса нет в списке, установите его в системе: iPhone — «Настройки → Универсальный доступ → Устный контент → Голоса», Android — «Настройки → Синтез речи (Google)», Windows — «Параметры → Время и язык → Речь».',
        '★ — enhanced voice, sounds more natural; the site picks it automatically when installed. If a voice is missing, install it in your system: iPhone — Settings → Accessibility → Spoken Content → Voices, Android — Settings → Text-to-speech (Google), Windows — Settings → Time & language → Speech.', '★ — покращений голос, звучить природніше; якщо його встановлено, сайт вибирає його сам. Якщо голосу немає в списку, установіть його в системі: iPhone — «Параметри → Доступність → Озвучений вміст → Голоси», Android — «Налаштування → Синтез мовлення (Google)», Windows — «Параметри → Час і мова → Мовлення».',
      )}</p>
      <h2 class="sub">${L('Оформление', 'Appearance', 'Оформлення')}</h2>
      <label class="field"><span>${L('Тема', 'Theme', 'Тема')}</span><select data-theme>
        ${[['light', L('Светлая (как брошюра)', 'Light (like the brochure)', 'Світла (як брошура)')], ['dark', L('Тёмная', 'Dark', 'Темна')], ['auto', L('Как в телефоне', 'Same as the phone', 'Як у телефоні')]]
          .map(([v, l]) => `<option value="${v}" ${settings.theme === v ? 'selected' : ''}>${l}</option>`)
          .join('')}
      </select></label>
      <h2 class="sub">${L('Без интернета и на экране «Домой»', 'Offline and on the home screen', 'Без інтернету та на екрані «Додому»')}</h2>
      <p class="offline-status">${offlineStatus()}</p>
      <p class="muted small">${L(
        'Чтобы открыть сайт как приложение на iPhone: в Safari нажмите «Поделиться» → «На экран „Домой“». На Android в Chrome: меню ⋮ → «Добавить на главный экран». Озвучка без интернета работает, если голоса установлены на телефоне.',
        'To use the site like an app on iPhone: in Safari tap Share → Add to Home Screen. On Android in Chrome: menu ⋮ → Add to Home screen. Audio works offline when the voices are installed on the phone.', 'Щоб відкривати сайт як застосунок на iPhone: у Safari натисніть «Поділитися» → «На екран „Початок“». На Android у Chrome: меню ⋮ → «Додати на головний екран». Озвучення без інтернету працює, якщо голоси встановлено на телефоні.',
      )}</p>
      <h2 class="sub">${L('Цвета ключевых фактов', 'Key fact colours', 'Кольори ключових фактів')}</h2>
      <div class="facts-legend">${FACT_TYPES.map((t) => `<span class="chip chip-${t}">${factLabel(t)}</span>`).join('')}</div>
      <h2 class="sub">${L('Данные', 'Data', 'Дані')}</h2>
      <button class="btn-ghost" type="button" data-reset>${L('Сбросить прогресс и ответы', 'Reset progress and answers', 'Скинути прогрес і відповіді')}</button>
    </div>`;
    host.querySelector<HTMLSelectElement>('select[data-ui]')?.addEventListener('change', (e) => {
      settings.uiLang = (e.target as HTMLSelectElement).value as Ui;
      trackEvent(`ui/${settings.uiLang}`);
      saveSettings();
      location.reload();
    });
    host.querySelectorAll<HTMLSelectElement>('select[data-lang]').forEach((s) =>
      s.addEventListener('change', () => {
        settings.voices[s.dataset.lang!] = s.value;
        saveSettings();
      }),
    );
    host.querySelector<HTMLSelectElement>('select[data-theme]')!.addEventListener('change', (e) => {
      settings.theme = (e.target as HTMLSelectElement).value as 'light' | 'dark' | 'auto';
      saveSettings();
      applyTheme();
    });
    host.querySelector<HTMLSelectElement>('select[data-rate]')!.addEventListener('change', (e) => {
      settings.rate = Number((e.target as HTMLSelectElement).value);
      saveSettings();
    });
    host.querySelectorAll<HTMLInputElement>('input[data-key]').forEach((c) =>
      c.addEventListener('change', () => {
        settings[c.dataset.key as 'autoNext' | 'readCaptions' | 'showLegend'] = c.checked;
        saveSettings();
      }),
    );
    host.querySelectorAll<HTMLButtonElement>('[data-test]').forEach((b) =>
      b.addEventListener('click', () => {
        const lang = b.dataset.test!;
        const noop = () => {};
        speaker.start('test', lang, [speechOf(sample(lang), lang)], 0, { onIndex: noop, onWord: noop, onEnd: noop, onState: noop });
      }),
    );
    host.querySelector('[data-reset]')!.addEventListener('click', () => {
      if (confirm(L('Сбросить прогресс чтения, ответы и настройки?', 'Reset reading progress, answers and settings?', 'Скинути прогрес читання, відповіді та налаштування?'))) {
        resetAll();
        location.reload();
      }
    });
  };
  draw();
  const off = onVoices(draw);
  return () => {
    off();
    speaker.stop();
  };
}
