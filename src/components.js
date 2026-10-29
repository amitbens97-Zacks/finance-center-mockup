// v4 UI pieces, built on the FlowBiz design system (assets/ds/bundle.css, fb-* classes):
// fixed top and bottom bars, the step heading on the notebook page, sticky notes,
// and the business partner (a draggable bubble with the chosen partner's photo).
import { html, useState, useEffect, useRef, Icon, PencilCheck, PencilLine, cx, seenMessages } from './lib.js';
import { PARTNER } from './data.js';

// The FlowBiz logo (pencil-drawn wave and arrow over the wordmark).
export function Logo({ size = 'md' }) {
  const h = size === 'sm' ? 36 : 44;
  return html`<img
    src=${h > 40 ? 'assets/flowbiz-logo-md.png' : 'assets/flowbiz-logo-sm.png'}
    alt="FlowBiz"
    draggable="false"
    class="block w-auto select-none"
    style=${{ height: `${h}px` }}
  />`;
}

// Highlighter stroke behind a word or two in a headline (one per screen).
export function Mark({ children }) {
  return html`<span class="fb-marker">${children}</span>`;
}

// Buttons from the design system. One primary per screen, always bottom-left.
//   primary   - the one action that moves forward (52px, flag blue)
//   secondary - "חזרה" and secondary actions
//   mini      - an action inside a panel ("הוספה")
//   text      - a quiet link-like action ("הוספה ועריכה", "לדף הבית")
//   quiet     - small tool buttons
export function Button({ variant = 'primary', class: cls = '', children, ...rest }) {
  const base = {
    primary: 'fb-btn fb-btn-primary',
    secondary: 'fb-btn fb-btn-secondary',
    mini: 'fb-btn fb-btn-mini',
    text: 'fb-btn fb-btn-text',
    quiet:
      'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-[14px] font-semibold text-muted hover:bg-brand-50 hover:text-brand-700 cursor-pointer',
  }[variant];
  const off = rest.disabled && variant === 'primary' ? 'is-off' : '';
  return html`<button type="button" class=${cx(base, off, 'disabled:cursor-not-allowed', cls)} ...${rest}>${children}</button>`;
}

export function IconBtn({ icon, label, active, class: cls = '', ...rest }) {
  return html`<button
    type="button"
    title=${label}
    aria-label=${label}
    aria-pressed=${active}
    class=${cx(
      'inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors cursor-pointer',
      active ? 'border-brand-600 bg-brand-600 text-white' : 'border-transparent text-muted hover:border-line hover:bg-white hover:text-brand-700',
      cls,
    )}
    ...${rest}
  >
    <${Icon} name=${icon} size=${18} />
  </button>`;
}

export function Panel({ class: cls = '', children, ...rest }) {
  return html`<div class=${cx('fb-panel', cls)} ...${rest}>${children}</div>`;
}

export function Dots() {
  return html`<span class="inline-flex gap-1 align-middle" aria-label="חושב">
    <span class="pulse-dot h-1.5 w-1.5 rounded-full bg-brand-600"></span>
    <span class="pulse-dot h-1.5 w-1.5 rounded-full bg-brand-600" style="animation-delay:.2s"></span>
    <span class="pulse-dot h-1.5 w-1.5 rounded-full bg-brand-600" style="animation-delay:.4s"></span>
  </span>`;
}

// Word-by-word reveal; instant once seen.
export function Typed({ id, text, speed = 26 }) {
  const seen = seenMessages.has(id);
  const words = text.split(' ');
  const [count, setCount] = useState(seen ? words.length : 0);
  useEffect(() => {
    if (seen) return;
    setCount(0);
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      setCount(i);
      if (i >= words.length) {
        clearInterval(t);
        seenMessages.add(id);
      }
    }, speed);
    return () => clearInterval(t);
  }, [id]);
  return html`<span>${words.slice(0, count).join(' ')}</span>`;
}

// ---------- Fixed top bar: step and chapter, progress in the middle, home ----------

// Progress lives only here: one segment per part, completed parts are clickable,
// the current part shows its position ("סל המוצרים · 2/4").
export function Progress({ parts, current, maxReached, onJump, done }) {
  return html`<div class="fb-progress" aria-label="התקדמות השלב">
    <div class="fb-progress-segs">
      ${parts.map((p, i) => {
        const isDone = done || i < current || (i <= maxReached && i !== current);
        return html`<i
          key=${p}
          class=${cx(isDone && 'is-done', i === current && !done && 'is-now')}
          style=${i === current && !done ? { '--fill': '55%' } : undefined}
          title=${isDone && i !== current ? `חזרה לחלק: ${p}` : undefined}
          onClick=${() => isDone && i !== current && onJump(i)}
        ></i>`;
      })}
    </div>
    <div class="fb-progress-labels">
      ${parts.map((p, i) => {
        const back = (done || i <= maxReached) && i !== current;
        return html`<span
          key=${p}
          class=${cx(i === current && !done && 'is-on', back && 'is-back')}
          role=${back ? 'button' : undefined}
          tabindex=${back ? 0 : undefined}
          onClick=${() => back && onJump(i)}
          onKeyDown=${(e) => back && e.key === 'Enter' && onJump(i)}
        >${p}${i === current && !done ? ` · ${i + 1}/${parts.length}` : ''}</span>`;
      })}
    </div>
  </div>`;
}

export function TopBar({ step, progress, tools, onHome }) {
  return html`<header class="no-print z-20 shrink-0 border-b border-line bg-surface">
    <div class="flex h-16 items-center gap-3 px-3 md:grid md:grid-cols-[1fr_minmax(0,470px)_1fr] md:gap-4 md:px-7">
      <div class="fb-crumb min-w-0">
        <span class="fb-chip-ic h-10 w-10 shrink-0"><${Icon} name="package" size=${22} /></span>
        <div class="min-w-0">
          <b class="truncate">${step.name}</b>
          <small class="block truncate">פרק ${step.chapterNo} · ${step.chapter}</small>
        </div>
      </div>
      <div class="hidden md:block">${progress}</div>
      <div class="ms-auto flex items-center gap-2 md:justify-self-end">
        ${tools}
        <button type="button" class="fb-home cursor-pointer whitespace-nowrap" onClick=${onHome}>
          <${Icon} name="house" size=${16} /><span class="max-sm:hidden">לדף הבית</span>
        </button>
      </div>
    </div>
    <div class="px-4 pb-2.5 md:hidden">${progress}</div>
  </header>`;
}

// ---------- Fixed bottom bar: "חזרה" right, one status in the middle, primary left ----------

// One status at a time, by priority: undo, the reason the primary is off, save state, what's next.
export function Status({ undo, onUndo, reason, save, hint }) {
  if (undo)
    return html`<span key=${undo.id} class="fb-undo" role="status">${undo.text} · <button type="button" onClick=${onUndo}>ביטול</button></span>`;
  if (reason) return html`<span class="fb-status is-reason" role="status">${reason}</span>`;
  if (save === 'saving') return html`<span class="fb-status" role="status"><span class="fb-spin"></span>שומר...</span>`;
  if (save === 'failed') return html`<span class="fb-status is-failed" role="status">לא נשמר, מנסים שוב</span>`;
  if (save === 'saved') return html`<span class="fb-status is-saved" role="status"><${PencilCheck} size=${16} color="#0038b8" weight=${3} />נשמר</span>`;
  if (hint) return html`<span class="fb-status" role="status">${hint}</span>`;
  return html`<span></span>`;
}

export function BottomBar({ back, extra, status, primary }) {
  return html`<div class="no-print pb-safe shrink-0 border-t border-line bg-surface">
    <div class="hidden h-20 grid-cols-[1fr_auto_1fr] items-center gap-4 px-7 md:grid">
      <div class="flex items-center gap-2.5 justify-self-start">${back}${extra}</div>
      <div class="justify-self-center">${status}</div>
      <div class="justify-self-end">${primary}</div>
    </div>
    <div class="flex flex-col gap-2 px-4 pt-3 md:hidden">
      <div class="flex min-h-6 justify-center text-center">${status}</div>
      <div class="[&>button]:w-full">${primary}</div>
      <div class="flex items-center justify-center gap-4">${back}${extra}</div>
    </div>
  </div>`;
}

// The primary button: label from the button dictionary, arrow after it, ↵ hint on desktop.
export function PrimaryButton({ label, onClick, disabled, check }) {
  return html`<${Button} onClick=${onClick} disabled=${disabled}>
    ${label}
    ${check ? html`<${PencilCheck} size=${20} color="#ffffff" weight=${2.8} />` : html`<${Icon} name="arrow-left" size=${20} />`}
    <kbd class="fb-key max-md:hidden" title="אפשר גם במקש אנטר">↵</kbd>
  <//>`;
}

// ---------- Step heading, written straight on the page ----------

export function StepHeading({ n, eyebrow, title, sub, children }) {
  return html`<div class="fb-heading mb-4">
    <span class="fb-wm" aria-hidden="true">${n}</span>
    <span class="fb-eyebrow">${eyebrow}</span>
    <h1 class="fb-h1 text-[28px] md:text-[36px]">${title[0]}<${Mark}>${title[1]}<//>${title[2]}</h1>
    ${sub && html`<p>${sub}</p>`}
    ${children}
  </div>`;
}

// ---------- Sticky notes ----------

export function Note({ tone, tilt = -1.5, class: cls = '', style = {}, children }) {
  return html`<div class=${cx('fb-note', tone && `is-${tone}`, cls)} style=${{ '--tilt': `${tilt}deg`, ...style }}>${children}</div>`;
}

// "למה זה חשוב?": open on the first visit, folded into a tab afterwards.
const WHY_KEY = 'flowbiz-v4-why-seen';
export function WhyNote({ children }) {
  // Open on the first visit; on phones it starts folded, like every note there.
  const [open, setOpen] = useState(() => {
    if (window.innerWidth < 768) return false;
    try {
      return !localStorage.getItem(WHY_KEY);
    } catch {
      return true;
    }
  });
  const fold = () => {
    setOpen(false);
    try {
      localStorage.setItem(WHY_KEY, '1');
    } catch {}
  };
  if (!open)
    return html`<button type="button" class="fb-note-tab cursor-pointer" onClick=${() => setOpen(true)}>
      <${Icon} name="lightbulb" size=${16} />למה זה חשוב?
    </button>`;
  return html`<${Note} tilt=${-1} class="rise max-w-md">
    <span class="flex items-start justify-between gap-2">
      <span class="fb-note-kicker">למה זה חשוב?</span>
      <button type="button" aria-label="קיפול הפתק" title="קיפול" class="-mt-1 rounded p-1 text-muted hover:text-ink cursor-pointer" onClick=${fold}><${Icon} name="minus" size=${16} /></button>
    </span>
    ${children}
  <//>`;
}

// ---------- The business partner ----------

// A message from the partner on the page, as a white note.
export function PartnerNote({ title = 'הצעה לתשובה', children, action, tilt = -1, class: cls = '', mood = 'calm' }) {
  return html`<${Note} tone="white" tilt=${tilt} class=${cx('slide-in', cls)}>
    <span class="mb-1.5 flex items-center gap-2">
      <${SharkAvatar} size=${34} mood=${mood} />
      <span><b class="font-display">${PARTNER.name}</b><br /><span class="fb-meta">${title}</span></span>
    </span>
    <div class="text-[16px] leading-relaxed">${children}</div>
    ${action}
  <//>`;
}

export function FillButton({ onClick, children = 'להכניס לתשובה' }) {
  return html`<button type="button" class="fb-fill-btn" onClick=${onClick}><${Icon} name="corner-down-left" size=${16} />${children}</button>`;
}

export function FilledBy({ onUndo }) {
  return html`<span class="fb-filled-by"><${Icon} name="pencil" size=${14} />${PARTNER.name} מילא${onUndo
      ? html` · <button type="button" class="cursor-pointer underline underline-offset-2" onClick=${onUndo}>ביטול</button>`
      : ''}</span>`;
}

// The partner bubble: photo, name and a short status, bottom-right of the page.
// Drag it anywhere on the page, but never onto anything clickable (it returns to the
// last free spot) and never into the fixed bars. Its position is remembered.
// A tap (no drag) opens the partner's note.
const POS_KEY = 'flowbiz-fin-partner-pos';
const HIT = 'button, a, input, textarea, select, [role="button"], [role="tab"], [role="checkbox"], .fb-btn, .fb-chip, .fb-tile, .fb-field, .fb-note, .fb-panel';

export function PartnerBubble({ message, unread, onRead, action, mood = 'calm' }) {
  const el = useRef();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(POS_KEY)) || null;
    } catch {
      return null;
    }
  });
  const [state, setState] = useState('');
  const [side, setSide] = useState({ x: 'right', y: 'up' });
  const drag = useRef(null);

  // The note opens toward the free side of the page: away from the nearest edge.
  const toggle = () => {
    const b = box()?.getBoundingClientRect();
    const r = el.current?.getBoundingClientRect();
    if (b && r) setSide({ x: r.left + r.width / 2 > b.left + b.width / 2 ? 'right' : 'left', y: r.top - b.top < 320 ? 'down' : 'up' });
    setOpen((o) => !o);
    onRead();
  };

  useEffect(() => setOpen(false), [message]);
  // Once the partner's suggestion went in, the note has done its job.
  const hadAction = useRef(!!action);
  useEffect(() => {
    if (hadAction.current && !action) setOpen(false);
    hadAction.current = !!action;
  }, [!!action]);

  const box = () => el.current?.parentElement;
  const rel = (node) => {
    const r = node.getBoundingClientRect();
    const b = box().getBoundingClientRect();
    return { l: r.left - b.left, t: r.top - b.top, w: r.width, h: r.height };
  };
  const blocked = (l, t) => {
    const me = { l, t, w: el.current.offsetWidth, h: el.current.offsetHeight };
    return [...box().querySelectorAll(HIT)].some((h) => {
      if (el.current.contains(h)) return false;
      const o = rel(h);
      return me.l < o.l + o.w && me.l + me.w > o.l && me.t < o.t + o.h && me.t + me.h > o.t;
    });
  };

  const down = (e) => {
    const r = rel(el.current);
    drag.current = { sx: e.clientX, sy: e.clientY, l: r.l, t: r.t, last: { l: r.l, t: r.t }, moved: false };
    el.current.setPointerCapture(e.pointerId);
  };
  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    d.moved = true;
    const b = box();
    const l = Math.max(0, Math.min(b.clientWidth - el.current.offsetWidth, d.l + dx));
    const t = Math.max(0, Math.min(b.clientHeight - el.current.offsetHeight, d.t + dy));
    const bad = blocked(l, t);
    if (!bad) d.last = { l, t };
    setState(bad ? 'blocked' : 'dragging');
    setPos({ l, t });
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) {
      toggle();
      return;
    }
    setState('');
    setPos(d.last);
    try {
      localStorage.setItem(POS_KEY, JSON.stringify(d.last));
    } catch {}
  };

  const place = pos ? { left: `${pos.l}px`, top: `${pos.t}px` } : { right: '20px', bottom: '20px' };
  return html`<div
    ref=${el}
    class=${cx('fb-partner no-print !py-1.5 !pe-4 !ps-1.5 max-md:!p-1', state === 'dragging' && 'is-dragging', state === 'blocked' && 'is-dragging is-blocked')}
    style=${place}
    role="button"
    tabindex="0"
    aria-label=${`${PARTNER.name}, ${PARTNER.role}${unread ? ', הודעה חדשה' : ''}. אפשר לגרור`}
    onPointerDown=${down}
    onPointerMove=${move}
    onPointerUp=${up}
    onKeyDown=${(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), e.stopPropagation(), toggle())}
  >
    <${SharkAvatar} size=${46} mood=${mood} />
    <span class="max-md:hidden"><b>${PARTNER.name}</b><small>${unread ? 'יש לי הצעה' : PARTNER.role}</small></span>
    ${unread && html`<span class="fb-badge" style="left:auto; right:36px">1</span>`}
    ${open &&
    html`<div
      class=${cx('absolute w-[min(340px,80vw)] cursor-auto', side.y === 'up' ? 'bottom-[calc(100%+16px)]' : 'top-[calc(100%+16px)]', side.x === 'right' ? 'right-0' : 'left-0')}
      onPointerDown=${(e) => e.stopPropagation()}
      onPointerUp=${(e) => e.stopPropagation()}
    >
      <${PartnerNote} title=${PARTNER.role} action=${action} mood=${mood}>
        <${Typed} key=${message} id=${message} text=${message} />
      <//>
    </div>`}
  </div>`;
}

// The shark icon (FlowBiz shark icon guide): the file already holds its own round frame;
// at 40px and below the simpler "-sm" drawing. Moods: calm, happy, thinking, alert
// (a business warning). Decorative: the name is always written beside it.
export function SharkAvatar({ size = 46, mood = 'calm' }) {
  const file = `assets/shark/shark-${mood}${size <= 40 ? '-sm' : ''}.svg`;
  return html`<img
    src=${file}
    alt=""
    aria-hidden="true"
    draggable="false"
    class="pointer-events-none block shrink-0 select-none rounded-full bg-white"
    style=${{ width: `${size}px`, height: `${size}px`, border: '2px solid #fff', boxShadow: '0 0 0 2px #8fb3ef' }}
  />`;
}

// ---------- Small helpers ----------

// Click-to-edit text. Enter (Ctrl+Enter when multiline) or blur saves, Escape cancels.
export function InlineEdit({ value, onSave, multiline, class: cls = '', inputClass = '', placeholder = 'לעריכה', format }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const ref = useRef();
  useEffect(() => {
    if (editing && ref.current) ref.current.focus();
  }, [editing]);
  const commit = () => {
    setEditing(false);
    if (draft !== value) onSave(draft);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') {
      setDraft(value ?? '');
      setEditing(false);
    }
    if (e.key === 'Enter' && (!multiline || e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      e.stopPropagation();
      commit();
    }
  };
  if (editing) {
    const props = {
      ref,
      value: draft,
      onInput: (e) => setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: onKey,
      class: cx('w-full rounded-lg border-[1.5px] border-brand-600 bg-white px-2 py-1 outline-none ring-4 ring-brand-100', inputClass),
    };
    return multiline ? html`<textarea rows="3" ...${props}></textarea>` : html`<input ...${props} />`;
  }
  const shown = format ? format(value) : value;
  return html`<button
    type="button"
    onClick=${() => {
      setDraft(value ?? '');
      setEditing(true);
    }}
    class=${cx('text-start rounded-md -mx-1 px-1 cursor-text decoration-brand-300 decoration-dashed underline-offset-4 hover:underline hover:bg-brand-50', cls)}
    title="לעריכה"
  >
    ${shown === '' || shown == null ? html`<span class="text-faint">${placeholder}</span>` : shown}
  </button>`;
}

// A short message after an action. After an action that changes money it carries
// "ביטול" for 5 seconds (the design system's uniform undo).
export function Toast({ toast, onUndo }) {
  if (!toast) return null;
  return html`<div class="pointer-events-none fixed inset-x-0 bottom-28 z-[60] flex justify-center px-4" role="status">
    <div key=${toast.id} class="rise pointer-events-auto flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-[14px] font-semibold text-white shadow-xl">
      <${Icon} name=${toast.icon || 'info'} size=${16} class="text-brand-300" /> ${toast.text}
      ${toast.undo && html` · <button type="button" onClick=${onUndo} class="font-bold text-brand-300 underline underline-offset-2 cursor-pointer">ביטול</button>`}
    </div>
  </div>`;
}

export { PencilLine };
