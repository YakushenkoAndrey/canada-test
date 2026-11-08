// "О сайте": disclaimer, purchase terms, refunds and privacy.
import { L } from '../langs';
import { PAYWALL, paywallOn } from '../paywall';

const OFFICIAL = 'https://www.canada.ca/en/immigration-refugees-citizenship/corporate/publications-manuals/discover-canada.html';

export function renderAbout(host: HTMLElement): () => void {
  host.innerHTML = `<div class="page about">
    <div class="kicker">${L('О сайте', 'About')}</div>
    <h1 class="ptitle">${L('Условия и конфиденциальность', 'Terms and privacy')}</h1>
    <div class="redbar"></div>

    <h2 class="sub">${L('Неофициальный сайт', 'Unofficial site')}</h2>
    <p>${L(
      `Этот сайт — неофициальное учебное пособие. Он не связан с правительством Канады и с Immigration, Refugees and Citizenship Canada (IRCC) и не одобрен ими.
      Единственное официальное пособие для подготовки к экзамену — «Discover Canada: The Rights and Responsibilities of Citizenship»,
      его можно бесплатно скачать на сайте правительства Канады (<a href="${OFFICIAL}" target="_blank" rel="noopener">canada.ca</a>).
      Текст брошюры © His Majesty the King in Right of Canada. Русский перевод и машинные переводы на другие языки неофициальные; официальны только английская и французская версии.
      Вопросы, объяснения и устройство тестов — собственная работа автора сайта; они не являются официальными вопросами экзамена.`,
      `This site is an unofficial study aid. It is not affiliated with or endorsed by the Government of Canada or Immigration, Refugees and Citizenship Canada (IRCC).
      The only official study guide for the citizenship test is “Discover Canada: The Rights and Responsibilities of Citizenship”,
      available free from the Government of Canada (<a href="${OFFICIAL}" target="_blank" rel="noopener">canada.ca</a>).
      The brochure text is © His Majesty the King in Right of Canada. The Russian translation and the machine translations into other languages are unofficial; only the English and French versions are official.
      The questions, explanations and test design are the site author’s own work; they are not official test questions.`,
    )}</p>

    ${paywallOn() ? `<h2 class="sub">${L('Покупка полного доступа', 'Buying full access')}</h2>
    <p>${L(
      `Чтение брошюры, озвучка, ключевые факты, избранное, тренировка по главе «Кто мы» и один пробный экзамен — бесплатно.
      Полный доступ к тестам стоит ${PAYWALL.price}, оплачивается один раз и действует бессрочно для текущей версии сайта; ключ можно активировать на ${PAYWALL.devices} устройствах.
      Продавец и платёжный агент — Lemon Squeezy (Merchant of Record): он принимает оплату, начисляет налоги и выдаёт чек.`,
      `Reading the brochure, audio, key facts, favourites, practice on “Who We Are” and one practice exam are free.
      Full access to the tests costs ${PAYWALL.price}, is paid once and does not expire for the current version of the site; the key can be activated on ${PAYWALL.devices} devices.
      The seller of record is Lemon Squeezy (Merchant of Record): it takes the payment, charges taxes and issues the receipt.`,
    )}</p>
    <p><b>${L('Возврат.', 'Refunds.')}</b> ${L(
      'Если тесты вам не подошли, напишите в течение 14 дней после покупки через ссылку поддержки в письме о заказе — деньги вернутся, ключ будет отключён.',
      'If the tests are not right for you, write within 14 days of purchase using the support link in the order e-mail — you get your money back and the key is disabled.',
    )}</p>` : ''}

    <h2 class="sub">${L('Конфиденциальность', 'Privacy')}</h2>
    <p>${L(
      'Сайт не использует аккаунты, рекламу, счётчики и cookies. Прогресс чтения, ответы, избранное и настройки хранятся только в вашем браузере на этом устройстве.',
      'The site uses no accounts, ads, trackers or cookies. Reading progress, answers, favourites and settings are stored only in your browser on this device.',
    )}
    ${paywallOn() ? L('При активации и периодической проверке ключа сайт отправляет ключ и название устройства в Lemon Squeezy; данные оплаты (карта, e-mail) обрабатывает только Lemon Squeezy.', 'When activating and periodically re-checking a key, the site sends the key and a device label to Lemon Squeezy; payment data (card, e-mail) is handled only by Lemon Squeezy.') : ''}
    ${L('Озвучка работает средствами вашего телефона или компьютера.', 'Audio uses the voices of your own phone or computer.')}</p>

    <h2 class="sub">${L('Актуальность', 'Up to date')}</h2>
    <p>${L(
      'Раздел «Онтарио и Брантфорд» содержит данные, которые меняются после выборов; дата проверки указана на его странице. Перед экзаменом сверяйтесь с официальными источниками.',
      'The Ontario and Brantford section contains facts that change after elections; the check date is shown on its page. Before the test, check official sources.',
    )}</p>
  </div>`;
  return () => {};
}
