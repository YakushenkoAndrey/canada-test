// Visitor statistics via GoatCounter (https://www.goatcounter.com): no cookies, no personal data,
// so no consent banner is needed. Off until GOATCOUNTER_CODE is set; only runs on the published site.
//
// To turn on: register at goatcounter.com, pick a site code (e.g. "discover-canada"),
// put it below, then build and push.
export const GOATCOUNTER_CODE = 'discover-canada';

interface GoatCounter {
  count: (o: { path: string; title?: string; event?: boolean }) => void;
}
declare global {
  interface Window {
    goatcounter?: Partial<GoatCounter> & { no_onload?: boolean; allow_local?: boolean };
  }
}

const enabled = (): boolean => !!GOATCOUNTER_CODE && import.meta.env.PROD && location.hostname !== 'localhost';

let queue: { path: string; title?: string; event?: boolean }[] = [];
let ready = false;
let lastPage = '';

export function initAnalytics(): void {
  if (!enabled()) return;
  // We count pages ourselves (the site uses #/ addresses), so turn off the automatic count on load.
  window.goatcounter = { no_onload: true };
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.dataset.goatcounter = `https://${GOATCOUNTER_CODE}.goatcounter.com/count`;
  s.onload = () => {
    ready = true;
    queue.forEach(send);
    queue = [];
  };
  document.head.appendChild(s);
}

function send(o: { path: string; title?: string; event?: boolean }): void {
  try {
    window.goatcounter?.count?.(o);
  } catch {
    /* statistics must never break the site */
  }
}

function push(o: { path: string; title?: string; event?: boolean }): void {
  if (!enabled()) return;
  if (ready) send(o);
  else if (queue.length < 50) queue.push(o);
}

/** A page view, e.g. "/ru/history" or "/quiz". Repeats of the same page (scrolling inside a chapter) are skipped. */
export function trackPage(path: string): void {
  if (path === lastPage) return;
  lastPage = path;
  push({ path, title: document.title });
}

/** An event, e.g. trackEvent('exam/passed'). Shown in GoatCounter as "event". */
export function trackEvent(name: string): void {
  push({ path: name, title: name, event: true });
}
