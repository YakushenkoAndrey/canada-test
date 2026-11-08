import { FACT_LABELS } from '../content';
import { onVoices, pickVoice, speaker, voiceScore, voicesFor } from '../speech';
import { resetAll, saveSettings, settings, type Lang } from '../store';
import { esc, speechOf } from '../text';

const SAMPLE: Record<Lang, string> = {
  en: 'Canada is known around the world as a strong and free country.',
  ru: 'Канада известна во всём мире как сильная и свободная страна.',
};

export function renderSettings(host: HTMLElement): () => void {
  const draw = () => {
    const voiceSel = (lang: Lang) => {
      const list = voicesFor(lang).sort((a, b) => voiceScore(b) - voiceScore(a) || a.name.localeCompare(b.name));
      const cur = pickVoice(lang)?.name ?? '';
      return `<label class="field"><span>Голос ${lang.toUpperCase()}</span>
        <select data-lang="${lang}">
          ${list.length ? '' : '<option value="">Голосов не найдено</option>'}
          ${list.map((v) => `<option value="${esc(v.name)}" ${v.name === cur ? 'selected' : ''}>${voiceScore(v) >= 20 ? '★ ' : ''}${esc(v.name)} (${esc(v.lang)})</option>`).join('')}
        </select>
        <button class="btn-small" type="button" data-test="${lang}">Проверить</button></label>`;
    };
    const tog = (key: 'autoNext' | 'readCaptions' | 'showLegend', label: string) =>
      `<label class="switch"><span>${label}</span><input type="checkbox" data-key="${key}" ${settings[key] ? 'checked' : ''}><i></i></label>`;
    host.innerHTML = `<div class="page settings">
      <div class="kicker">Настройки</div>
      <h1 class="ptitle">Настройки</h1>
      <div class="redbar"></div>
      <h2 class="sub">Озвучка</h2>
      ${voiceSel('en')}
      ${voiceSel('ru')}
      <label class="field"><span>Скорость</span><select data-rate>
        ${[0.8, 1, 1.2, 1.5].map((r) => `<option value="${r}" ${r === settings.rate ? 'selected' : ''}>${String(r).replace('.', ',')}×</option>`).join('')}
      </select></label>
      ${tog('autoNext', 'Читать дальше: после блока начинать следующий')}
      ${tog('readCaptions', 'Читать подписи к фото')}
      ${tog('showLegend', 'Показывать легенду подсветки под блоками')}
      <p class="muted small">★ — улучшенный голос, звучит естественнее; если он установлен, сайт выбирает его сам.
      Если голоса нет в списке, установите его в системе: Android — «Настройки → Синтез речи (Google)», iPhone — «Настройки → Универсальный доступ → Устный контент → Голоса», Windows — «Параметры → Время и язык → Речь».</p>
      <h2 class="sub">Цвета ключевых фактов</h2>
      <div class="facts-legend">${Object.entries(FACT_LABELS).map(([t, l]) => `<span class="chip chip-${t}">${l}</span>`).join('')}</div>
      <h2 class="sub">Данные</h2>
      <button class="btn-ghost" type="button" data-reset>Сбросить прогресс и ответы</button>
    </div>`;
    host.querySelectorAll<HTMLSelectElement>('select[data-lang]').forEach((s) =>
      s.addEventListener('change', () => {
        settings.voices[s.dataset.lang as Lang] = s.value;
        saveSettings();
      }),
    );
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
        const lang = b.dataset.test as Lang;
        const noop = () => {};
        speaker.start('test', lang, [speechOf(SAMPLE[lang], lang)], 0, { onIndex: noop, onWord: noop, onEnd: noop, onState: noop });
      }),
    );
    host.querySelector('[data-reset]')!.addEventListener('click', () => {
      if (confirm('Сбросить прогресс чтения, ответы и настройки?')) {
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
