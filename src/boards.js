// The three boards of the finance center, one per stage of the business:
//   1. setup  - the setup budget against what was paid, how long the money lasts,
//               the break-even point, and getting ready for the first client
//   2. first  - payments from the first clients, what is left this month, break-even
//   3. active - the full cash flow (the till, the forecast, reminders, the week)
// Each board shows only what matters in its stage. The page and the "next step" note
// above it are in main.js.
import { html, useState, Icon, PencilCheck, cx } from './lib.js';
import { Button } from './components.js';
import { CashChart, ChartLegend } from './chart.js';
import { Panel, Tag, Amount, Meter } from './ui.js';
import { TODAY, GOAL, CATEGORIES, ENTITIES } from './data.js';
import {
  addDays, addMonths, dm, monthName, monthEnd, daysBetween, toDate, fmt, signed,
  series, balanceOn, monthSummary, next30, weeks, WEEK_ROWS,
  dealPayments, paymentStatus, paymentLabel, productOf, termsOf, freqText, monthlyCost, expenseDates,
  setupSummary, runway, breakEven, readiness,
} from './finance.js';

const RANGE_END = '2026-12-31';
const monthYear = (s) => `${monthName(s)} ${toDate(s).getFullYear()}`;

// ---------- shared lists ----------

function Stat({ label, icon, value, tone, sub, children }) {
  return html`<section class="fb-panel flex min-w-0 flex-col !p-3.5 md:!p-5">
    <p class="flex items-center gap-2 text-[13px] font-bold text-muted md:text-[14px]"><span class="fb-chip-ic h-7 w-7 md:h-8 md:w-8"><${Icon} name=${icon} size=${16} /></span><span class="truncate">${label}</span></p>
    <p class=${cx('mt-2 font-display text-[24px] font-extrabold leading-none tabular-nums md:text-[30px]', tone)}>${value}</p>
    ${sub && html`<p class="mt-1.5 text-[12px] font-semibold leading-snug text-muted md:text-[13px]">${sub}</p>`}
    ${children}
  </section>`;
}

function DealCards({ state, onPaid, onRemind, wide }) {
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

function ExpenseList({ state, onEdit }) {
  const next = (x) => expenseDates(x, addDays(TODAY, 1), addDays(TODAY, 400))[0];
  return html`<ul class="flex flex-col divide-y divide-line rounded-[14px] border border-line bg-white px-3.5">
    ${state.expenses.map(
      (x) => html`<li key=${x.id}>
        <button type="button" onClick=${() => onEdit(x)} class="group flex min-h-[52px] w-full items-center gap-3 py-2.5 text-start cursor-pointer">
          <span class="fb-chip-ic h-8 w-8 shrink-0"><${Icon} name=${CATEGORIES[x.category].icon} size=${16} /></span>
          <span class="min-w-0 flex-1">
            <b class="block truncate text-[14px]">${x.name}</b>
            <span class="block text-[12px] text-muted">${freqText(x)}${next(x) ? ` · הבא ${dm(next(x))}` : ''}</span>
          </span>
          <span class="font-display text-[15px] font-extrabold tabular-nums">${fmt(x.amount)}</span>
          <${Icon} name="pencil" size=${15} class="text-faint group-hover:text-brand-600" />
        </button>
      </li>`,
    )}
  </ul>`;
}

function Tabs({ list, tab, onTab, children }) {
  return html`<section class="fb-panel !p-4 md:!p-5">
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

function itemState(x) {
  if (x.done) return x.spent > x.planned ? ['warn', `שולם · ${fmt(x.spent - x.planned)} מעל`] : ['paid', 'שולם'];
  if (x.spent > 0) return ['due', `שולמו ${fmt(x.spent)}`];
  return ['muted', 'עוד לא'];
}

export function BudgetPanel({ state, onItem, onAdd }) {
  const b = setupSummary(state);
  return html`<${Panel}
    title="תקציב ההקמה"
    icon="clipboard-list"
    sub=${`מ"העסק במספרים". תכננת ${fmt(b.planned)}.`}
    action=${html`<${Button} variant="mini" class="shrink-0" onClick=${onAdd}><${Icon} name="plus" size=${15} />פריט<//>`}
  >
    <div class="grid grid-cols-3 gap-2 rounded-[14px] bg-canvas p-3 text-center">
      <p><span class="block text-[12px] font-bold text-muted">שילמת</span><b class="font-display text-[18px] tabular-nums md:text-[20px]">${fmt(b.spent)}</b></p>
      <p><span class="block text-[12px] font-bold text-muted">נשאר לשלם</span><b class="font-display text-[18px] tabular-nums md:text-[20px]">${fmt(b.remaining)}</b></p>
      <p><span class="block text-[12px] font-bold text-muted">מעל התכנון</span><b class=${cx('font-display text-[18px] tabular-nums md:text-[20px]', b.over ? 'text-warn' : 'text-faint')}>${fmt(b.over)}</b></p>
    </div>
    <ul class="mt-2 flex flex-col divide-y divide-line">
      ${b.items.map((x) => {
        const [tone, label] = itemState(x);
        const pct = Math.min(100, (x.spent / x.planned) * 100);
        return html`<li key=${x.id}>
          <button type="button" onClick=${() => onItem(x)} class="group flex min-h-[56px] w-full items-center gap-3 py-2.5 text-start cursor-pointer">
            <span class="fb-chip-ic h-9 w-9 shrink-0"><${Icon} name=${x.icon} size=${17} /></span>
            <span class="min-w-0 flex-1">
              <span class="flex items-center justify-between gap-2">
                <b class="truncate text-[14px]">${x.name}</b>
                <span class="font-display text-[14px] font-extrabold tabular-nums text-muted">${fmt(x.planned)}</span>
              </span>
              <span class="mt-1.5 flex items-center gap-2">
                <span class="h-1.5 flex-1 overflow-hidden rounded-full bg-line"><span class=${cx('block h-full rounded-full', tone === 'warn' ? 'bg-warn' : x.done ? 'bg-ink' : 'bg-brand-600')} style=${{ width: `${pct}%` }}></span></span>
                <${Tag} tone=${tone}>${label}<//>
              </span>
            </span>
          </button>
        </li>`;
      })}
    </ul>
  <//>`;
}

export function RunwayPanel({ state, onMoney, onExpense, compact }) {
  const r = runway(state);
  const [open, setOpen] = useState(false);
  // One box per month, from this month to the last month the money lasts (up to a year).
  const months = [];
  if (r.until) for (let m = `${TODAY.slice(0, 7)}-01`; m <= r.until && months.length < 12; m = addMonths(m, 1, 1)) months.push(m);
  return html`<${Panel} title="כמה זמן הכסף מחזיק" icon="hourglass">
    ${r.until
      ? html`<p class="font-display text-[26px] font-extrabold leading-tight md:text-[32px]">עד <span class="fb-urgent">${monthYear(r.until)}</span></p>
          <p class="mt-1 text-[14px] text-muted">בערך ${Math.max(0, Math.floor(r.months))} חודשים מהיום, ${state.deals.length ? 'לפי התשלומים שנקבעו, בלי לקוחות חדשים' : 'אם לא ייכנס כסף מלקוחות'}.</p>
          <ol class="mt-3 flex gap-1" aria-hidden="true">
            ${months.map(
              (m, i) => html`<li key=${m} class="flex min-w-0 flex-1 flex-col items-center gap-1">
                <span class=${cx('h-7 w-full rounded-md', i === months.length - 1 ? 'bg-warn/70' : i === 0 ? 'bg-brand-600' : 'bg-brand-300')}></span>
                <span class="truncate text-[11px] font-bold text-muted">${monthName(m).slice(0, 3)}</span>
              </li>`,
            )}
          </ol>`
      : html`<p class="font-display text-[22px] font-extrabold leading-tight text-money md:text-[26px]">ההכנסות מכסות את ההוצאות</p>
          <p class="mt-1 text-[14px] text-muted">לפי התשלומים שנקבעו, הכסף של העסק לא יורד מתחת לאפס בשלוש השנים הקרובות.</p>`}
    ${!compact &&
    html`<dl class="mt-4 flex flex-col divide-y divide-line rounded-[14px] border border-line bg-white px-3.5 text-[14px]">
      <div class="flex items-center gap-2 py-2.5">
        <dt class="flex-1 font-bold">יש לעסק היום</dt>
        <dd class="font-display font-extrabold tabular-nums">${fmt(r.now)}</dd>
        <button type="button" onClick=${onMoney} class="h-9 rounded-lg px-2 text-[13px] font-bold text-brand-600 hover:bg-brand-50 cursor-pointer">עדכון</button>
      </div>
      ${r.left > 0 &&
      html`<div class="flex items-center gap-2 py-2.5">
        <dt class="flex-1 font-bold">נשאר לשלם על ההקמה</dt>
        <dd class="font-display font-extrabold tabular-nums">${signed(-r.left)}</dd>
      </div>`}
      <div class="py-2.5">
        <button type="button" onClick=${() => setOpen((o) => !o)} aria-expanded=${open} class="flex w-full items-center gap-2 text-start cursor-pointer">
          <dt class="flex flex-1 items-center gap-1 font-bold">הוצאות קבועות בחודש <${Icon} name=${open ? 'chevron-up' : 'chevron-down'} size=${15} class="text-brand-600" /></dt>
          <dd class="font-display font-extrabold tabular-nums">${fmt(r.monthly)}</dd>
        </button>
        ${open && html`<div class="mt-2"><${ExpenseList} state=${state} onEdit=${onExpense} /></div>`}
      </div>
    </dl>`}
  <//>`;
}

export function BreakEvenPanel({ state }) {
  const be = breakEven(state);
  return html`<${Panel} title="נקודת האיזון" icon="scale" sub=${`כמה צריך להכניס בחודש. כולל ${state.taxPct}% בצד למס.`}>
    <div class="grid grid-cols-2 gap-2">
      <div class="rounded-[14px] bg-canvas p-3">
        <p class="text-[12px] font-bold text-muted">לכסות את ההוצאות</p>
        <b class="font-display text-[22px] tabular-nums">${fmt(be.cover)}</b>
        <p class="text-[12px] text-muted">הוצאות ${fmt(be.monthly)} בחודש</p>
      </div>
      <div class="rounded-[14px] bg-brand-100/70 p-3">
        <p class="text-[12px] font-bold text-brand-600">להגיע ליעד</p>
        <b class="font-display text-[22px] tabular-nums text-brand-600">${fmt(be.goal)}</b>
        <p class="text-[12px] text-muted">כדי שיישארו לך ${fmt(GOAL)}</p>
      </div>
    </div>
    <table class="mt-3 w-full text-[14px]">
      <thead><tr class="text-[12px] font-bold text-muted"><th class="pb-1 text-start font-bold">מכירות בחודש</th><th class="pb-1 text-center font-bold">לכיסוי</th><th class="pb-1 text-center font-bold">ליעד</th></tr></thead>
      <tbody>
        ${be.products.map(
          (p) => html`<tr key=${p.id} class="border-t border-line">
            <td class="py-2"><b class="block leading-tight">${p.short}</b><span class="text-[12px] text-muted">${fmt(p.price)}${p.terms === 'monthly' ? ' בחודש' : ''}</span></td>
            <td class="py-2 text-center font-display text-[16px] font-extrabold tabular-nums">${p.cover}</td>
            <td class="py-2 text-center font-display text-[16px] font-extrabold tabular-nums text-brand-600">${p.goal}</td>
          </tr>`,
        )}
      </tbody>
    </table>
    <p class="mt-2 text-[12px] text-muted">היעד מ"העסק במספרים". המכירות מחושבות לפי המחיר בסל, כל מוצר לבד.</p>
  <//>`;
}

export function ReadyPanel({ state, onPay, onBank }) {
  const items = readiness(state);
  const done = items.filter((x) => x.done).length;
  return html`<${Panel} title="הכנה ללקוח הראשון" icon="rocket" sub=${done === items.length ? 'העסק מוכן לקבל כסף.' : `${done} מתוך ${items.length} מוכנים`}>
    <ul class="flex flex-col gap-2">
      ${items.map(
        (x) => html`<li key=${x.id} class=${cx('flex min-h-[56px] items-center gap-3 rounded-[14px] px-3 py-2.5', x.done ? 'bg-canvas' : 'bg-white ring-1 ring-line')}>
          <span class=${cx('grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 bg-white', x.done ? 'border-ink' : 'border-line')}>${x.done && html`<${PencilCheck} size=${16} color="#0038b8" weight=${3} />`}</span>
          <span class="min-w-0 flex-1"><b class=${cx('block text-[14px]', x.done && 'text-muted')}>${x.label}</b><span class="block text-[12px] text-muted">${x.text}</span></span>
          ${!x.done && x.action === 'pay' && html`<${Button} variant="mini" class="shrink-0" onClick=${onPay}>להגדרה<//>`}
          ${!x.done && x.action === 'bank' && html`<${Button} variant="mini" class="shrink-0" onClick=${onBank}>יש לי<//>`}
        </li>`,
      )}
    </ul>
  <//>`;
}

export function SetupBoard({ state, on }) {
  return html`<div class="grid gap-4 md:gap-5 lg:grid-cols-2">
    <${BudgetPanel} state=${state} onItem=${on.item} onAdd=${on.addItem} />
    <${RunwayPanel} state=${state} onMoney=${on.balance} onExpense=${on.expense} />
    <${BreakEvenPanel} state=${state} />
    <${ReadyPanel} state=${state} onPay=${on.pay} onBank=${on.bank} />
  </div>`;
}

// ---------- stage 2: first clients ----------

function Coming({ state }) {
  const n = next30(state);
  const items = n.coming.filter((e) => e.kind === 'in');
  return html`<${Panel} title="מגיע מלקוחות ב-30 הימים הקרובים" icon="calendar-clock">
    ${items.length === 0
      ? html`<p class="text-[14px] text-muted">אין תשלומים שנקבעו בחודש הקרוב.</p>`
      : html`<ul class="flex flex-col divide-y divide-line">
          ${items.map(
            (e, i) => html`<li key=${i} class="flex items-center gap-2 py-2">
              <span class="w-11 shrink-0 text-center font-display text-[14px] font-extrabold">${dm(e.date)}</span>
              <span class="min-w-0 flex-1"><b class="block truncate text-[14px]">${e.label}</b><span class="block text-[12px] text-muted">${paymentLabel(e.deal, e.payment)}</span></span>
              <${Amount} n=${e.amount} class="text-[15px]" />
            </li>`,
          )}
        </ul>`}
  <//>`;
}

export function FirstBoard({ state, on, tab, onTab, payRef }) {
  const m = monthSummary(state);
  const be = breakEven(state);
  const setupThisMonth = (state.setup || []).filter((x) => x.spentOn && x.spentOn.slice(0, 7) === TODAY.slice(0, 7)).reduce((t, x) => t + x.spent, 0);
  const out = m.out + setupThisMonth;
  const net = m.net - setupThisMonth;
  const covered = m.received >= be.cover;
  const b = setupSummary(state);
  const list = [
    ['expenses', 'הוצאות קבועות', 'receipt'],
    ...(b.remaining > 0 || b.items.length ? [['budget', 'תקציב ההקמה', 'clipboard-list']] : []),
    ['breakeven', 'נקודת האיזון', 'scale'],
  ];
  return html`<div class="flex flex-col gap-4 md:gap-5">
    <div class="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3">
      <${Stat} label=${`נכנס ב${monthName(TODAY)}`} icon="arrow-down-left" value=${fmt(m.received)} tone="text-money" sub=${m.pending ? `ועוד ${fmt(m.pending)} ${m.pendingList.some((p) => p.due < TODAY) ? 'שעוד לא התקבלו' : 'שמגיעים החודש'}` : 'כל התשלומים של החודש התקבלו'} />
      <${Stat} label=${`יוצא ב${monthName(TODAY)}`} icon="arrow-up-right" value=${fmt(out)} sub=${`הוצאות ${fmt(m.expenses)}${setupThisMonth ? ` · הקמה ${fmt(setupThisMonth)}` : ''} · למס ${fmt(m.tax)}`} />
      <div class="col-span-2 lg:col-span-1">
        <${Stat} label="נשאר לך החודש" icon="piggy-bank" value=${fmt(net)} tone=${net >= 0 ? 'text-money' : 'text-error'}>
          <div class="mt-2"><${Meter} value=${m.received} max=${be.goal} marks=${[{ at: be.cover, label: 'איזון' }]} tone=${covered ? 'money' : 'brand'} /></div>
          <p class="-mt-1 text-[12px] font-semibold text-muted md:text-[13px]">${covered ? html`<b class="text-money">ההכנסות כיסו את ההוצאות הקבועות.</b> עד היעד: עוד ${fmt(be.goal - m.received)}` : `עוד ${fmt(be.cover - m.received)} כדי לכסות את ההוצאות הקבועות`}</p>
        <//>
      </div>
    </div>

    <div ref=${payRef} class="grid scroll-mt-4 gap-4 md:gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <${Panel}
        title="תשלומים מלקוחות"
        icon="hand-coins"
        sub="כל עסקה שנסגרת בלידים מקבלת לוח תשלומים."
        action=${html`<${Button} variant="mini" class="shrink-0" onClick=${on.deal}><${Icon} name="plus" size=${15} />עסקה<//>`}
      >
        <${DealCards} state=${state} onPaid=${on.paid} onRemind=${on.remind} />
        <${OpenDeals} state=${state} />
      <//>
      <div class="flex flex-col gap-4 md:gap-5">
        <${Coming} state=${state} />
        <${RunwayPanel} state=${state} compact />
      </div>
    </div>

    <${Tabs} list=${list} tab=${list.some((t) => t[0] === tab) ? tab : 'expenses'} onTab=${onTab}>
      ${(tab === 'expenses' || !list.some((t) => t[0] === tab)) &&
      html`<div>
        <div class="mb-3 flex items-center justify-between gap-2">
          <p class="text-[14px] text-muted">בממוצע <b class="font-display tabular-nums text-ink">${fmt(be.monthly)}</b> בחודש.</p>
          <${Button} variant="mini" onClick=${() => on.expense()}><${Icon} name="plus" size=${15} />הוצאה<//>
        </div>
        <${ExpenseList} state=${state} onEdit=${on.expense} />
      </div>`}
      ${tab === 'budget' && html`<${BudgetPanel} state=${state} onItem=${on.item} onAdd=${on.addItem} />`}
      ${tab === 'breakeven' && html`<${BreakEvenPanel} state=${state} />`}
    <//>
  </div>`;
}

// ---------- stage 3: active business (the full cash flow) ----------

function Kpis({ state, onBalance }) {
  const m = monthSummary(state);
  const cash = balanceOn(state, TODAY);
  const low = cash < state.cushion;
  const pct = Math.max(0, Math.min(100, (m.net / GOAL) * 100));
  return html`<div class="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
    <${Stat} label="בקופה היום" icon="landmark" value=${fmt(cash)} tone=${low ? 'text-warn' : 'text-ink'}
      sub=${html`${low ? html`<b class="text-warn">מתחת לכרית.</b> ` : ''}${fmt(m.tax)} בצד למס · <button type="button" onClick=${onBalance} class="font-bold text-brand-600 hover:underline cursor-pointer">עדכון</button>`} />
    <${Stat} label=${`נכנס ב${monthName(TODAY)}`} icon="arrow-down-left" value=${fmt(m.received)} tone="text-money"
      sub=${m.pending ? `ועוד ${fmt(m.pending)} ${m.pendingList.some((p) => p.due < TODAY) ? 'שעוד לא התקבלו' : 'שמגיעים החודש'}` : 'כל התשלומים של החודש התקבלו'} />
    <${Stat} label=${`יוצא ב${monthName(TODAY)}`} icon="arrow-up-right" value=${fmt(m.out)} sub=${`הוצאות ${fmt(m.expenses)} · למס ${fmt(m.tax)}`} />
    <${Stat} label="רווח נקי החודש" icon="target" value=${fmt(m.net)} tone=${m.net >= 0 ? 'text-money' : 'text-error'}>
      <div class="mt-2 h-2 overflow-hidden rounded-full bg-line" aria-hidden="true"><div class="h-full rounded-full bg-brand-600 transition-all duration-500" style=${{ width: `${pct}%` }}></div></div>
      <p class="mt-1.5 text-[12px] font-semibold text-muted md:text-[13px]">${m.gap ? `מתוך ${fmt(GOAL)} · חסרים ${fmt(m.gap)}` : `היעד של ${fmt(GOAL)} הושג`}</p>
    <//>
  </div>`;
}

function Next30({ state, onPaid, onRemind }) {
  const n = next30(state);
  const end = balanceOn(state, addDays(TODAY, 30));
  const [all, setAll] = useState(false);
  const SHOW = 5;
  const coming = all ? n.coming : n.coming.slice(0, SHOW);
  return html`<section class="fb-panel flex min-h-0 flex-col !p-4 md:!p-5">
    <div class="mb-2 flex items-baseline justify-between gap-2">
      <h2 class="fb-h3">ב-30 הימים הקרובים</h2>
      <span class="text-[12px] font-semibold text-muted">עד ${dm(addDays(TODAY, 30))}</span>
    </div>
    ${n.late.length > 0 &&
    html`<ul class="mb-2 flex flex-col gap-2">
      ${n.late.map(
        (l) => html`<li key=${l.payment.id} class=${cx('flex items-center gap-2 rounded-xl border p-2.5', l.status === 'late' ? 'border-error/35 bg-error-50/50' : 'border-brand-300 bg-brand-50/60')}>
          <span class="min-w-0 flex-1"><b class="block truncate text-[14px]">${l.label}</b><span class=${cx('block text-[12px] font-bold', l.status === 'late' ? 'text-error' : 'text-brand-600')}>${l.status === 'late' ? `באיחור ${daysBetween(l.date, TODAY)} ימים` : 'מגיע היום'}</span></span>
          <${Amount} n=${l.amount} class="text-[15px]" />
          <${Button} variant="mini" class="!h-9" onClick=${() => onPaid(l.deal, l.payment)}><${Icon} name="check" size=${15} />התקבל<//>
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
    ${n.coming.length > SHOW &&
    html`<button type="button" onClick=${() => setAll((a) => !a)} class="mt-1 flex h-10 items-center justify-center gap-1 rounded-xl text-[14px] font-bold text-brand-600 hover:bg-brand-50 cursor-pointer">
      <${Icon} name=${all ? 'chevron-up' : 'chevron-down'} size=${16} />${all ? 'פחות' : `עוד ${n.coming.length - SHOW}`}
    </button>`}
    ${n.maybe.length > 0 &&
    html`<p class="mt-2 rounded-xl border border-dashed border-brand-300 bg-brand-50/60 px-3 py-2 text-[13px] text-ink">
      <b class="text-brand-600">אולי ייכנס, לא נספר בקופה:</b> ${n.maybe.map((m) => `${m.deal.client} ${fmt(m.amount)} (${m.deal.chance}%)`).join(' · ')}
    </p>`}
    <p class="mt-3 flex items-center justify-between border-t-2 border-dashed border-line pt-2.5 text-[14px] font-bold">
      <span>צפוי בקופה ב-${dm(addDays(TODAY, 30))}</span>
      <span class="font-display text-[18px] font-extrabold tabular-nums">${fmt(end)}</span>
    </p>
  </section>`;
}

function ChartPanel({ state, insight }) {
  const data = series(state, RANGE_END);
  const hasBand = data.some((d) => d.maybe > d.bal);
  return html`<section class="fb-panel flex min-w-0 flex-col !p-4 md:!p-5">
    <div class="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h2 class="fb-h3">הקופה עד סוף ${monthName(RANGE_END)}</h2>
      <${ChartLegend} hasBand=${hasBand} />
    </div>
    <${CashChart} data=${data} cushion=${state.cushion} compact=${window.innerWidth < 768} />
    ${insight && html`<p class="mt-2 flex items-start gap-2 rounded-xl bg-canvas px-3 py-2 text-[14px] text-ink"><${Icon} name="lightbulb" size=${17} class="mt-0.5 text-brand-600" /><span>${insight}</span></p>`}
  </section>`;
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
    <${Kpis} state=${state} onBalance=${on.balance} />
    <div class="grid gap-4 md:gap-5 lg:grid-cols-[minmax(0,1fr)_370px]">
      <${ChartPanel} state=${state} insight=${insight} />
      <${Next30} state=${state} onPaid=${on.paid} onRemind=${on.remind} />
    </div>
    <div ref=${tabsRef} class="scroll-mt-4">
      <${Tabs} list=${list} tab=${t} onTab=${onTab}>
        ${t === 'week' && html`<${WeekTable} state=${state} />`}
        ${t === 'payments' &&
        html`<div>
          <div class="mb-3 flex items-center justify-between gap-2">
            <p class="text-[14px] text-muted">כל עסקה שנסגרת בלידים מקבלת לוח תשלומים.</p>
            <${Button} variant="mini" onClick=${on.deal}><${Icon} name="plus" size=${15} />עסקה<//>
          </div>
          <${DealCards} state=${state} onPaid=${on.paid} onRemind=${on.remind} wide />
          <${OpenDeals} state=${state} />
        </div>`}
        ${t === 'expenses' &&
        html`<div>
          <div class="mb-3 flex items-center justify-between gap-2">
            <p class="text-[14px] text-muted">בממוצע <b class="font-display tabular-nums text-ink">${fmt(total)}</b> בחודש. יורדות מהקופה ביום החיוב.</p>
            <${Button} variant="mini" onClick=${() => on.expense()}><${Icon} name="plus" size=${15} />הוצאה<//>
          </div>
          <${ExpenseList} state=${state} onEdit=${on.expense} />
          <div class="mt-3 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick=${on.settings} class="rounded-[14px] border border-line bg-white p-3 text-start hover:border-brand-300 cursor-pointer">
              <span class="text-[12px] font-bold text-muted">הפרשה למס</span>
              <b class="block text-[15px]">${state.taxPct}% מכל הכנסה · ${ENTITIES[state.entity].label}</b>
            </button>
            <button type="button" onClick=${on.settings} class="rounded-[14px] border border-line bg-white p-3 text-start hover:border-brand-300 cursor-pointer">
              <span class="text-[12px] font-bold text-muted">כרית ביטחון</span>
              <b class="block text-[15px]">${fmt(state.cushion)}</b>
            </button>
          </div>
        </div>`}
      <//>
    </div>
  </div>`;
}
