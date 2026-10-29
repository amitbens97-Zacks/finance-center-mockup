// The three boards of the finance center, one per stage of the business:
//   1. setup  - the setup budget against what was paid, how long the money lasts,
//               the break-even point, and getting ready for the first client
//   2. first  - this month (in, out, left), money waiting from clients, all payments
//   3. active - the full cash flow (the till and its forecast, this month, the next 30 days)
// Every board is a column of numbered panels in order of importance: panel 1 holds the
// one answer that matters most in the stage, in the biggest type on the page. Every
// number the user owns is editable in place (dashed underline + pencil).
// The page heading and the "next step" note above the board are in main.js.
import { html, useState, Icon, PencilCheck, cx } from './lib.js';
import { Button } from './components.js';
import { CashChart, ChartLegend, ChartTable } from './chart.js';
import { Panel, Tag, Amount, Meter, NumEdit, Equation } from './ui.js';
import { TODAY, CATEGORIES, ENTITIES } from './data.js';
import {
  addDays, addMonths, dm, monthName, monthEnd, daysBetween, toDate, fmt,
  series, balanceOn, monthSummary, next30, weeks, WEEK_ROWS,
  dealPayments, paymentStatus, paymentLabel, productOf, termsOf, freqText, monthlyCost, expenseDates,
  setupSummary, runway, breakEven, readiness, goalOf,
} from './finance.js';

const RANGE_END = '2026-12-31';
const monthYear = (s) => `${monthName(s)} ${toDate(s).getFullYear()}`;
const sum = (list) => list.reduce((t, x) => t + x.amount, 0);

const Label = ({ children, class: cls = '' }) => html`<p class=${cx('text-[13px] font-bold text-muted', cls)}>${children}</p>`;
const Big = ({ children, class: cls = '' }) => html`<p class=${cx('font-display text-[36px] font-extrabold leading-none text-ink md:text-[46px]', cls)}>${children}</p>`;
const EditHint = () => html`<span class="inline-flex items-center gap-1"><${Icon} name="pencil" size=${13} class="text-brand-600" />מספר עם קו מקווקו משתנה בלחיצה.</span>`;

// One line of a short calculation: "− נשאר לשלם על ההקמה  3,100 ₪".
const CalcRow = ({ op, label, note, value, strong }) => html`<div class=${cx('flex items-center gap-2 py-2.5', strong && 'border-t-2 border-ink/60')}>
  <span class="w-4 shrink-0 text-center font-display text-[17px] font-extrabold text-faint" aria-hidden="true">${op}</span>
  <span class=${cx('min-w-0 flex-1 text-[14px]', strong ? 'font-extrabold' : 'font-bold')}>${label}${note && html`<span class="block text-[12px] font-semibold text-muted">${note}</span>`}</span>
  <span class="text-[16px]">${value}</span>
</div>`;
const Num = ({ n, class: cls = '' }) => html`<span class=${cx('whitespace-nowrap font-display font-extrabold tabular-nums', cls)}>${fmt(n)}</span>`;

// ---------- shared lists ----------

function DealCards({ state, onPaid, onRemind, onChat, wide }) {
  // Deals with a late payment first, then by the closing date (newest first).
  const late = (d) => dealPayments(d, TODAY).some((p) => paymentStatus(p) === 'late');
  const deals = [...state.deals].sort((a, b) => late(b) - late(a) || (a.closed < b.closed ? 1 : -1));
  return html`<div class=${cx('grid gap-3', wide && 'md:grid-cols-2')}>
    ${deals.map((d) => {
      const ps = dealPayments(d, monthEnd(addMonths(TODAY, 2)));
      const paid = ps.filter((p) => p.paidOn).reduce((s, p) => s + p.amount, 0);
      return html`<article key=${d.id} class=${cx('rounded-[14px] border bg-white p-3.5', late(d) ? 'border-error/40' : 'border-line')}>
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <h3 class="font-display text-[16px] font-extrabold">${d.client}</h3>
            <p class="truncate text-[12px] text-muted">${productOf(d.product)?.short} · ${termsOf(d.terms).label} · נסגר ${dm(d.closed)}</p>
            ${d.phone &&
            html`<button type="button" onClick=${() => onChat(d)} title=${`שיחה עם ${d.client} ב-WhatsApp`} class="mt-1 inline-flex items-center gap-1 rounded-full bg-money-50 px-2 py-0.5 text-[12px] font-bold text-money hover:bg-[#d6ede4] cursor-pointer">
              <${Icon} name="message-circle" size=${13} /><span dir="ltr" class="tabular-nums">${d.phone}</span>
            </button>`}
          </div>
          <span class="text-end">
            <b class="block font-display text-[16px] font-extrabold tabular-nums">${d.monthly ? `${fmt(d.monthly.amount)} בחודש` : fmt(d.total)}</b>
            ${!d.monthly && html`<span class="text-[12px] text-muted">התקבלו ${fmt(paid)}</span>`}
          </span>
        </div>
        <ul class="mt-2.5 flex flex-col gap-2">
          ${ps.map((p) => {
            const st = paymentStatus(p);
            return html`<li key=${p.id} class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px]">
              <span class="w-11 shrink-0 font-display font-extrabold tabular-nums">${dm(p.due)}</span>
              <span class="min-w-0 flex-1 truncate text-muted">${paymentLabel(d, p)}</span>
              <span class="font-display font-extrabold tabular-nums">${fmt(p.amount)}</span>
              ${st === 'paid'
                ? html`<${Tag} tone="paid"><${Icon} name="check" size=${13} />התקבל ${dm(p.paidOn)}<//>`
                : html`<span class="flex w-full items-center justify-end gap-1.5 sm:w-auto">
                    ${st === 'late' && html`<${Tag} tone="late">באיחור ${daysBetween(p.due, TODAY)} ימים<//>`}
                    ${state.reminders[p.id] && html`<${Tag}>נשלחה תזכורת ${dm(state.reminders[p.id])}<//>`}
                    ${(st === 'late' || daysBetween(TODAY, p.due) <= 3) &&
                    html`<button type="button" title="תזכורת ב-WhatsApp" aria-label="תזכורת ב-WhatsApp" onClick=${() => onRemind(d, p)} class="inline-flex h-9 w-9 items-center justify-center rounded-lg text-brand-600 hover:bg-brand-50 cursor-pointer"><${Icon} name="message-circle" size=${17} /></button>`}
                    <button type="button" onClick=${() => onPaid(d, p)} class="h-9 rounded-lg border border-brand-300 px-3 text-[13px] font-bold text-brand-600 hover:bg-brand-50 cursor-pointer">התקבל</button>
                  </span>`}
            </li>`;
          })}
        </ul>
      </article>`;
    })}
  </div>`;
}

function OpenDeals({ state }) {
  if (!state.openDeals.length) return null;
  return html`<div class="mt-4">
    <h3 class="mb-2 text-[14px] font-bold text-muted">עסקאות פתוחות בלידים · עוד לא כסף</h3>
    <ul class="flex flex-col divide-y divide-line rounded-[14px] border border-dashed border-brand-300 bg-brand-50/40 px-3.5">
      ${state.openDeals.map(
        (o) => html`<li key=${o.id} class="flex items-center gap-2 py-2.5 text-[14px]">
          <span class="min-w-0 flex-1"><b>${o.client}</b><span class="block text-[12px] text-muted">${productOf(o.product)?.short} · ${o.stage}</span></span>
          <${Tag} tone="due">סיכוי ${o.chance}%<//>
          <span class="font-display font-extrabold tabular-nums">${fmt(o.total)}</span>
        </li>`,
      )}
    </ul>
  </div>`;
}

// The fixed expenses. The amount changes in place; the name opens the full window
// (charge day, frequency, category, delete).
function ExpenseList({ state, on }) {
  const next = (x) => expenseDates(x, addDays(TODAY, 1), addDays(TODAY, 400))[0];
  return html`<ul class="flex flex-col divide-y divide-line rounded-[14px] border border-line bg-white px-3.5">
    ${state.expenses.map(
      (x) => html`<li key=${x.id} class="flex min-h-[54px] items-center gap-3 py-2">
        <span class="fb-chip-ic h-8 w-8 shrink-0"><${Icon} name=${CATEGORIES[x.category].icon} size=${16} /></span>
        <button type="button" onClick=${() => on.expense(x)} title="יום חיוב, תדירות ומחיקה" class="group min-w-0 flex-1 text-start cursor-pointer">
          <b class="block truncate text-[14px] group-hover:text-brand-600">${x.name}</b>
          <span class="block text-[12px] text-muted">${freqText(x)}${next(x) ? ` · הבא ${dm(next(x))}` : ''}</span>
        </button>
        <${NumEdit} value=${x.amount} label=${x.name} onSave=${(v) => on.setExpense(x.id, { amount: v })} class="text-[15px]" />
      </li>`,
    )}
    <li>
      <button type="button" onClick=${() => on.expense()} class="flex h-12 w-full items-center gap-2 text-[14px] font-bold text-brand-600 cursor-pointer"><${Icon} name="plus" size=${16} />הוצאה קבועה</button>
    </li>
  </ul>`;
}

function Tabs({ n, title, list, tab, onTab, children }) {
  return html`<section class="fb-panel !p-4 md:!p-6">
    ${title &&
    html`<h2 class="fb-h3 mb-3 flex items-center gap-2.5">
      ${n != null && html`<span class="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-600 font-display text-[16px] font-extrabold text-white" aria-hidden="true">${n}</span>`}${title}
    </h2>`}
    <div role="tablist" class="no-scrollbar -mx-1 mb-4 flex gap-1 overflow-x-auto px-1">
      ${list.map(
        ([id, label, icon]) => html`<button
          key=${id}
          type="button"
          role="tab"
          aria-selected=${tab === id}
          onClick=${() => onTab(id)}
          class=${cx('flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-[14px] font-bold transition-colors cursor-pointer', tab === id ? 'bg-brand-100 text-brand-600' : 'text-muted hover:bg-canvas hover:text-ink')}
        ><${Icon} name=${icon} size=${16} />${label}</button>`,
      )}
    </div>
    ${children}
  </section>`;
}

// ---------- stage 1: setup ----------

const BUDGET_COLS = 'md:grid-cols-[minmax(0,1fr)_124px_124px_112px_96px]';

function BudgetRow({ x, on }) {
  const over = x.spent - x.planned;
  const left = x.done ? 0 : Math.max(0, x.planned - x.spent);
  const cell = (label, node) => html`<div class="min-w-0"><span class="block text-[12px] font-bold text-muted md:hidden">${label}</span>${node}</div>`;
  const more = (cls) => html`<button type="button" onClick=${() => on.item(x)} title="שם, תשלומים ומחיקה" aria-label=${`עוד אפשרויות: ${x.name}`} class=${cx('h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-brand-50 hover:text-brand-600 cursor-pointer', cls)}><${Icon} name="ellipsis" size=${18} /></button>`;
  return html`<li class=${cx('grid grid-cols-4 items-end gap-x-2 gap-y-2 border-t border-line py-3 md:items-center md:gap-x-3', BUDGET_COLS)}>
    <div class="col-span-4 flex min-w-0 items-center gap-2.5 md:col-span-1">
      <span class="fb-chip-ic h-9 w-9 shrink-0"><${Icon} name=${x.icon || 'package'} size=${17} /></span>
      <b class=${cx('min-w-0 truncate text-[15px]', x.done && 'text-muted')}>${x.name}</b>
      ${over > 0 && html`<${Tag} tone="warn">${fmt(over)} מעל<//>`}
      <span class="flex-1"></span>
      ${more('inline-flex md:hidden')}
    </div>
    ${cell('תכננת', html`<${NumEdit} value=${x.planned} label=${`תכננת ל${x.name}`} onSave=${(v) => on.setItem(x.id, { planned: v })} quiet class="text-[16px]" />`)}
    ${cell('שולם', html`<${NumEdit} value=${x.spent} label=${`שולם על ${x.name}`} onSave=${(v) => on.setItem(x.id, { spent: v })} quiet class="text-[16px]" />`)}
    ${cell('נשאר לשלם', html`<span class=${cx('font-display text-[16px] font-extrabold tabular-nums', left ? 'text-ink' : 'text-faint')}>${left ? fmt(left) : '—'}</span>`)}
    <div class="flex items-center justify-end">
      <div class="flex flex-col items-center md:block"><span class="block text-[12px] font-bold text-muted md:hidden">שולם במלואו</span><button
        type="button"
        role="checkbox"
        aria-checked=${x.done}
        aria-label=${`${x.name}: שולם במלואו`}
        onClick=${() => on.setItem(x.id, { done: !x.done })}
        class="inline-flex h-10 items-center gap-2 rounded-lg px-1.5 text-[14px] font-bold text-ink hover:bg-brand-50 cursor-pointer"
      >
        <span class=${cx('grid h-6 w-6 place-items-center rounded-md border-2 bg-white', x.done ? 'border-ink' : 'border-line')}>${x.done && html`<${PencilCheck} size=${16} color="#0038b8" weight=${3} />`}</span>
      </button></div>
      ${more('hidden md:inline-flex')}
    </div>
  </li>`;
}

// The total setup budget: one big number that changes in place, and a slider under it.
// While dragging only the number moves; the page updates when the slider is let go.
function BudgetSlider({ b, on }) {
  const [draft, setDraft] = useState(null);
  const v = draft ?? b.budget;
  // The scale follows the items, not the budget, so it stays still while dragging.
  const max = Math.max(20000, Math.ceil((b.allocated * 2) / 5000) * 5000);
  const status =
    b.allocated > v
      ? html`<span class="text-warn">הפריטים עוברים את התקציב ב-${fmt(b.allocated - v)}.</span>`
      : v > b.allocated
        ? `חולקו לפריטים ${fmt(b.allocated)}. עוד ${fmt(v - b.allocated)} לא חולקו, ונספרים ב"נשאר לשלם".`
        : 'כל התקציב חולק לפריטים.';
  return html`<div class="rounded-[14px] bg-canvas px-4 pb-3 pt-3.5">
    <div class="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
      <div>
        <${Label}>סך תקציב ההקמה<//>
        <div class="mt-1 min-h-[46px]">
          ${draft != null
            ? html`<span class="font-display text-[36px] font-extrabold leading-none text-ink md:text-[46px]">${fmt(draft)}</span>`
            : html`<${NumEdit} value=${b.budget} label="סך תקציב ההקמה" onSave=${on.setBudget} class="text-[36px] leading-none md:text-[46px]" />`}
        </div>
      </div>
      <p class="max-w-[360px] text-[13px] font-semibold text-muted">${status}</p>
    </div>
    <input
      type="range"
      min="0"
      max=${max}
      step="100"
      value=${v}
      aria-label="סך תקציב ההקמה"
      aria-valuetext=${fmt(v)}
      onInput=${(e) => setDraft(Number(e.target.value))}
      onChange=${(e) => {
        setDraft(null);
        on.setBudget(Number(e.target.value));
      }}
      class="fb-range mt-4 w-full"
      style=${{ '--p': `${(Math.min(v, max) / max) * 100}%` }}
    />
    <div class="mt-1 flex justify-between text-[12px] font-bold text-muted"><span>0 ₪</span><span>${fmt(max)}</span></div>
  </div>`;
}

export function BudgetPanel({ state, on, n }) {
  const b = setupSummary(state);
  const final = b.spent + b.remaining;
  const max = Math.max(b.budget, final) || 1;
  const pct = (v) => `${(v / max) * 100}%`;
  return html`<${Panel}
    n=${n}
    title="תקציב ההקמה"
    sub=${html`מ"העסק במספרים", מול מה ששולם בפועל. <${EditHint} />`}
    action=${html`<${Button} variant="mini" class="shrink-0" onClick=${on.addItem}><${Icon} name="plus" size=${15} />פריט<//>`}
  >
    <${BudgetSlider} b=${b} on=${on} />
    <dl class="mt-4 grid grid-cols-3 gap-3">
      <div><dt class="flex items-center gap-1.5 text-[13px] font-bold text-muted"><span class="h-2.5 w-2.5 rounded-sm bg-brand-600"></span>שולם</dt><dd class="font-display text-[20px] font-extrabold md:text-[24px]">${fmt(b.spent)}</dd></div>
      <div><dt class="flex items-center gap-1.5 text-[13px] font-bold text-muted"><span class="h-2.5 w-2.5 rounded-sm bg-brand-300"></span>נשאר לשלם</dt><dd class="font-display text-[20px] font-extrabold md:text-[24px]">${fmt(b.remaining)}</dd></div>
      <div>
        <dt class="text-[13px] font-bold text-muted">בסוף ההקמה</dt>
        <dd class="font-display text-[20px] font-extrabold md:text-[24px]">${fmt(final)}</dd>
        <dd class=${cx('text-[12px] font-bold', final > b.budget ? 'text-warn' : 'text-money')}>${final > b.budget ? `${fmt(final - b.budget)} מעל התקציב` : final < b.budget ? `${fmt(b.budget - final)} פחות מהתקציב` : 'בדיוק לפי התקציב'}</dd>
      </div>
    </dl>
    <div class="relative mb-2 mt-4 pb-5" aria-hidden="true">
      <div class="flex h-3.5 gap-[2px] overflow-hidden rounded-full bg-line">
        <span class="h-full bg-brand-600" style=${{ width: pct(b.spent) }}></span>
        <span class="h-full bg-brand-300" style=${{ width: pct(b.remaining) }}></span>
      </div>
      <span class="absolute top-[-3px] flex flex-col items-center" style=${{ right: pct(b.budget), transform: 'translateX(50%)' }}>
        <span class="h-5 w-[2px] rounded bg-ink"></span>
        <span class="mt-0.5 whitespace-nowrap text-[11px] font-bold text-ink">התקציב</span>
      </span>
    </div>

    <div class=${cx('hidden pb-2 text-[12px] font-bold text-muted md:grid md:gap-x-3', BUDGET_COLS)}>
      <span>פריט</span><span>תכננת</span><span>שולם</span><span>נשאר לשלם</span><span class="text-end">שולם במלואו</span>
    </div>
    <ul>${b.items.map((x) => html`<${BudgetRow} key=${x.id} x=${x} on=${on} />`)}</ul>
    ${b.unallocated > 0 &&
    html`<div class=${cx('grid grid-cols-4 items-end gap-x-2 gap-y-2 border-t border-line py-3 md:items-center md:gap-x-3', BUDGET_COLS)}>
      <div class="col-span-4 flex min-w-0 items-center gap-2.5 md:col-span-1">
        <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl border-[1.5px] border-dashed border-brand-300 text-brand-600"><${Icon} name="plus" size=${16} /></span>
        <span class="min-w-0"><b class="block text-[15px]">עוד לא חולק לפריטים</b><button type="button" onClick=${on.addItem} class="text-[12px] font-bold text-brand-600 hover:underline cursor-pointer">לחלק לפריט חדש</button></span>
      </div>
      <div><span class="block text-[12px] font-bold text-muted md:hidden">תכננת</span><${Num} n=${b.unallocated} class="text-[16px]" /></div>
      <div><span class="block text-[12px] font-bold text-muted md:hidden">שולם</span><span class="font-display text-[16px] font-extrabold text-faint">—</span></div>
      <div><span class="block text-[12px] font-bold text-muted md:hidden">נשאר לשלם</span><${Num} n=${b.unallocated} class="text-[16px]" /></div>
    </div>`}
    <div class=${cx('grid grid-cols-4 items-center gap-x-2 gap-y-1 border-t-2 border-ink/70 pt-3 md:gap-x-3', BUDGET_COLS)}>
      <b class="col-span-4 text-[15px] md:col-span-1">סך הכול</b>
      <div><span class="block text-[12px] font-bold text-muted md:hidden">תכננת</span><${Num} n=${b.allocated + b.unallocated} class="text-[15px] md:text-[17px]" /></div>
      <div><span class="block text-[12px] font-bold text-muted md:hidden">שולם</span><${Num} n=${b.spent} class="text-[15px] md:text-[17px]" /></div>
      <div><span class="block text-[12px] font-bold text-muted md:hidden">נשאר לשלם</span><${Num} n=${b.remaining} class="text-[15px] md:text-[17px]" /></div>
    </div>
    <button type="button" onClick=${on.addItem} class="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-brand-300 text-[14px] font-bold text-brand-600 hover:bg-brand-50 cursor-pointer"><${Icon} name="plus" size=${16} />פריט לתקציב</button>
  <//>`;
}

function MonthStrip({ until }) {
  const months = [];
  for (let m = `${TODAY.slice(0, 7)}-01`; m <= until && months.length < 12; m = addMonths(m, 1, 1)) months.push(m);
  return html`<ol class="mt-3 flex gap-[3px]" aria-hidden="true">
    ${months.map(
      (m, i) => html`<li key=${m} class="flex min-w-0 flex-1 flex-col items-center gap-1">
        <span class=${cx('h-6 w-full', i === 0 && 'rounded-s-md', i === months.length - 1 ? 'rounded-e-md bg-warn/70' : 'bg-brand-300')}></span>
        <span class="truncate text-[11px] font-bold text-muted">${monthName(m).slice(0, 3)}</span>
      </li>`,
    )}
  </ol>`;
}

export function RunwayPanel({ state, on, n, compact }) {
  const r = runway(state);
  const [open, setOpen] = useState(false);
  const left = state.deals.length ? 'לפי התשלומים שנקבעו, בלי לקוחות חדשים' : 'אם לא ייכנס כסף מלקוחות';
  return html`<${Panel} n=${n} title="כמה זמן הכסף מחזיק">
    ${r.after < 0
      ? html`<${Label}>הכסף של היום לא מספיק כדי לסיים את ההקמה<//>
          <${Big} class=${cx('mt-1 text-error', compact && '!text-[30px] md:!text-[34px]')}>חסרים ${fmt(-r.after)}<//>
          <p class="mt-1.5 text-[14px] text-muted">כדאי להקטין את תקציב ההקמה, לדחות פריט, או לסגור לקוח ראשון לפני שמשלמים על השאר.</p>`
      : r.until
      ? html`<${Label}>הכסף של העסק מחזיק<//>
          <${Big} class=${cx('mt-1', compact && '!text-[30px] md:!text-[34px]')}>עד ${monthYear(r.until)}<//>
          <p class="mt-1.5 text-[14px] text-muted">בערך ${Math.max(0, Math.floor(r.months))} חודשים מהיום, ${left}.</p>
          <${MonthStrip} until=${r.until} />`
      : html`<p class="font-display text-[26px] font-extrabold leading-tight text-money md:text-[30px]">ההכנסות מכסות את ההוצאות</p>
          <p class="mt-1 text-[14px] text-muted">לפי התשלומים שנקבעו, הכסף של העסק לא יורד מתחת לאפס בשלוש השנים הקרובות.</p>`}
    ${compact
      ? html`<p class="mt-3 text-[14px] text-muted">יש לעסק היום <${NumEdit} value=${r.now} label="יש לעסק היום" onSave=${on.setMoney} class="text-[15px]" /> · הוצאות קבועות <b class="font-display text-ink">${fmt(r.monthly)}</b> בחודש</p>`
      : html`<div class="mt-4 rounded-[14px] border border-line bg-white px-3.5">
          <p class="border-b border-line py-2 text-[12px] font-bold text-muted">איך זה מחושב</p>
          <${CalcRow} label="יש לעסק היום" note="מהבנק. לשנות כשהסכום זז" value=${html`<${NumEdit} value=${r.now} label="יש לעסק היום" onSave=${on.setMoney} />`} />
          ${r.left > 0 && html`<${CalcRow} op="−" label="נשאר לשלם על ההקמה" note="מתקציב ההקמה" value=${html`<${Num} n=${r.left} />`} />`}
          <${CalcRow} op="=" strong label="נשאר אחרי ההקמה" value=${html`<${Num} n=${r.after} class=${r.after < 0 ? 'text-error' : ''} />`} />
          <div class="border-t border-line">
            <button type="button" onClick=${() => setOpen((o) => !o)} aria-expanded=${open} class="w-full cursor-pointer text-start">
              <${CalcRow}
                label=${html`<span class="inline-flex items-center gap-1">הוצאות קבועות בחודש<${Icon} name=${open ? 'chevron-up' : 'chevron-down'} size=${15} class="text-brand-600" /></span>`}
                note=${open ? 'הסכום משתנה בלחיצה' : 'יורדות כל חודש. לפירוט ולשינוי'}
                value=${html`<${Num} n=${r.monthly} />`}
              />
            </button>
            ${open && html`<div class="pb-3"><${ExpenseList} state=${state} on=${on} /></div>`}
          </div>
        </div>`}
  <//>`;
}

export function BreakEvenPanel({ state, on, n }) {
  const be = breakEven(state);
  return html`<${Panel} n=${n} title="נקודת האיזון">
    <${Label}>כדי לכסות את ההוצאות הקבועות צריך להכניס<//>
    <${Big} class="mt-1">${fmt(be.cover)} <span class="text-[20px] md:text-[24px]">בחודש</span><//>
    <p class="mt-1.5 text-[14px] text-muted">הוצאות ${fmt(be.monthly)} בחודש, ועוד <${NumEdit} value=${state.taxPct} unit="%" label="אחוז בצד למס" onSave=${on.setTax} class="text-[14px]" /> בצד למס (${ENTITIES[state.entity].label}).</p>
    <div class="mt-4 rounded-[14px] bg-brand-100/60 px-4 py-3">
      <p class="text-[13px] font-bold text-brand-600">כדי להגיע ליעד שלך</p>
      <p class="font-display text-[24px] font-extrabold md:text-[28px]">${fmt(be.goal)} <span class="text-[16px]">בחודש</span></p>
      <p class="text-[13px] text-muted">כך יישארו לך <${NumEdit} value=${goalOf(state)} label="היעד החודשי" onSave=${on.setGoal} class="text-[14px]" /> בחודש</p>
    </div>
    <table class="mt-4 w-full text-[14px]">
      <thead><tr class="text-[12px] font-bold text-muted"><th class="pb-1.5 text-start font-bold">כמה מכירות בחודש</th><th class="pb-1.5 text-center font-bold">לאיזון</th><th class="pb-1.5 text-center font-bold">ליעד</th></tr></thead>
      <tbody>
        ${be.products.map(
          (p) => html`<tr key=${p.id} class="border-t border-line">
            <td class="py-2"><b class="block leading-tight">${p.short}</b><span class="text-[12px] text-muted">${fmt(p.price)}${p.terms === 'monthly' ? ' בחודש' : ''}</span></td>
            <td class="py-2 text-center font-display text-[17px] font-extrabold tabular-nums">${p.cover}</td>
            <td class="py-2 text-center font-display text-[17px] font-extrabold tabular-nums text-brand-600">${p.goal}</td>
          </tr>`,
        )}
      </tbody>
    </table>
    <p class="mt-2 text-[12px] text-muted">המחירים מסל המוצרים. כל מוצר לבד: מספיק אחד מהם.</p>
  <//>`;
}

export function ReadyPanel({ state, on, n }) {
  const items = readiness(state);
  const done = items.filter((x) => x.done).length;
  return html`<${Panel} n=${n} title="הכנה ללקוח הראשון" sub=${done === items.length ? 'העסק מוכן לקבל כסף.' : `${done} מתוך ${items.length} מוכנים`}>
    <ul class="grid gap-2 md:grid-cols-2">
      ${items.map(
        (x) => html`<li key=${x.id} class=${cx('flex min-h-[60px] items-center gap-3 rounded-[14px] px-3 py-2.5', x.done ? 'bg-canvas' : 'bg-white ring-1 ring-line')}>
          <span class=${cx('grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 bg-white', x.done ? 'border-ink' : 'border-line')}>${x.done && html`<${PencilCheck} size=${16} color="#0038b8" weight=${3} />`}</span>
          <span class="min-w-0 flex-1"><b class=${cx('block text-[14px]', x.done && 'text-muted')}>${x.label}</b><span class="block text-[12px] text-muted">${x.text}</span></span>
          ${!x.done && x.action === 'pay' && html`<${Button} variant="mini" class="shrink-0" onClick=${on.pay}>להגדרה<//>`}
          ${!x.done && x.action === 'bank' && html`<${Button} variant="mini" class="shrink-0" onClick=${on.bank}>יש לי<//>`}
        </li>`,
      )}
    </ul>
  <//>`;
}

export function SetupBoard({ state, on }) {
  return html`<div class="flex flex-col gap-4 md:gap-5">
    <${BudgetPanel} state=${state} on=${on} n=${1} />
    <div class="grid gap-4 md:gap-5 lg:grid-cols-2">
      <${RunwayPanel} state=${state} on=${on} n=${2} />
      <${BreakEvenPanel} state=${state} on=${on} n=${3} />
    </div>
    <${ReadyPanel} state=${state} on=${on} n=${4} />
  </div>`;
}

// ---------- stage 2: first clients ----------

function MonthPanel({ state, on, n }) {
  const m = monthSummary(state);
  const be = breakEven(state);
  const setupThisMonth = (state.setup || []).filter((x) => x.spentOn && x.spentOn.slice(0, 7) === TODAY.slice(0, 7)).reduce((t, x) => t + x.spent, 0);
  const out = m.out + setupThisMonth;
  const net = m.net - setupThisMonth;
  const covered = m.received >= be.cover;
  return html`<${Panel} n=${n} title=${`החודש שלך: ${monthName(TODAY)}`} sub="כמה נכנס, כמה יצא, וכמה נשאר לך.">
    <${Equation}
      parts=${[
        { label: 'נכנס', value: fmt(m.received), sub: m.pending ? `ועוד ${fmt(m.pending)} ${m.pendingList.some((p) => p.due < TODAY) ? 'שעוד לא התקבלו' : 'שמגיעים החודש'}` : 'כל התשלומים של החודש התקבלו' },
        { op: '−', label: 'יצא', value: fmt(out), sub: `הוצאות ${fmt(m.expenses)}${setupThisMonth ? ` · הקמה ${fmt(setupThisMonth)}` : ''} · למס ${fmt(m.tax)}` },
        { op: '=', label: 'נשאר לך החודש', value: fmt(net), main: true, tone: net < 0 ? 'text-error' : 'text-ink' },
      ]}
    />
    <div class="mt-5">
      <p class="mb-1 text-[14px] font-bold">${covered ? html`<span class="inline-flex items-center gap-1.5 text-money"><${Icon} name="circle-check" size=${17} />ההכנסות כיסו את ההוצאות הקבועות</span>` : `עוד ${fmt(be.cover - m.received)} כדי לכסות את ההוצאות הקבועות`}</p>
      <${Meter} value=${m.received} max=${be.goal} marks=${[{ at: be.cover, label: `איזון ${fmt(be.cover)}` }]} tone=${covered ? 'money' : 'brand'} />
      <p class="-mt-1 text-[13px] text-muted">היעד: להכניס ${fmt(be.goal)} בחודש, כדי שיישארו לך <${NumEdit} value=${goalOf(state)} label="היעד החודשי" onSave=${on.setGoal} class="text-[14px]" />. ${m.received < be.goal ? `עוד ${fmt(be.goal - m.received)}.` : 'היעד הושג.'}</p>
    </div>
  <//>`;
}

// Money clients still owe: late (or due today) first, then the next 30 days.
function Waiting({ state, on, n }) {
  const nx = next30(state);
  const coming = nx.coming.filter((e) => e.kind === 'in');
  const lateSum = sum(nx.late);
  return html`<${Panel} n=${n} title="כסף שמחכה לך" sub="תשלומים מלקוחות. הדחוף ראשון.">
    <div class="flex flex-wrap items-end gap-x-8 gap-y-3">
      ${lateSum > 0 &&
      html`<div>
        <${Label} class="flex items-center gap-1.5 !text-error"><${Icon} name="circle-alert" size=${15} />באיחור או היום<//>
        <${Big} class="mt-1 !text-[32px] md:!text-[38px]">${fmt(lateSum)}<//>
      </div>`}
      <div>
        <${Label}>מגיע ב-30 הימים הקרובים<//>
        <p class=${cx('mt-1 font-display font-extrabold leading-none', lateSum > 0 ? 'text-[24px] md:text-[28px]' : 'text-[32px] md:text-[38px]')}>${fmt(sum(coming))}</p>
      </div>
    </div>
    <ul class="mt-4 flex flex-col gap-2">
      ${nx.late.map(
        (l) => html`<li key=${l.payment.id} class="flex flex-wrap items-center gap-2 rounded-[14px] border border-error/35 bg-error-50/50 p-3">
          <span class="min-w-0 flex-1"><b class="block truncate text-[15px]">${l.label}</b><span class="block text-[12px] font-bold text-error">${l.status === 'late' ? `באיחור ${daysBetween(l.date, TODAY)} ימים · היה אמור להגיע ב-${dm(l.date)}` : 'מגיע היום'}</span></span>
          <span class="font-display text-[17px] font-extrabold tabular-nums">${fmt(l.amount)}</span>
          <span class="flex w-full justify-end gap-1.5 sm:w-auto">
            <${Button} variant="mini" class="!h-10" onClick=${() => on.remind(l.deal, l.payment)}><${Icon} name="message-circle" size=${15} />תזכורת<//>
            <button type="button" onClick=${() => on.paid(l.deal, l.payment)} class="h-10 rounded-lg border border-brand-300 bg-white px-3 text-[13px] font-bold text-brand-600 hover:bg-brand-50 cursor-pointer">התקבל</button>
          </span>
        </li>`,
      )}
      ${coming.map(
        (e, i) => html`<li key=${i} class="flex items-center gap-3 rounded-[14px] bg-canvas px-3 py-2.5">
          <span class="w-12 shrink-0 text-center font-display text-[14px] font-extrabold">${dm(e.date)}</span>
          <span class="min-w-0 flex-1"><b class="block truncate text-[14px]">${e.label}</b><span class="block text-[12px] text-muted">${paymentLabel(e.deal, e.payment)}</span></span>
          <${Amount} n=${e.amount} class="text-[15px]" />
        </li>`,
      )}
      ${!nx.late.length && !coming.length && html`<li class="rounded-[14px] bg-canvas px-3 py-3 text-[14px] text-muted">אין תשלומים שמחכים. כל מה שנקבע התקבל.</li>`}
    </ul>
  <//>`;
}

export function FirstBoard({ state, on, tab, onTab, payRef }) {
  const b = setupSummary(state);
  const list = [
    ['expenses', 'הוצאות קבועות', 'receipt'],
    ...(b.items.length ? [['budget', 'תקציב ההקמה', 'clipboard-list']] : []),
    ['breakeven', 'נקודת האיזון', 'scale'],
  ];
  const t = list.some((x) => x[0] === tab) ? tab : 'expenses';
  return html`<div class="flex flex-col gap-4 md:gap-5">
    <${MonthPanel} state=${state} on=${on} n=${1} />
    <div class="grid gap-4 md:gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <${Waiting} state=${state} on=${on} n=${2} />
      <${RunwayPanel} state=${state} on=${on} n=${3} compact />
    </div>
    <div ref=${payRef} class="scroll-mt-4">
      <${Panel}
        n=${4}
        title="כל התשלומים מלקוחות"
        sub="כל עסקה שנסגרת בלידים מקבלת לוח תשלומים."
        action=${html`<${Button} variant="mini" class="shrink-0" onClick=${on.deal}><${Icon} name="plus" size=${15} />עסקה<//>`}
      >
        <${DealCards} state=${state} onPaid=${on.paid} onRemind=${on.remind} onChat=${on.chat} wide />
        <${OpenDeals} state=${state} />
      <//>
    </div>
    <${Tabs} n=${5} title="ההוצאות והתכנון" list=${list} tab=${t} onTab=${onTab}>
      ${t === 'expenses' && html`<p class="mb-3 text-[14px] text-muted">בממוצע <b class="font-display tabular-nums text-ink">${fmt(breakEven(state).monthly)}</b> בחודש. <${EditHint} /></p><${ExpenseList} state=${state} on=${on} />`}
      ${t === 'budget' && html`<${BudgetPanel} state=${state} on=${on} />`}
      ${t === 'breakeven' && html`<${BreakEvenPanel} state=${state} on=${on} />`}
    <//>
  </div>`;
}

// ---------- stage 3: active business (the full cash flow) ----------

function CashPanel({ state, on, n, insight }) {
  const [asTable, setAsTable] = useState(false);
  const data = series(state, RANGE_END);
  const cash = balanceOn(state, TODAY);
  const m = monthSummary(state);
  const end = data[data.length - 1];
  const low = data.filter((d) => d.date >= TODAY).reduce((a, d) => (d.bal < a.bal ? d : a));
  const under = cash < state.cushion;
  const hasBand = data.some((d) => d.maybe > d.bal);
  return html`<${Panel}
    n=${n}
    title="הקופה"
    sub=${`מה יש היום, ומה צפוי עד סוף ${monthName(RANGE_END)} לפי התשלומים שנקבעו.`}
    action=${html`<button type="button" onClick=${() => setAsTable((v) => !v)} class="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-3 text-[14px] font-bold text-brand-600 hover:bg-brand-50 cursor-pointer"><${Icon} name=${asTable ? 'chart-line' : 'table-2'} size=${16} />${asTable ? 'גרף' : 'טבלה'}</button>`}
  >
    <div class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-[1.3fr_1fr_1fr]">
      <div class="col-span-2 rounded-[14px] bg-brand-100/70 px-4 py-3 ring-2 ring-brand-600/25 sm:col-span-1">
        <p class="text-[13px] font-bold text-brand-600">בקופה היום</p>
        <div class="mt-1"><${NumEdit} value=${cash} label="בקופה היום" onSave=${on.setMoney} class="text-[32px] leading-none md:text-[40px]" /></div>
        <p class="mt-2 flex flex-wrap items-center gap-1.5 text-[13px] text-muted"><${Tag} tone=${under ? 'warn' : 'paid'}><${Icon} name=${under ? 'triangle-alert' : 'check'} size=${13} />${under ? 'מתחת לכרית' : 'מעל הכרית'}<//>מזה ${fmt(m.tax)} בצד למס</p>
      </div>
      <div class="rounded-[14px] bg-canvas px-4 py-3">
        <p class="text-[13px] font-bold text-muted">צפוי ב-${dm(end.date)}</p>
        <p class="mt-1 font-display text-[22px] font-extrabold leading-none md:text-[30px]">${fmt(end.bal)}</p>
        <p class="mt-2 text-[13px] text-muted">${low.date > TODAY && low.bal < cash ? `הכי נמוך: ${fmt(low.bal)} ב-${dm(low.date)}` : 'לא יורד מתחת להיום'}</p>
      </div>
      <div class="rounded-[14px] bg-canvas px-4 py-3">
        <p class="text-[13px] font-bold text-muted">כרית ביטחון</p>
        <div class="mt-1"><${NumEdit} value=${state.cushion} label="כרית ביטחון" onSave=${on.setCushion} class="text-[22px] leading-none md:text-[30px]" /></div>
        <p class="mt-2 text-[13px] text-muted">${under ? html`<b class="text-warn">הקופה כבר מתחתיה היום</b>` : low.bal < state.cushion ? html`<b class="text-warn">צפויה ירידה מתחתיה ב-${dm(data.find((d) => d.date > TODAY && d.bal < state.cushion).date)}</b>` : `הקופה לא יורדת מתחתיה עד ${dm(end.date)}`}</p>
      </div>
    </div>
    ${asTable ? html`<${ChartTable} data=${data} />` : html`<${CashChart} data=${data} cushion=${state.cushion} />`}
    <div class="mt-3"><${ChartLegend} hasBand=${hasBand} /></div>
    ${insight && html`<p class="mt-3 flex items-start gap-2 rounded-xl bg-canvas px-3 py-2 text-[14px] text-ink"><${Icon} name="lightbulb" size=${17} class="mt-0.5 shrink-0 text-brand-600" /><span>${insight}</span></p>`}
  <//>`;
}

function ActiveMonth({ state, on, n }) {
  const m = monthSummary(state);
  const goal = goalOf(state);
  return html`<${Panel} n=${n} title=${`החודש: ${monthName(TODAY)}`} sub="רווח נקי = מה שנכנס, פחות ההוצאות וההפרשה למס.">
    <${Equation}
      parts=${[
        { label: 'נכנס', value: fmt(m.received), sub: m.pending ? `ועוד ${fmt(m.pending)} ${m.pendingList.some((p) => p.due < TODAY) ? 'שעוד לא התקבלו' : 'שמגיעים החודש'}` : 'הכול התקבל' },
        { op: '−', label: 'הוצאות', value: fmt(m.expenses) },
        { op: '−', label: 'למס', value: fmt(m.tax), sub: html`<${NumEdit} value=${state.taxPct} unit="%" label="אחוז בצד למס" onSave=${on.setTax} class="text-[12px]" /> מכל הכנסה` },
        { op: '=', label: 'רווח נקי', value: fmt(m.net), main: true, tone: m.net < 0 ? 'text-error' : 'text-ink' },
      ]}
    />
    <div class="mt-5">
      <${Meter} value=${Math.max(0, m.net)} max=${goal} tone=${m.gap ? 'brand' : 'money'} />
      <p class="-mt-1 text-[13px] text-muted">היעד: <${NumEdit} value=${goal} label="היעד החודשי" onSave=${on.setGoal} class="text-[14px]" /> רווח נקי בחודש. ${m.gap ? html`<b class="text-ink">חסרים ${fmt(m.gap)}.</b>` : html`<b class="text-money">היעד הושג.</b>`}</p>
    </div>
  <//>`;
}

function Next30({ state, on, n }) {
  const nx = next30(state);
  const endBal = balanceOn(state, addDays(TODAY, 30));
  const [all, setAll] = useState(false);
  const SHOW = 5;
  const coming = all ? nx.coming : nx.coming.slice(0, SHOW);
  return html`<${Panel} n=${n} title="ב-30 הימים הקרובים" sub=${`עד ${dm(addDays(TODAY, 30))}. מה שבאיחור, ראשון.`}>
    ${nx.late.length > 0 &&
    html`<ul class="mb-2 flex flex-col gap-2">
      ${nx.late.map(
        (l) => html`<li key=${l.payment.id} class=${cx('flex flex-wrap items-center gap-2 rounded-xl border p-2.5', l.status === 'late' ? 'border-error/35 bg-error-50/50' : 'border-brand-300 bg-brand-50/60')}>
          <span class="min-w-0 flex-1"><b class="block truncate text-[14px]">${l.label}</b><span class=${cx('block text-[12px] font-bold', l.status === 'late' ? 'text-error' : 'text-brand-600')}>${l.status === 'late' ? `באיחור ${daysBetween(l.date, TODAY)} ימים` : 'מגיע היום'}</span></span>
          <${Amount} n=${l.amount} class="text-[15px]" />
          <span class="flex gap-1">
            <button type="button" title="תזכורת ב-WhatsApp" aria-label="תזכורת ב-WhatsApp" onClick=${() => on.remind(l.deal, l.payment)} class="inline-flex h-9 w-9 items-center justify-center rounded-lg text-brand-600 hover:bg-brand-50 cursor-pointer"><${Icon} name="message-circle" size=${17} /></button>
            <${Button} variant="mini" class="!h-9" onClick=${() => on.paid(l.deal, l.payment)}><${Icon} name="check" size=${15} />התקבל<//>
          </span>
        </li>`,
      )}
    </ul>`}
    <ul class="flex flex-col divide-y divide-line">
      ${coming.length === 0 && html`<li class="py-3 text-[14px] text-muted">אין תשלומים או הוצאות בחודש הקרוב.</li>`}
      ${coming.map(
        (e, i) => html`<li key=${i} class="flex items-center gap-2 py-2">
          <span class="w-11 shrink-0 text-center font-display text-[14px] font-extrabold text-ink">${dm(e.date)}</span>
          <span class="min-w-0 flex-1"><b class="block truncate text-[14px] font-bold">${e.label}</b><span class="block text-[12px] text-muted">${e.kind === 'in' ? paymentLabel(e.deal, e.payment) : freqText(e.expense)}</span></span>
          <${Amount} n=${e.amount} class="text-[15px]" />
        </li>`,
      )}
    </ul>
    ${nx.coming.length > SHOW &&
    html`<button type="button" onClick=${() => setAll((a) => !a)} class="mt-1 flex h-10 items-center justify-center gap-1 rounded-xl text-[14px] font-bold text-brand-600 hover:bg-brand-50 cursor-pointer">
      <${Icon} name=${all ? 'chevron-up' : 'chevron-down'} size=${16} />${all ? 'פחות' : `עוד ${nx.coming.length - SHOW}`}
    </button>`}
    ${nx.maybe.length > 0 &&
    html`<p class="mt-2 rounded-xl border border-dashed border-brand-300 bg-brand-50/60 px-3 py-2 text-[13px] text-ink">
      <b class="text-brand-600">אולי ייכנס, לא נספר בקופה:</b> ${nx.maybe.map((x) => `${x.deal.client} ${fmt(x.amount)} (${x.deal.chance}%)`).join(' · ')}
    </p>`}
    <p class="mt-3 flex items-center justify-between border-t-2 border-ink/60 pt-2.5 text-[14px] font-extrabold">
      <span>צפוי בקופה ב-${dm(addDays(TODAY, 30))}</span>
      <span class="font-display text-[18px] tabular-nums">${fmt(endBal)}</span>
    </p>
  <//>`;
}

function WeekTable({ state }) {
  const ws = weeks(state);
  return html`<div>
    <div class="thin-scroll -mx-1 overflow-x-auto px-1">
      <table class="w-full min-w-[520px] border-separate border-spacing-0 text-[14px]">
        <thead>
          <tr class="text-[12px] font-bold text-muted">
            <th class="sticky right-0 bg-surface py-2 pe-3 text-start"></th>
            ${ws.map((w) => html`<th key=${w.start} class=${cx('px-2 py-2 text-center', w.current && 'rounded-t-xl bg-brand-100 text-brand-600')}>${w.current ? 'השבוע' : `${dm(w.start)}–${dm(w.end)}`}</th>`)}
            <th class="px-2 py-2 text-center text-ink">היעד</th>
          </tr>
        </thead>
        <tbody>
          ${WEEK_ROWS.map(
            (r) => html`<tr key=${r.id}>
              <th class="sticky right-0 border-t border-line bg-surface py-2.5 pe-3 text-start font-bold">${r.label}</th>
              ${ws.map((w) => {
                const v = w[r.id];
                const hit = r.target != null && v >= r.target;
                return html`<td key=${w.start} class=${cx('border-t border-line px-2 py-2.5 text-center tabular-nums', w.current && 'bg-brand-100/60')}>
                  <span class=${cx('inline-flex items-center gap-1 font-display font-extrabold', r.money && v > 0 && r.id === 'income' ? 'text-money' : hit ? 'text-ink' : 'text-muted')}>
                    ${r.money ? fmt(v) : v}${hit && html`<${PencilCheck} size=${15} color="#0038b8" weight=${3} />`}
                  </span>
                </td>`;
              })}
              <td class="border-t border-line px-2 py-2.5 text-center font-display font-extrabold tabular-nums text-ink">${r.target == null ? '—' : r.money ? fmt(r.target) : r.target}</td>
            </tr>`,
          )}
        </tbody>
      </table>
    </div>
    <p class="mt-3 text-[12px] text-muted">לידים, שיחות וסגירות מהלידים. הכנסה מהתשלומים שסומנו "התקבל". הוצאות שיווק מההוצאות בקטגוריית שיווק. היעד מ"העסק במספרים".</p>
  </div>`;
}

export function ActiveBoard({ state, on, tab, onTab, insight, tabsRef }) {
  const total = state.expenses.reduce((s, x) => s + monthlyCost(x), 0);
  const list = [
    ['week', 'שבוע במספרים', 'table-2'],
    ['payments', 'תשלומים מלקוחות', 'hand-coins'],
    ['expenses', 'הוצאות קבועות', 'receipt'],
  ];
  const t = list.some((x) => x[0] === tab) ? tab : 'week';
  return html`<div class="flex flex-col gap-4 md:gap-5">
    <${CashPanel} state=${state} on=${on} n=${1} insight=${insight} />
    <${ActiveMonth} state=${state} on=${on} n=${2} />
    <div class="grid gap-4 md:gap-5 lg:grid-cols-[400px_minmax(0,1fr)]">
      <${Next30} state=${state} on=${on} n=${3} />
      <div ref=${tabsRef} class="min-w-0 scroll-mt-4">
        <${Tabs} n=${4} title="הפירוט" list=${list} tab=${t} onTab=${onTab}>
          ${t === 'week' && html`<${WeekTable} state=${state} />`}
          ${t === 'payments' &&
          html`<div>
            <div class="mb-3 flex items-center justify-between gap-2">
              <p class="text-[14px] text-muted">כל עסקה שנסגרת בלידים מקבלת לוח תשלומים.</p>
              <${Button} variant="mini" onClick=${on.deal}><${Icon} name="plus" size=${15} />עסקה<//>
            </div>
            <${DealCards} state=${state} onPaid=${on.paid} onRemind=${on.remind} onChat=${on.chat} />
            <${OpenDeals} state=${state} />
          </div>`}
          ${t === 'expenses' &&
          html`<div>
            <p class="mb-3 text-[14px] text-muted">בממוצע <b class="font-display tabular-nums text-ink">${fmt(total)}</b> בחודש. יורדות מהקופה ביום החיוב. <${EditHint} /></p>
            <${ExpenseList} state=${state} on=${on} />
          </div>`}
        <//>
      </div>
    </div>
  </div>`;
}
