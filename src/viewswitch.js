// Desktop / mobile view switch.
//   On a computer: "mobile" shows the whole mockup inside a phone frame, as an
//   iframe of this same page at real phone width (so every responsive rule
//   applies exactly as on a phone).
//   On a phone: "desktop" widens the layout viewport so the desktop layout shows.
// Progress carries across a switch through a one-shot sessionStorage handoff.
import { html, useState, useEffect, useRef, Icon, cx } from './lib.js';
import { Logo } from './components.js';

export const EMBED = new URLSearchParams(location.search).has('embed');

const VIEW_KEY = 'flowbiz-fin-view';
const HANDOFF_KEY = 'flowbiz-fin-handoff';
const PHONE = { w: 390, h: 844 };

// A phone is a small, touch-first screen, judged by the physical screen so it
// does not change when the viewport is widened for the desktop view.
export const IS_PHONE = !EMBED && Math.min(screen.width, screen.height) < 768 && matchMedia('(pointer: coarse)').matches;

export function readView() {
  if (EMBED) return 'mobile';
  try {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === 'mobile' || v === 'desktop') return v;
  } catch {}
  return IS_PHONE ? 'mobile' : 'desktop';
}

export function saveView(v) {
  try {
    localStorage.setItem(VIEW_KEY, v);
  } catch {}
}

export function writeHandoff(state) {
  try {
    sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(state));
  } catch {}
}

// Reads the handoff once and clears it, so a later reload starts fresh.
export function takeHandoff() {
  try {
    const raw = sessionStorage.getItem(HANDOFF_KEY);
    sessionStorage.removeItem(HANDOFF_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// On a real phone, the desktop view is a wider layout viewport.
export function applyPhoneViewport(view) {
  if (!IS_PHONE) return;
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  meta.setAttribute('content', view === 'desktop' ? 'width=1280' : 'width=device-width, initial-scale=1.0, viewport-fit=cover');
}

export function ViewToggle({ view, onChange, class: cls = '' }) {
  const opts = [
    ['desktop', 'מחשב', 'monitor'],
    ['mobile', 'מובייל', 'smartphone'],
  ];
  return html`<div role="radiogroup" aria-label="תצוגה" class=${cx('flex items-center rounded-xl border border-line bg-canvas p-0.5', cls)}>
    ${opts.map(
      ([id, label, icon]) => html`<button
        key=${id}
        type="button"
        role="radio"
        aria-checked=${view === id}
        title=${`תצוגת ${label}`}
        onClick=${() => view !== id && onChange(id)}
        class=${cx(
          'flex h-8 items-center gap-1.5 rounded-[10px] px-2.5 text-[12px] font-bold transition-colors cursor-pointer',
          view === id ? 'bg-brand-600 text-white shadow-sm' : 'text-muted hover:text-brand-600',
        )}
      >
        <${Icon} name=${icon} size=${15} />
        <span class="hidden 2xl:inline">${label}</span>
      </button>`,
    )}
  </div>`;
}

// Desktop-only: the app inside a phone frame, scaled down to fit short screens.
export function PhonePreview({ onSwitch }) {
  const frame = useRef();
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(1, (window.innerHeight - 110) / (PHONE.h + 28)));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const toDesktop = () => {
    try {
      const snap = frame.current?.contentWindow?.__flowbizSnapshot?.();
      if (snap) writeHandoff(snap);
    } catch {}
    onSwitch('desktop');
  };

  return html`<div dir="rtl" class="fb-notebook flex h-dvh flex-col text-ink">
    <header class="z-20 flex h-16 shrink-0 items-center gap-3 border-b border-line bg-surface px-3 md:px-5">
      <${Logo} />
      <span class="h-8 w-px bg-line"></span>
      <div class="min-w-0">
        <p class="truncate text-[16px] font-black leading-tight">המרכז הפיננסי</p>
        <p class="truncate text-[12px] font-semibold text-muted">תצוגת מובייל · ${PHONE.w}×${PHONE.h}</p>
      </div>
      <${ViewToggle} view="mobile" onChange=${toDesktop} class="ms-auto" />
    </header>
    <div class="flex min-h-0 flex-1 items-start justify-center overflow-hidden pt-5">
      <div style=${{ width: `${PHONE.w + 28}px`, height: `${PHONE.h + 28}px`, transform: `scale(${scale})`, transformOrigin: 'top center' }}>
        <div class="relative h-full w-full rounded-[54px] bg-ink p-[14px] shadow-[0_30px_60px_-20px_rgba(45,62,102,0.45)]">
          <div class="absolute left-1/2 top-[22px] z-10 h-[26px] w-[110px] -translate-x-1/2 rounded-full bg-black/85" aria-hidden="true"></div>
          <iframe
            ref=${frame}
            src=${`${location.pathname}?embed=1`}
            title="תצוגת מובייל"
            class="block h-full w-full rounded-[40px] border-0 bg-canvas"
          ></iframe>
        </div>
      </div>
    </div>
  </div>`;
}
