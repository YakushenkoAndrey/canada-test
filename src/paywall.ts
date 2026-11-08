// Paid tests: reading the brochure is free; tests need a Lemon Squeezy license key.
// While `checkoutUrl` is empty the paywall is off and everything is free.
import { L } from './langs';
import { load, save } from './store';

export const PAYWALL = {
  /** Lemon Squeezy checkout link of the product, e.g. https://<store>.lemonsqueezy.com/buy/<uuid> */
  checkoutUrl: '',
  /** Lemon Squeezy IDs: keys from other stores/products are rejected. 0 = do not check. */
  storeId: 0,
  productId: 0,
  price: '9,99 CAD',
  devices: 3,
  freeChapter: 'who-we-are',
  freeExams: 1,
};

const API = 'https://api.lemonsqueezy.com/v1/licenses';
const RECHECK_DAYS = 7;

interface Unlock { key: string; instanceId: string; checked: number; email?: string }
let unlock: Unlock | null = load('unlock', null);
let freeExamsUsed: number = load('freeExamsUsed', 0);

export const paywallOn = (): boolean => !!PAYWALL.checkoutUrl;
export const isUnlocked = (): boolean => !paywallOn() || !!unlock;
export const unlockInfo = (): Unlock | null => unlock;

export const canTrain = (chapterId: string): boolean => isUnlocked() || chapterId === PAYWALL.freeChapter;
export const canMistakes = (): boolean => isUnlocked();
export const canLocalQuiz = (): boolean => isUnlocked();
export const freeExamsLeft = (): number => Math.max(0, PAYWALL.freeExams - freeExamsUsed);
export const canStartExam = (): boolean => isUnlocked() || freeExamsLeft() > 0;

export function noteExamStarted(): void {
  if (isUnlocked()) return;
  freeExamsUsed++;
  save('freeExamsUsed', freeExamsUsed);
}

interface LsResponse {
  activated?: boolean;
  valid?: boolean;
  error?: string | null;
  license_key?: { status?: string; activation_limit?: number; activation_usage?: number };
  instance?: { id?: string } | null;
  meta?: { store_id?: number; product_id?: number; customer_email?: string };
}

async function call(action: 'activate' | 'validate', body: Record<string, string>): Promise<{ status: number; data: LsResponse }> {
  const res = await fetch(`${API}/${action}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  let data: LsResponse = {};
  try {
    data = (await res.json()) as LsResponse;
  } catch {
    /* empty */
  }
  return { status: res.status, data };
}

function wrongProduct(d: LsResponse): boolean {
  return (!!PAYWALL.storeId && d.meta?.store_id !== PAYWALL.storeId) || (!!PAYWALL.productId && d.meta?.product_id !== PAYWALL.productId);
}

function deviceName(): string {
  const ua = navigator.userAgent;
  const dev = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'device';
  return `Discover Canada web · ${dev} · ${new Date().toISOString().slice(0, 10)}`;
}

/** Activate a key on this device. Returns an error message in Russian, or null on success. */
export async function activate(rawKey: string): Promise<string | null> {
  const key = rawKey.trim();
  if (!/^[0-9A-Za-z-]{8,}$/.test(key)) return L('Проверьте ключ: его можно скопировать из письма о покупке.', 'Check the key: you can copy it from the purchase e-mail.', 'Перевірте ключ: його можна скопіювати з листа про покупку.');
  let r;
  try {
    r = await call('activate', { license_key: key, instance_name: deviceName() });
  } catch {
    return L('Нет связи с сервисом оплаты. Проверьте интернет и попробуйте ещё раз.', 'Cannot reach the payment service. Check your internet connection and try again.', 'Немає зв’язку з сервісом оплати. Перевірте інтернет і спробуйте ще раз.');
  }
  const d = r.data;
  if (!d.activated || !d.instance?.id) {
    const e = (d.error ?? '').toLowerCase();
    if (e.includes('activation limit')) return L(`Ключ уже активирован на ${PAYWALL.devices} устройствах — это максимум. Напишите в поддержку, если сменили телефон.`, `The key is already active on ${PAYWALL.devices} devices — the maximum. Contact support if you changed your phone.`, `Ключ уже активовано на ${PAYWALL.devices} пристроях — це максимум. Напишіть у підтримку, якщо змінили телефон.`);
    if (e.includes('not found')) return L('Такой ключ не найден. Скопируйте его из письма о покупке целиком.', 'Key not found. Copy the whole key from the purchase e-mail.', 'Такий ключ не знайдено. Скопіюйте його з листа про покупку повністю.');
    if (e.includes('disabled') || e.includes('expired')) return L('Этот ключ отключён (например, после возврата денег).', 'This key is disabled (for example, after a refund).', 'Цей ключ вимкнено (наприклад, після повернення коштів).');
    return L('Не удалось активировать ключ', 'Could not activate the key', 'Не вдалося активувати ключ') + (d.error ? `: ${d.error}` : '') + '.';
  }
  if (wrongProduct(d)) return L('Этот ключ от другого продукта.', 'This key belongs to another product.', 'Цей ключ від іншого продукту.');
  unlock = { key, instanceId: d.instance.id, checked: Date.now(), email: d.meta?.customer_email };
  save('unlock', unlock);
  return null;
}

/** Re-check the key now and then (refunds disable it). Network problems never lock the user out. */
export async function recheck(): Promise<void> {
  if (!paywallOn() || !unlock || !navigator.onLine) return;
  if (Date.now() - unlock.checked < RECHECK_DAYS * 86_400_000) return;
  try {
    const r = await call('validate', { license_key: unlock.key, instance_id: unlock.instanceId });
    const st = r.data.license_key?.status;
    if (r.data.valid && !wrongProduct(r.data)) {
      unlock.checked = Date.now();
      save('unlock', unlock);
    } else if (r.status === 404 || st === 'disabled' || st === 'expired') {
      unlock = null;
      save('unlock', null);
    }
  } catch {
    /* offline or service down: keep access */
  }
}
