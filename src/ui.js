// Shared pieces of the finance center: windows, fields, tags, amounts, the stage track
// and the "next step" note. Every board (setup, first clients, active) is built from these.
import { html, useState, useEffect, useRef, Icon, PencilCheck, cx } from './lib.js';
import { Button, Mark, Note, SharkAvatar } from './components.js';
import { PARTNER, STAGES } from './data.js';
import { fmt, signed } from './finance.js';

export function Sheet({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  return html`<div class="fixed inset-0 z-50">
    <div class="absolute inset-0 bg-ink/30" onClick=${onClose}></div>
    <div
      class=${cx('rise pb-safe absolute inset-x-0 bottom-0 flex max-h-[90dvh] flex-col rounded-t-[22px] bg-canvas md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[18px] md:shadow-2xl', wide ? 'md:w-[620px]' : 'md:w-[480px]')}
      role="dialog"
      aria-modal="true"
      aria-label=${title}
    >
      <span class="mx-auto mt-2 h-1.5 w-10 rounded-full bg-line md:hidden" aria-hidden="true"></span>
      <div class="flex items-center justify-between px-5 pb-2 pt-3 md:pt-4">
        <h2 class="fb-h2 !text-[22px]">${title}</h2>
        <button type="button" aria-label="סגירה" class="rounded-lg p-2 text-muted hover:bg-white cursor-pointer" onClick=${onClose}><${Icon} name="x" size=${18} /></button>
      </div>
      <div class="thin-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-4">${children}</div>
      ${footer && html`<div class="flex items-center justify-between gap-3 border-t border-line px-5 py-3 max-sm:[&>.fb-btn-primary]:flex-1">${footer}</div>`}
    </div>
  </div>`;
}

export function Field({ label, hint, children }) {
  return html`<label class="mb-3.5 block">
    <span class="mb-1 block text-[14px] font-bold text-ink">${label}</span>
    ${children}
    ${hint && html`<span class="mt-1 block text-[12px] text-muted">${hint}</span>`}
  </label>`;
}

export const inputCls = 'h-12 w-full rounded-xl border-[1.5px] border-line bg-white px-3 text-[16px] text-ink outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-100';

export function MoneyInput({ value, onInput, big, autofocus }) {
  const ref = useRef();
  useEffect(() => autofocus && ref.current?.focus(), []);
  return html`<div class="relative" dir="ltr">
    <span class=${cx('absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted', big ? 'text-[20px]' : 'text-[16px]')}>₪</span>
    <input
      ref=${ref}
      type="number"
      inputmode="numeric"
      value=${value ?? ''}
      onInput=${(e) => onInput(e.target.value === '' ? null : Number(e.target.value))}
      class=${cx(inputCls, 'pl-8 text-left font-display font-extrabold tabular-nums', big && '!h-16 !text-[30px]')}
    />
  </div>`;
}

export function Chips({ options, value, onChange, small }) {
  return html`<div class="flex flex-wrap gap-2" role="radiogroup">
    ${options.map(
      (o) => html`<button
        key=${o.id}
        type="button"
        role="radio"
        aria-checked=${value === o.id}
        onClick=${() => onChange(o.id)}
        class=${cx(
          'rounded-xl border-[1.5px] px-3 font-bold transition-colors cursor-pointer',
          small ? 'h-10 text-[14px]' : 'h-11 text-[14px]',
          value === o.id ? 'border-brand-600 bg-brand-100 text-brand-600' : 'border-line bg-white text-ink hover:border-brand-300',
        )}
      >${o.label}${o.tag && html`<span class="ms-1.5 text-[12px] font-semibold text-muted">${o.tag}</span>`}</button>`,
    )}
  </div>`;
}

export function Tag({ tone = 'muted', children }) {
  const cls = {
    late: 'bg-error-50 text-error',
    paid: 'bg-money-50 text-money',
    due: 'bg-brand-100 text-brand-600',
    warn: 'bg-warn-50 text-warn',
    muted: 'bg-canvas text-muted ring-1 ring-line',
  }[tone];
  return html`<span class=${cx('inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full px-2 text-[12px] font-bold', cls)}>${children}</span>`;
}

export const Amount = ({ n, class: cls = '' }) =>
  html`<span class=${cx('font-display font-extrabold tabular-nums', n > 0 ? 'text-money' : 'text-ink', cls)}>${signed(n)}</span>`;

// A panel with a title line; the action (one mini button or a link) sits on the left.
// `n` numbers the panel in reading order (1 = look here first) instead of an icon.
export function Panel({ title, icon, n, action, sub, class: cls = '', children }) {
  return html`<section class=${cx('fb-panel flex min-w-0 flex-col !p-4 md:!p-6', cls)}>
    <div class="mb-4 flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 class="fb-h3 flex items-center gap-2.5">
          ${n != null
            ? html`<span class="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-600 font-display text-[16px] font-extrabold text-white" aria-hidden="true">${n}</span>`
            : icon && html`<span class="fb-chip-ic sketch-chip h-9 w-9 shrink-0"><${Icon} name=${icon} size=${18} /></span>`}${title}
        </h2>
        ${sub && html`<p class="mt-1 text-[14px] text-muted">${sub}</p>`}
      </div>
      ${action}
    </div>
    ${children}
  </section>`;
}

// A number that changes in place: click (or Enter on it), type, Enter to save, Esc to
// leave it as it was. The dashed underline and the pencil say "you can change this".
// `quiet` (for table cells) shows the pencil only on hover or focus.
export function NumEdit({ value, onSave, label, unit = '₪', quiet, class: cls = '' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef();
  useEffect(() => {
    if (editing) {
      ref.current?.focus();
      ref.current?.select();
    }
  }, [editing]);
  const shown = unit === '%' ? `${value}%` : fmt(value);
  const commit = () => {
    setEditing(false);
    const v = Math.max(0, Math.round(Number(draft)));
    if (draft !== '' && draft != null && !Number.isNaN(v) && v !== value) onSave(v);
  };
  if (editing)
    return html`<span class="relative inline-flex" dir="ltr">
      <span class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[0.6em] font-bold text-muted">${unit}</span>
      <input
        ref=${ref}
        type="number"
        inputmode="numeric"
        aria-label=${label}
        value=${draft ?? ''}
        onInput=${(e) => setDraft(e.target.value)}
        onBlur=${commit}
        onKeyDown=${(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            commit();
          }
          if (e.key === 'Escape') {
            e.stopPropagation();
            setEditing(false);
          }
        }}
        class=${cx('w-[6.5em] rounded-lg border-[1.5px] border-brand-600 bg-white py-0.5 pe-2 ps-7 text-left font-display font-extrabold tabular-nums text-ink outline-none ring-4 ring-brand-100', cls)}
      />
    </span>`;
  return html`<button
    type="button"
    title="לשינוי"
    aria-label=${`${label}: ${shown}. לשינוי`}
    onClick=${() => {
      setDraft(value);
      setEditing(true);
    }}
    class=${cx('group -mx-1 inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-1 font-display font-extrabold text-ink underline decoration-brand-300 decoration-dashed decoration-[1.5px] underline-offset-[6px] hover:bg-brand-50 hover:decoration-brand-600 cursor-pointer', cls)}
  >${shown}<${Icon} name="pencil" size=${14} class=${cx('shrink-0 text-brand-600 group-hover:opacity-100 group-focus-visible:opacity-100', quiet ? 'opacity-0' : 'opacity-50')} /></button>`;
}

// How a number is built, written out: "נכנס − יצא = נשאר". On a phone it reads as a
// short receipt (one line per part); from md up the parts sit side by side.
// parts: [{ op, label, value, sub, main, tone }]; the `main` part is the answer.
export function Equation({ parts }) {
  return html`<ol class="flex flex-col gap-2 md:flex-row md:items-stretch md:gap-0">
    ${parts.flatMap((p, i) => [
      i > 0 && html`<li key=${`op${i}`} aria-hidden="true" class="hidden w-9 shrink-0 items-center justify-center font-display text-[28px] font-extrabold text-faint md:flex">${p.op}</li>`,
      html`<li key=${`p${i}`} class=${cx('flex min-w-0 items-center justify-between gap-3 rounded-[14px] px-4 py-3 md:flex-1 md:flex-col md:items-start md:justify-start md:gap-1.5', p.main ? 'bg-brand-100/70 ring-2 ring-brand-600/25' : 'bg-canvas')}>
        <span class=${cx('text-[13px] font-bold', p.main ? 'text-brand-600' : 'text-muted')}>${i > 0 && html`<span class="me-1 font-extrabold md:hidden">${p.op}</span>`}${p.label}</span>
        <span class="min-w-0 text-end md:text-start">
          <span class=${cx('block font-display font-extrabold leading-none', p.main ? 'text-[28px] md:text-[36px]' : 'text-[20px] md:text-[26px]', p.tone || 'text-ink')}>${p.value}</span>
          ${p.sub && html`<span class="mt-1 block text-[12px] font-semibold leading-snug text-muted">${p.sub}</span>`}
        </span>
      </li>`,
    ])}
  </ol>`;
}

// ---------- the page heading: stage number as the watermark, one marked phrase ----------

export function BoardHeading({ stage, title, sub }) {
  const s = STAGES.find((x) => x.id === stage);
  return html`<div class="fb-heading min-w-0">
    <span class="fb-wm" aria-hidden="true">${s.n}</span>
    <span class="fb-eyebrow">המרכז הפיננסי · שלב ${s.n}: ${s.label}</span>
    <h1 class="fb-h1 text-[28px] leading-tight md:text-[38px]">${title[0]}<${Mark}>${title[1]}<//></h1>
    ${sub && html`<p class="!mt-1 max-md:!text-[15px]">${sub}</p>`}
  </div>`;
}

// ---------- the three stages, with "you are here" ----------

export function StageTrack({ stage, onOpen }) {
  const i = STAGES.findIndex((s) => s.id === stage);
  return html`<button
    type="button"
    onClick=${onOpen}
    title="מה כל שלב כולל"
    class="group w-full shrink-0 rounded-[16px] bg-surface/80 px-3 py-2.5 text-start shadow-[var(--shadow-paper)] cursor-pointer md:w-[430px]"
    aria-label=${`השלב של העסק: ${STAGES[i].label}, ${i + 1} מתוך 3. לפרטים`}
  >
    <ol class="flex items-center gap-1.5">
      ${STAGES.map(
        (s, k) => html`<li key=${s.id} class="flex min-w-0 flex-1 items-center gap-1.5">
          <span class=${cx(
            'grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2 font-display text-[13px] font-extrabold',
            k < i && 'border-ink bg-white',
            k === i && 'border-brand-600 bg-brand-600 text-white',
            k > i && 'border-line bg-white text-faint',
          )}>${k < i ? html`<${PencilCheck} size=${15} color="#2d3e66" weight=${3} />` : s.n}</span>
          <span class=${cx('truncate text-[13px] font-bold', k === i ? 'text-ink' : 'text-muted max-md:hidden')}>${s.short}</span>
          ${k < STAGES.length - 1 && html`<span class=${cx('h-[2px] min-w-2 flex-1 rounded', k < i ? 'bg-ink' : 'bg-line')}></span>`}
        </li>`,
      )}
    </ol>
    <span class="mt-1 flex items-center justify-between gap-2 text-[12px] font-semibold text-muted">
      <span class="fb-hand !text-[19px]">כאן העסק שלך עכשיו</span>
      <span class="text-brand-600 group-hover:underline">מה כל שלב כולל</span>
    </span>
  </button>`;
}

// ---------- the next step: the shark's note with one primary action ----------

// One note per page, always above everything else. It says what matters now and
// gives one button. Other reminders fold under it ("עוד 2").
export function NextStep({ mood = 'calm', title, text, action, onAction, secondary, more = [], onMore, celebrate }) {
  const [open, setOpen] = useState(false);
  return html`<div class="relative">
    <${Note} tone="white" tilt=${-0.6} class=${cx('rise !pb-4 !pt-7 md:!px-6', celebrate && '!bg-[#f1f7ff]')}>
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:gap-5">
        <div class="flex min-w-0 flex-1 items-start gap-3">
          <${SharkAvatar} size=${52} mood=${mood} />
          <div class="min-w-0">
            <p class="fb-meta !text-[12px] font-bold">${PARTNER.name} · הצעד הבא</p>
            <p class="mt-0.5 font-display text-[18px] font-extrabold leading-snug text-ink md:text-[20px]">${title}</p>
            ${text && html`<p class="mt-1 text-[15px] leading-relaxed text-ink-2">${text}</p>`}
          </div>
        </div>
        ${action &&
        html`<div class="flex shrink-0 flex-col items-stretch gap-1.5 md:items-end">
          <${Button} class="max-md:w-full" onClick=${onAction}>${action}<${Icon} name="arrow-left" size=${20} /><//>
          ${secondary}
        </div>`}
      </div>
      ${more.length > 0 &&
      html`<div class="mt-3 border-t border-dashed border-line pt-2">
        <button type="button" onClick=${() => setOpen((o) => !o)} aria-expanded=${open} class="flex items-center gap-1.5 text-[14px] font-bold text-brand-600 cursor-pointer">
          <${Icon} name=${open ? 'chevron-up' : 'chevron-down'} size=${16} />${open ? 'הסתרה' : `עוד ${more.length} ${more.length === 1 ? 'תזכורת' : 'תזכורות'}`}
        </button>
        ${open &&
        html`<ul class="mt-2 flex flex-col gap-1.5">
          ${more.map(
            (a) => html`<li key=${a.id} class="flex flex-wrap items-center gap-2 rounded-xl bg-canvas px-3 py-2 text-[14px]">
              <${Icon} name=${a.icon} size=${17} class=${a.tone === 'error' ? 'text-error' : a.tone === 'warn' ? 'text-warn' : 'text-brand-600'} />
              <span class="min-w-0 flex-1"><b>${a.title}</b><span class="block text-[13px] text-muted">${a.text}</span></span>
              ${a.action && html`<${Button} variant="text" class="!h-9 !px-2" onClick=${() => onMore(a)}>${a.actionLabel}<//>`}
            </li>`,
          )}
        </ul>`}
      </div>`}
    <//>
  </div>`;
}

// A bar with milestones (used for "covered the expenses" and "the goal").
export function Meter({ value, max, marks = [], tone = 'brand' }) {
  const pct = (v) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  return html`<div class="relative pb-6 pt-1" dir="rtl">
    <div class="h-3 overflow-hidden rounded-full bg-line" aria-hidden="true">
      <div class=${cx('h-full rounded-full transition-all duration-500', tone === 'money' ? 'bg-money' : tone === 'warn' ? 'bg-warn' : 'bg-brand-600')} style=${{ width: pct(value) }}></div>
    </div>
    ${marks.map(
      (m) => html`<span key=${m.label} class="absolute top-0 flex flex-col items-center" style=${{ right: pct(m.at), transform: 'translateX(50%)' }}>
        <span class="h-5 w-[2px] rounded bg-ink"></span>
        <span class="mt-0.5 whitespace-nowrap text-[11px] font-bold text-ink">${m.label}</span>
      </span>`,
    )}
  </div>`;
}
