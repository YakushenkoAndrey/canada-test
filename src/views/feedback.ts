// "Отзыв": a short form (rating, kind, exam status, text) sent by e-mail through Web3Forms.
// Nothing personal is asked; the site owner's e-mail is never in the page (Web3Forms keeps it behind the key).
import { localCity } from '../content';
import { L, langInfo, ui } from '../langs';
import { settings } from '../store';
import { esc } from '../text';
import { trackEvent } from '../analytics';

/** Web3Forms access key (https://web3forms.com). Empty = the form is hidden. The key is safe to publish. */
export const WEB3FORMS_KEY = '';
export const feedbackOn = (): boolean => !!WEB3FORMS_KEY;

type Opt = { id: string; ru: string; en: string; uk: string };
const KINDS: Opt[] = [
  { id: 'review', ru: 'Отзыв', en: 'Review', uk: 'Відгук' },
  { id: 'idea', ru: 'Идея', en: 'Idea', uk: 'Ідея' },
  { id: 'bug', ru: 'Ошибка на сайте', en: 'Something is broken', uk: 'Помилка на сайті' },
  { id: 'translation', ru: 'Ошибка в переводе или вопросе', en: 'Mistake in a translation or question', uk: 'Помилка в перекладі або питанні' },
];
const EXAM: Opt[] = [
  { id: 'preparing', ru: 'Ещё готовлюсь', en: 'Still preparing', uk: 'Ще готуюся' },
  { id: 'passed', ru: 'Сдал(а)', en: 'Passed', uk: 'Склав(-ла)' },
  { id: 'failed', ru: 'Не сдал(а)', en: 'Did not pass', uk: 'Не склав(-ла)' },
];
const label = (o: Opt) => L(o.ru, o.en, o.uk);

function device(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'iPhone/iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Macintosh/.test(ua)) return 'Mac';
  return 'другое';
}

export function renderFeedback(host: HTMLElement, from: string): () => void {
  let rating = 0;
  let kind = 'review';
  let exam = '';
  let alive = true;

  host.innerHTML = `<div class="page feedback">
    <div class="kicker">${L('Обратная связь', 'Feedback', 'Зворотний зв’язок')}</div>
    <h1 class="ptitle">${L('Ваш отзыв', 'Your feedback', 'Ваш відгук')}</h1>
    <div class="redbar"></div>
    <p>${L(
      'Расскажите, что понравилось, что неудобно и где ошибка. Мы читаем каждый отзыв.',
      'Tell us what you like, what is inconvenient and where something is wrong. We read every message.',
      'Розкажіть, що сподобалося, що незручно і де помилка. Ми читаємо кожен відгук.',
    )}</p>
    <form class="fb" novalidate>
      <fieldset>
        <legend>${L('Оценка сайта', 'Rate the site', 'Оцінка сайту')}</legend>
        <div class="stars" role="radiogroup" aria-label="${L('Оценка', 'Rating', 'Оцінка')}">
          ${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="star" data-star="${n}" role="radio" aria-checked="false" aria-label="${n} / 5">☆</button>`).join('')}
        </div>
      </fieldset>
      <fieldset>
        <legend>${L('О чём отзыв', 'What is it about', 'Про що відгук')}</legend>
        <div class="pills" data-group="kind">${KINDS.map((k) => `<button type="button" class="pill ${k.id === kind ? 'on' : ''}" data-v="${k.id}">${esc(label(k))}</button>`).join('')}</div>
      </fieldset>
      <fieldset>
        <legend>${L('Экзамен на гражданство', 'Citizenship test', 'Іспит на громадянство')} <span class="muted small">(${L('необязательно', 'optional', 'необов’язково')})</span></legend>
        <div class="pills" data-group="exam">${EXAM.map((k) => `<button type="button" class="pill" data-v="${k.id}">${esc(label(k))}</button>`).join('')}</div>
      </fieldset>
      <label class="fb-text"><span>${L('Сообщение', 'Message', 'Повідомлення')}</span>
        <textarea rows="6" maxlength="4000" placeholder="${esc(L('Например: в главе «История» опечатка…', 'For example: there is a typo in the “History” chapter…', 'Наприклад: у розділі «Історія» помилка…'))}"></textarea>
      </label>
      <input type="checkbox" name="botcheck" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
      <p class="muted small">${L(
        'Не пишите личные данные (номер дела, адрес, телефон). Отзыв анонимный: вместе с ним отправляются только язык сайта, выбранный город и тип устройства.',
        'Please do not include personal data (file number, address, phone). Feedback is anonymous: only the site language, the chosen city and the device type are sent with it.',
        'Не пишіть особисті дані (номер справи, адресу, телефон). Відгук анонімний: разом із ним надсилаються лише мова сайту, вибране місто й тип пристрою.',
      )}</p>
      <p class="fb-msg" role="status"></p>
      <button class="btn-main wide" type="submit">${L('Отправить', 'Send', 'Надіслати')}</button>
    </form>
  </div>`;

  const form = host.querySelector<HTMLFormElement>('form.fb')!;
  const msg = form.querySelector<HTMLElement>('.fb-msg')!;
  const text = form.querySelector<HTMLTextAreaElement>('textarea')!;
  const stars = [...form.querySelectorAll<HTMLButtonElement>('.star')];
  const paintStars = () =>
    stars.forEach((b, i) => {
      b.textContent = i < rating ? '★' : '☆';
      b.classList.toggle('on', i < rating);
      b.setAttribute('aria-checked', String(i + 1 === rating));
    });
  stars.forEach((b) =>
    b.addEventListener('click', () => {
      rating = Number(b.dataset.star);
      paintStars();
    }),
  );
  form.querySelectorAll<HTMLElement>('.pills').forEach((g) =>
    g.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.pill');
      if (!b) return;
      const group = g.dataset.group;
      const v = b.dataset.v!;
      if (group === 'kind') kind = v;
      else exam = exam === v ? '' : v; // optional: tap again to clear
      g.querySelectorAll('.pill').forEach((x) => x.classList.toggle('on', (x as HTMLElement).dataset.v === (group === 'kind' ? kind : exam)));
    }),
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = text.value.trim();
    if (!rating && !body) {
      msg.textContent = L('Поставьте оценку или напишите сообщение.', 'Give a rating or write a message.', 'Поставте оцінку або напишіть повідомлення.');
      msg.className = 'fb-msg err';
      return;
    }
    if (!feedbackOn()) {
      msg.textContent = L('Отправка отзывов пока не настроена.', 'Sending feedback is not set up yet.', 'Надсилання відгуків поки не налаштовано.');
      msg.className = 'fb-msg err';
      return;
    }
    if (!navigator.onLine) {
      msg.textContent = L('Нет интернета. Отзыв не потеряется: отправьте его, когда связь появится.', 'No internet. Your text stays here: send it when you are back online.', 'Немає інтернету. Текст залишиться тут: надішліть його, коли з’явиться зв’язок.');
      msg.className = 'fb-msg err';
      return;
    }
    const btn = form.querySelector<HTMLButtonElement>('button[type=submit]')!;
    btn.disabled = true;
    msg.textContent = L('Отправляю…', 'Sending…', 'Надсилаю…');
    msg.className = 'fb-msg';
    const k = KINDS.find((x) => x.id === kind)!;
    const ex = EXAM.find((x) => x.id === exam);
    const c = localCity(settings.city);
    // Field names and values are in Russian: the e-mail is read by the site owner.
    const payload = {
      access_key: WEB3FORMS_KEY,
      subject: `Discover Canada — отзыв: ${rating ? '★'.repeat(rating) + ' ' : ''}${k.ru}`,
      from_name: 'Discover Canada (сайт)',
      botcheck: form.querySelector<HTMLInputElement>('.hp')!.checked,
      'Оценка': rating ? `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)} (${rating}/5)` : '—',
      'Тип': k.ru,
      'Экзамен': ex ? ex.ru : '—',
      'Сообщение': body || '—',
      'Язык брошюры': langInfo(settings.lang).native,
      'Язык интерфейса': ui(),
      'Город': c.name.ru,
      'Откуда открыта форма': from || '—',
      'Устройство': device(),
    };
    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean };
      if (!alive) return;
      if (!res.ok || !data.success) throw new Error('send failed');
      trackEvent(`feedback/${kind}`);
      host.querySelector('.page')!.innerHTML = `
        <div class="kicker">${L('Обратная связь', 'Feedback', 'Зворотний зв’язок')}</div>
        <h1 class="ptitle">${L('Спасибо!', 'Thank you!', 'Дякуємо!')}</h1>
        <div class="redbar"></div>
        <p>${L('Отзыв отправлен. Он поможет сделать сайт лучше.', 'Your feedback has been sent. It helps make the site better.', 'Відгук надіслано. Він допоможе зробити сайт кращим.')}</p>
        <a class="btn-main wide" href="#/">${L('На главную', 'Home', 'На головну')}</a>`;
    } catch {
      if (!alive) return;
      btn.disabled = false;
      msg.textContent = L('Не удалось отправить. Проверьте интернет и попробуйте ещё раз.', 'Could not send. Check your internet connection and try again.', 'Не вдалося надіслати. Перевірте інтернет і спробуйте ще раз.');
      msg.className = 'fb-msg err';
    }
  });
  return () => {
    alive = false;
  };
}
