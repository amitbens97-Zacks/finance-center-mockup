// "המרכז הפיננסי": the money of the business, live. It answers four questions on one
// screen: how much is in the till now, what comes in and goes out this month, what is
// due in the coming weeks, and how the till will look next month. Below: the week in
// numbers, the payments from clients and the fixed expenses. The shark only warns on
// a business event, with one action.
import { html, render, useState, useEffect, useRef, Icon, PencilCheck, cx } from './lib.js';
import { Button, Toast, Logo, Mark, Note, PartnerBubble, SharkAvatar } from './components.js';
import { DevPanel } from './devnotes.js';
import { CashChart, ChartLegend } from './chart.js';
import { TODAY, USER, PARTNER, GOAL, PRODUCTS, TERMS, CATEGORIES, FREQS, ENTITIES, SCENARIOS, DEFAULT_SCENARIO } from './data.js';
import {
  addDays, addMonths, dm, monthName, monthEnd, daysBetween, dayName, fmt, signed,
  series, balanceOn, monthSummary, next30, alerts, weeks, WEEK_ROWS, schedule,
  dealPayments, paymentStatus, paymentLabel, productOf, termsOf, freqText, monthlyCost, expenseDates,
} from './finance.js';
import { EMBED, IS_PHONE, readView, saveView, writeHandoff, takeHandoff, applyPhoneViewport, ViewToggle, PhonePreview } from './viewswitch.js';

const NAV = [
  ['home', 'בית', 'house'],
  ['calendar', 'יומן', 'calendar-days'],
  ['tasks', 'משימות', 'list-checks'],
  ['finance', 'כספים', 'wallet'],
  ['accountant', 'רואה חשבון', 'calculator'],
  ['files', 'קבצים', 'folder-open'],
  ['leads', 'לידים', 'users'],
];
const MOBILE_NAV = ['home', 'calendar', 'tasks', 'leads', 'finance'];
const RANGE_END = '2026-12-31';
const clone = (o) => JSON.parse(JSON.stringify(o));

// ---------- small pieces ----------

function Sheet({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  return html`<div class="fixed inset-0 z-50">
    <div class="absolute inset-0 bg-ink/30" onClick=${onClose}></div>
    <div
      class=${cx('rise pb-safe absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-[18px] bg-canvas md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[18px] md:shadow-2xl', wide ? 'md:w-[620px]' : 'md:w-[480px]')}
      role="dialog"
      aria-modal="true"
      aria-label=${title}
    >
      <div class="flex items-center justify-between px-5 pb-2 pt-4">
        <h2 class="fb-h2 !text-[22px]">${title}</h2>
        <button type="button" aria-label="סגירה" class="rounded-lg p-1.5 text-muted hover:bg-white cursor-pointer" onClick=${onClose}><${Icon} name="x" size=${18} /></button>
      </div>
      <div class="thin-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-4">${children}</div>
      ${footer && html`<div class="flex items-center justify-between gap-3 border-t border-line px-5 py-3">${footer}</div>`}
    </div>
  </div>`;
}

function Field({ label, hint, children }) {
  return html`<label class="mb-3.5 block">
    <span class="mb-1 block text-[14px] font-bold text-ink">${label}</span>
    ${children}
    ${hint && html`<span class="mt-1 block text-[12px] text-muted">${hint}</span>`}
  </label>`;
}

const inputCls = 'h-11 w-full rounded-xl border-[1.5px] border-line bg-white px-3 text-[16px] text-ink outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-100';

function MoneyInput({ value, onInput, big, autofocus }) {
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

function Chips({ options, value, onChange, small }) {
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
          small ? 'h-9 text-[14px]' : 'h-10 text-[14px]',
          value === o.id ? 'border-brand-600 bg-brand-100 text-brand-600' : 'border-line bg-white text-ink hover:border-brand-300',
        )}
      >${o.label}${o.tag && html`<span class="ms-1.5 text-[12px] font-semibold text-muted">${o.tag}</span>`}</button>`,
    )}
  </div>`;
}

function Tag({ tone = 'muted', children }) {
  const cls = {
    late: 'bg-error-50 text-error',
    paid: 'bg-money-50 text-money',
    due: 'bg-brand-100 text-brand-600',
    warn: 'bg-warn-50 text-warn',
    muted: 'bg-canvas text-muted ring-1 ring-line',
  }[tone];
  return html`<span class=${cx('inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full px-2 text-[12px] font-bold', cls)}>${children}</span>`;
}

const Amount = ({ n, class: cls = '' }) =>
  html`<span class=${cx('font-display font-extrabold tabular-nums', n > 0 ? 'text-money' : 'text-ink', cls)}>${signed(n)}</span>`;

// ---------- the four numbers ----------

function Kpi({ label, icon, children, tone, class: cls = '' }) {
  return html`<section class=${cx('fb-panel flex min-w-0 flex-col !p-4 md:!p-5', tone === 'warn' && '!ring-2 !ring-warn/50', cls)}>
    <p class="flex items-center gap-2 text-[14px] font-bold text-muted"><span class="fb-chip-ic h-8 w-8"><${Icon} name=${icon} size=${17} /></span>${label}</p>
    ${children}
  </section>`;
}

const Big = ({ children, class: cls = '' }) => html`<p class=${cx('mt-2 font-display text-[26px] font-extrabold leading-none tabular-nums md:text-[30px]', cls)}>${children}</p>`;
const Sub = ({ children }) => html`<p class="mt-2 text-[12px] font-semibold leading-snug text-muted md:text-[14px]">${children}</p>`;

function Kpis({ state, onBalance }) {
  const m = monthSummary(state);
  const cash = balanceOn(state, TODAY);
  const low = cash < state.cushion;
  const pct = Math.max(0, Math.min(100, (m.net / GOAL) * 100));
  return html`<div class="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
    <${Kpi} label="בקופה היום" icon="landmark" tone=${low && 'warn'}>
      <${Big} class=${low ? 'text-warn' : 'text-ink'}>${fmt(cash)}<//>
      <${Sub}>
        ${low ? html`<b class="text-warn">מתחת לכרית הביטחון.</b> ` : ''}מתוכם ${fmt(m.tax)} בצד למס ·
        <button type="button" onClick=${onBalance} class="font-bold text-brand-600 hover:underline cursor-pointer">עדכון</button>
      <//>
    <//>
    <${Kpi} label=${`נכנס ב${monthName(TODAY)}`} icon="arrow-down-left">
      <${Big} class="text-money">${fmt(m.received)}<//>
      <${Sub}>${state.deals.length === 0 ? 'עוד אין תשלומים מלקוחות' : m.pending ? html`ועוד ${fmt(m.pending)} ${m.pendingList.some((p) => p.due < TODAY) ? 'שעוד לא התקבלו' : 'שמגיעים החודש'}` : 'כל התשלומים של החודש התקבלו'}<//>
    <//>
    <${Kpi} label=${`יוצא ב${monthName(TODAY)}`} icon="arrow-up-right">
      <${Big} class="text-ink">${fmt(m.out)}<//>
      <${Sub}>הוצאות ${fmt(m.expenses)} · למס ${fmt(m.tax)}<//>
    <//>
    <${Kpi} label="רווח נקי החודש" icon="target">
      <${Big} class=${m.net >= 0 ? 'text-money' : 'text-error'}>${fmt(m.net)}<//>
      <div class="mt-2.5 h-2 overflow-hidden rounded-full bg-line" aria-hidden="true"><div class="h-full rounded-full bg-brand-600 transition-all duration-500" style=${{ width: `${pct}%` }}></div></div>
      <${Sub}>${m.gap ? `מתוך יעד ${fmt(GOAL)} · חסרים ${fmt(m.gap)}` : `היעד של ${fmt(GOAL)} הושג`}<//>
    <//>
  </div>`;
}

// ---------- reminders strip ----------

function AlertRow({ a, onAct, compact }) {
  const tone = { error: 'border-error/40 bg-error-50/60', warn: 'border-warn/40 bg-warn-50/70', info: 'border-line bg-surface' }[a.tone];
  const ic = { error: 'text-error', warn: 'text-warn', info: 'text-brand-600' }[a.tone];
  const act = {
    remind: ['תזכורת ב-WhatsApp', 'message-circle'],
    paid: ['התקבל', 'check'],
    deals: ['לעסקאות הפתוחות', 'arrow-left'],
  }[a.action];
  return html`<li class=${cx('flex flex-col gap-2 rounded-[14px] border px-3.5 py-3 sm:flex-row sm:items-center', tone)}>
    <span class="flex min-w-0 flex-1 items-start gap-2.5">
      <${Icon} name=${a.icon} size=${20} class=${cx('mt-0.5', ic)} />
      <span class="min-w-0">
        <b class="block text-[14px] text-ink">${a.title}</b>
        <span class="block text-[14px] text-muted">${a.text}</span>
      </span>
    </span>
    ${act && !compact && html`<${Button} variant="mini" class="shrink-0 self-start sm:self-center" onClick=${() => onAct(a)}><${Icon} name=${act[1]} size=${15} />${act[0]}<//>`}
  </li>`;
}

// ---------- the next 30 days ----------

function Next30({ state, onPaid, onRemind }) {
  const n = next30(state);
  const end = balanceOn(state, addDays(TODAY, 30));
  return html`<section class="fb-panel flex min-h-0 flex-col !p-4 md:!p-5">
    <div class="mb-2 flex items-baseline justify-between gap-2">
      <h2 class="fb-h3">מגיע ב-30 הימים הקרובים</h2>
      <span class="text-[12px] font-semibold text-muted">עד ${dm(addDays(TODAY, 30))}</span>
    </div>
    <div class="thin-scroll -mx-1 min-h-0 flex-1 overflow-y-auto px-1 lg:max-h-[318px]">
      ${n.late.length > 0 &&
      html`<ul class="mb-2 flex flex-col gap-2">
        ${n.late.map(
          (l) => html`<li key=${l.payment.id} class=${cx('rounded-xl border p-2.5', l.status === 'late' ? 'border-error/35 bg-error-50/50' : 'border-brand-300 bg-brand-50/60')}>
            <div class="flex items-center gap-2">
              <span class=${cx('w-11 shrink-0 text-center font-display text-[14px] font-extrabold', l.status === 'late' ? 'text-error' : 'text-brand-600')}>${dm(l.date)}</span>
              <span class="min-w-0 flex-1"><b class="block truncate text-[14px]">${l.label}</b><span class="block text-[12px] text-muted">${paymentLabel(l.deal, l.payment)}</span></span>
              <${Amount} n=${l.amount} class="text-[16px]" />
            </div>
            <div class="mt-2 flex flex-wrap items-center gap-2 ps-[52px]">
              ${l.status === 'late' ? html`<${Tag} tone="late">באיחור ${daysBetween(l.date, TODAY)} ימים<//>` : html`<${Tag} tone="due">מגיע היום<//>`}
              ${state.reminders[l.payment.id] && html`<${Tag}>נשלחה תזכורת ${dm(state.reminders[l.payment.id])}<//>`}
              <span class="ms-auto flex gap-1.5">
                <${Button} variant="text" class="!h-8 !px-2" onClick=${() => onRemind(l.deal, l.payment)}><${Icon} name="message-circle" size=${15} />תזכורת<//>
                <${Button} variant="mini" class="!h-8" onClick=${() => onPaid(l.deal, l.payment)}><${Icon} name="check" size=${15} />התקבל<//>
              </span>
            </div>
          </li>`,
        )}
      </ul>`}
      <ul class="flex flex-col divide-y divide-line">
        ${n.coming.length === 0 && html`<li class="py-3 text-[14px] text-muted">אין תשלומים או הוצאות בחודש הקרוב.</li>`}
        ${n.coming.map(
          (e, i) => html`<li key=${i} class="flex items-center gap-2 py-2">
            <span class="w-11 shrink-0 text-center font-display text-[14px] font-extrabold text-ink">${dm(e.date)}</span>
            <span class="min-w-0 flex-1">
              <b class="block truncate text-[14px] font-bold">${e.label}</b>
              <span class="block text-[12px] text-muted">${e.kind === 'in' ? paymentLabel(e.deal, e.payment) : freqText(e.expense)}</span>
            </span>
            <${Amount} n=${e.amount} class="text-[15px]" />
          </li>`,
        )}
      </ul>
      ${n.maybe.length > 0 &&
      html`<div class="mt-2 rounded-xl border border-dashed border-brand-300 bg-brand-50/60 p-2.5">
        <p class="mb-1 text-[12px] font-bold text-brand-600">אולי ייכנס · לא נספר בקופה</p>
        ${n.maybe.map(
          (m) => html`<p key=${m.deal.id} class="flex items-center gap-2 py-1 text-[14px]">
            <span class="min-w-0 flex-1 truncate"><b>${m.deal.client}</b> · ${m.deal.stage}</span>
            <${Tag} tone="due">${m.deal.chance}%<//>
            <span class="font-display font-extrabold tabular-nums text-muted">${fmt(m.amount)}</span>
          </p>`,
        )}
      </div>`}
    </div>
    <p class="mt-3 flex items-center justify-between border-t-2 border-dashed border-line pt-2.5 text-[14px] font-bold">
      <span>צפוי בקופה ב-${dm(addDays(TODAY, 30))}</span>
      <span class="font-display text-[18px] font-extrabold tabular-nums">${fmt(end)}</span>
    </p>
  </section>`;
}

// ---------- the chart panel ----------

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

// ---------- tabs: the week in numbers, payments from clients, fixed expenses ----------

function WeekTable({ state }) {
  const ws = weeks(state);
  const val = (w, r) => w[r.id];
  return html`<div>
    <div class="thin-scroll -mx-1 overflow-x-auto px-1">
      <table class="w-full min-w-[560px] border-separate border-spacing-0 text-[14px]">
        <thead>
          <tr class="text-[12px] font-bold text-muted">
            <th class="sticky right-0 bg-surface py-2 pe-3 text-start"></th>
            ${ws.map((w) => html`<th key=${w.start} class=${cx('px-2 py-2 text-center', w.current && 'rounded-t-xl bg-brand-100 text-brand-600')}>${w.current ? 'השבוע' : `${dm(w.start)}–${dm(w.end)}`}</th>`)}
            <th class="px-2 py-2 text-center text-ink">היעד לשבוע</th>
          </tr>
        </thead>
        <tbody>
          ${WEEK_ROWS.map(
            (r) => html`<tr key=${r.id}>
              <th class="sticky right-0 border-t border-line bg-surface py-2.5 pe-3 text-start font-bold">${r.label}</th>
              ${ws.map((w) => {
                const v = val(w, r);
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
    <p class="mt-3 text-[12px] text-muted">לידים, שיחות וסגירות מגיעים מהלידים. הכנסה מהתשלומים שסומנו "התקבל". הוצאות שיווק מההוצאות בקטגוריית שיווק. היעד מ"העסק במספרים".</p>
  </div>`;
}

function PaymentsTab({ state, onPaid, onRemind, onNewDeal }) {
  return html`<div>
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <p class="text-[14px] text-muted">כל עסקה שנסגרת בלידים מקבלת לוח תשלומים לפי תנאי התשלום מההצעה.</p>
      <${Button} variant="mini" onClick=${onNewDeal}><${Icon} name="plus" size=${15} />עסקה שנסגרה<//>
    </div>
    ${state.deals.length === 0 && html`<div class="fb-empty !p-4 text-[14px]">עוד אין עסקאות שנסגרו. כשליד יעבור ל"נסגר", לוח התשלומים שלו ייכנס לכאן ולגרף.</div>`}
    <div class="grid gap-3 md:grid-cols-2">
      ${state.deals.map((d) => {
        const ps = dealPayments(d, monthEnd(addMonths(TODAY, 2)));
        const paid = ps.filter((p) => p.paidOn).reduce((s, p) => s + p.amount, 0);
        return html`<article key=${d.id} class="rounded-[14px] border border-line bg-white p-3.5">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <h3 class="font-display text-[16px] font-extrabold">${d.client}</h3>
              <p class="truncate text-[12px] text-muted">${productOf(d.product)?.name} · ${termsOf(d.terms).label} · נסגר ${dm(d.closed)}</p>
            </div>
            <span class="text-end">
              <b class="block font-display text-[16px] font-extrabold tabular-nums">${d.monthly ? `${fmt(d.monthly.amount)} בחודש` : fmt(d.total)}</b>
              ${!d.monthly && html`<span class="text-[12px] text-muted">התקבלו ${fmt(paid)}</span>`}
            </span>
          </div>
          <ul class="mt-2.5 flex flex-col gap-1.5">
            ${ps.map((p) => {
              const st = paymentStatus(p);
              return html`<li key=${p.id} class="flex items-center gap-2 text-[14px]">
                <span class="w-11 shrink-0 font-display font-extrabold tabular-nums">${dm(p.due)}</span>
                <span class="min-w-0 flex-1 truncate text-muted">${paymentLabel(d, p)}</span>
                <span class="font-display font-extrabold tabular-nums">${fmt(p.amount)}</span>
                ${st === 'paid'
                  ? html`<${Tag} tone="paid"><${Icon} name="check" size=${13} />התקבל ${dm(p.paidOn)}<//>`
                  : html`<span class="flex items-center gap-1">
                      ${st === 'late' && html`<${Tag} tone="late">באיחור<//>`}
                      ${st === 'late' && html`<button type="button" title="תזכורת ב-WhatsApp" aria-label="תזכורת ב-WhatsApp" onClick=${() => onRemind(d, p)} class="inline-flex h-7 w-7 items-center justify-center rounded-lg text-brand-600 hover:bg-brand-50 cursor-pointer"><${Icon} name="message-circle" size=${16} /></button>`}
                      <button type="button" onClick=${() => onPaid(d, p)} class="h-7 rounded-lg border border-brand-300 px-2 text-[12px] font-bold text-brand-600 hover:bg-brand-50 cursor-pointer">התקבל</button>
                    </span>`}
              </li>`;
            })}
          </ul>
        </article>`;
      })}
    </div>
    ${state.openDeals.length > 0 &&
    html`<div class="mt-4">
      <h3 class="mb-2 text-[14px] font-bold text-muted">עסקאות פתוחות · לא נספרות בקופה</h3>
      <ul class="flex flex-col divide-y divide-line rounded-[14px] border border-dashed border-brand-300 bg-brand-50/40 px-3.5">
        ${state.openDeals.map(
          (o) => html`<li key=${o.id} class="flex items-center gap-2 py-2.5 text-[14px]">
            <span class="min-w-0 flex-1"><b>${o.client}</b><span class="block text-[12px] text-muted">${productOf(o.product)?.name} · ${o.stage}</span></span>
            <${Tag} tone="due">סיכוי ${o.chance}%<//>
            <span class="font-display font-extrabold tabular-nums">${fmt(o.total)}</span>
          </li>`,
        )}
      </ul>
    </div>`}
  </div>`;
}

function ExpensesTab({ state, onEdit, onAdd, onSettings }) {
  const total = state.expenses.reduce((s, x) => s + monthlyCost(x), 0);
  const next = (x) => expenseDates(x, addDays(TODAY, 1), addDays(TODAY, 400))[0];
  return html`<div>
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <p class="text-[14px] text-muted">ההוצאות מ"העסק במספרים", עם יום החיוב של כל אחת. הן יורדות מהקופה ביום החיוב.</p>
      <${Button} variant="mini" onClick=${onAdd}><${Icon} name="plus" size=${15} />הוצאה<//>
    </div>
    <ul class="flex flex-col divide-y divide-line rounded-[14px] border border-line bg-white px-3.5">
      ${state.expenses.map(
        (x) => html`<li key=${x.id}>
          <button type="button" onClick=${() => onEdit(x)} class="group flex w-full items-center gap-3 py-2.5 text-start cursor-pointer">
            <span class="fb-chip-ic h-8 w-8 shrink-0"><${Icon} name=${CATEGORIES[x.category].icon} size=${16} /></span>
            <span class="min-w-0 flex-1">
              <b class="block truncate text-[14px]">${x.name}</b>
              <span class="block text-[12px] text-muted">${CATEGORIES[x.category].label} · ${freqText(x)}${next(x) ? ` · הבא ${dm(next(x))}` : ''}</span>
            </span>
            <span class="font-display text-[15px] font-extrabold tabular-nums">${fmt(x.amount)}</span>
            <${Icon} name="pencil" size=${15} class="text-faint group-hover:text-brand-600" />
          </button>
        </li>`,
      )}
    </ul>
    <p class="mt-2 text-[14px] font-bold">בממוצע בחודש: <span class="font-display tabular-nums">${fmt(total)}</span></p>
    <div class="mt-4 grid gap-3 sm:grid-cols-2">
      <button type="button" onClick=${onSettings} class="rounded-[14px] border border-line bg-white p-3.5 text-start hover:border-brand-300 cursor-pointer">
        <span class="text-[12px] font-bold text-muted">הפרשה למס</span>
        <b class="mt-0.5 block text-[16px]">${state.taxPct}% מכל הכנסה · ${ENTITIES[state.entity].label}</b>
        <span class="text-[12px] text-muted">הערכה בלבד. כדאי לבדוק מול רואה חשבון.</span>
      </button>
      <button type="button" onClick=${onSettings} class="rounded-[14px] border border-line bg-white p-3.5 text-start hover:border-brand-300 cursor-pointer">
        <span class="text-[12px] font-bold text-muted">כרית ביטחון</span>
        <b class="mt-0.5 block text-[16px]">${fmt(state.cushion)}</b>
        <span class="text-[12px] text-muted">כשהקופה יורדת מתחת, הכריש מתריע.</span>
      </button>
    </div>
  </div>`;
}

function Tabs({ tab, onTab, children }) {
  const list = [
    ['week', 'שבוע במספרים', 'table-2'],
    ['payments', 'תשלומים מלקוחות', 'hand-coins'],
    ['expenses', 'הוצאות קבועות', 'receipt'],
  ];
  return html`<section class="fb-panel !p-4 md:!p-5">
    <div role="tablist" class="no-scrollbar -mx-1 mb-4 flex gap-1 overflow-x-auto px-1">
      ${list.map(
        ([id, label, icon]) => html`<button
          key=${id}
          type="button"
          role="tab"
          aria-selected=${tab === id}
          onClick=${() => onTab(id)}
          class=${cx('flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-3 text-[14px] font-bold transition-colors cursor-pointer', tab === id ? 'bg-brand-100 text-brand-600' : 'text-muted hover:bg-canvas hover:text-ink')}
        ><${Icon} name=${icon} size=${16} />${label}</button>`,
      )}
    </div>
    ${children}
  </section>`;
}

// ---------- windows ----------

function RemindSheet({ deal, payment, onClose, onSend }) {
  const late = payment.due < TODAY;
  const [text, setText] = useState(
    late
      ? `היי ${deal.client.split(' ')[0]}, תזכורת קטנה: ${paymentLabel(deal, payment)} (${fmt(payment.amount)}) על "${productOf(deal.product)?.name}" היה אמור להיכנס ב-${dm(payment.due)}. אפשר להעביר בקישור הזה: pay.flowbiz.co.il/s/3k9 . תודה! ${USER.firstName}`
      : `היי ${deal.client.split(' ')[0]}, רק מזכיר ש${paymentLabel(deal, payment)} (${fmt(payment.amount)}) מגיע ב-${dm(payment.due)}. הקישור לתשלום: pay.flowbiz.co.il/s/3k9 . תודה! ${USER.firstName}`,
  );
  return html`<${Sheet}
    title="תזכורת ב-WhatsApp"
    onClose=${onClose}
    footer=${html`<${Button} variant="secondary" onClick=${onClose}>חזרה<//><${Button} onClick=${() => onSend(text)}><${Icon} name="message-circle" size=${18} />פתיחה ב-WhatsApp<//>`}
  >
    <p class="mb-3 text-[14px] text-muted">אל <b class="text-ink">${deal.client}</b> · ${deal.phone}. ההודעה נכתבה בשפה שלך, ואפשר לשנות אותה לפני השליחה.</p>
    <div class="rounded-[14px] bg-[#e7f4ef] p-3">
      <textarea rows="5" value=${text} onInput=${(e) => setText(e.target.value)} class="w-full resize-none rounded-xl bg-white p-3 text-[16px] leading-relaxed text-ink outline-none focus:ring-4 focus:ring-brand-100"></textarea>
    </div>
    <p class="mt-2 text-[12px] text-muted">הקישור לתשלום מגיע מהשלב "גביית כספים". FlowBiz לא שולחים את ההודעה בעצמם: היא נפתחת ב-WhatsApp של המשתמש.</p>
  <//>`;
}

function BalanceSheet({ state, onClose, onSave }) {
  const calc = balanceOn(state, TODAY);
  const [v, setV] = useState(calc);
  const diff = v == null ? 0 : v - calc;
  return html`<${Sheet}
    title="עדכון יתרה"
    onClose=${onClose}
    footer=${html`<${Button} variant="secondary" onClick=${onClose}>חזרה<//><${Button} disabled=${v == null} onClick=${() => onSave(v)}>שמירה<//>`}
  >
    <${Field} label="כמה יש היום בחשבון העסק?" hint="אפשר לבדוק באפליקציה של הבנק. פעם בחודש נבקש לאשר את היתרה.">
      <${MoneyInput} value=${v} onInput=${setV} big autofocus />
    <//>
    <p class="rounded-xl bg-white p-3 text-[14px]">
      לפי החישוב: <b class="font-display tabular-nums">${fmt(calc)}</b>
      ${diff !== 0 && html`<br />ההפרש, <b class="font-display tabular-nums">${signed(diff)}</b>, יירשם כ"עדכון יתרה" של היום. אם זה תשלום או הוצאה שלא נרשמו, עדיף להוסיף אותם.`}
    </p>
  <//>`;
}

function ExpenseSheet({ expense, onClose, onSave, onDelete }) {
  const [x, setX] = useState(expense || { name: '', amount: null, category: 'tools', freq: 'monthly', day: 1 });
  const set = (k, v) => setX((o) => ({ ...o, [k]: v }));
  const setFreq = (f) => setX((o) => ({ ...o, freq: f, day: f === 'monthly' ? 1 : f === 'weekly' ? 0 : f === 'yearly' ? '01-01' : addDays(TODAY, 7) }));
  const ok = x.name.trim() && x.amount > 0;
  return html`<${Sheet}
    title=${expense ? 'עריכת הוצאה' : 'הוצאה חדשה'}
    onClose=${onClose}
    footer=${html`<span class="flex gap-2">${expense ? html`<${Button} variant="text" class="!text-error" onClick=${() => onDelete(x)}><${Icon} name="trash-2" size=${15} />מחיקה<//>` : html`<${Button} variant="secondary" onClick=${onClose}>חזרה<//>`}</span>
      <${Button} disabled=${!ok} onClick=${() => onSave(x)}>שמירה<//>`}
  >
    <${Field} label="שם ההוצאה"><input class=${inputCls} value=${x.name} onInput=${(e) => set('name', e.target.value)} placeholder="למשל: מנוי Zoom" /><//>
    <${Field} label="סכום"><${MoneyInput} value=${x.amount} onInput=${(v) => set('amount', v)} /><//>
    <${Field} label="קטגוריה">
      <${Chips} small options=${Object.entries(CATEGORIES).map(([id, c]) => ({ id, label: c.label }))} value=${x.category} onChange=${(v) => set('category', v)} />
    <//>
    <${Field} label="כל כמה זמן?"><${Chips} small options=${FREQS} value=${x.freq} onChange=${setFreq} /><//>
    ${x.freq === 'monthly' &&
    html`<${Field} label="באיזה יום בחודש יורד?">
      <select class=${inputCls} value=${x.day} onChange=${(e) => set('day', Number(e.target.value))}>${Array.from({ length: 28 }, (_, i) => html`<option value=${i + 1}>${i + 1} בחודש</option>`)}</select>
    <//>`}
    ${x.freq === 'weekly' &&
    html`<${Field} label="באיזה יום בשבוע?">
      <select class=${inputCls} value=${x.day} onChange=${(e) => set('day', Number(e.target.value))}>${Array.from({ length: 7 }, (_, i) => html`<option value=${i}>יום ${dayName(i)}</option>`)}</select>
    <//>`}
    ${x.freq === 'yearly' &&
    html`<${Field} label="באיזה תאריך בשנה?"><input type="date" class=${inputCls} value=${`2027-${x.day}`} onInput=${(e) => set('day', e.target.value.slice(5))} /><//>`}
    ${x.freq === 'once' && html`<${Field} label="מתי?"><input type="date" class=${inputCls} value=${x.day} onInput=${(e) => set('day', e.target.value)} /><//>`}
  <//>`;
}

// What opens in the CRM when a lead moves to "נסגר": the payment schedule of the deal,
// by the payment terms of the winning offer. In the mockup it opens from the payments tab.
function DealSheet({ state, onClose, onSave }) {
  const open = state.openDeals[0];
  const [client, setClient] = useState(open?.client || '');
  const [product, setProduct] = useState(open?.product || PRODUCTS[0].id);
  const p = PRODUCTS.find((x) => x.id === product);
  const [total, setTotal] = useState(open?.total || p.price);
  const [terms, setTerms] = useState(open?.terms || p.terms);
  const [first, setFirst] = useState(TODAY);
  const pick = (id) => {
    const np = PRODUCTS.find((x) => x.id === id);
    setProduct(id);
    setTotal(np.price);
    setTerms(np.terms);
  };
  const plan = total ? schedule(total, terms, first) : [];
  const ok = client.trim() && total > 0;
  return html`<${Sheet}
    wide
    title="עסקה שנסגרה · לוח תשלומים"
    onClose=${onClose}
    footer=${html`<${Button} variant="secondary" onClick=${onClose}>חזרה<//><${Button} disabled=${!ok} onClick=${() => onSave({ client, product, total, terms, first, plan, fromOpen: open && open.client === client ? open.id : null })}>שמירה<//>`}
  >
    <p class="mb-3 text-[14px] text-muted">במערכת החלון הזה נפתח בלידים, כשמעבירים ליד ל"נסגר". המוצר והמחיר מהסל, תנאי התשלום מההצעה המנצחת.</p>
    <div class="grid gap-x-4 sm:grid-cols-2">
      <${Field} label="הלקוח"><input class=${inputCls} value=${client} onInput=${(e) => setClient(e.target.value)} /><//>
      <${Field} label="המוצר">
        <select class=${inputCls} value=${product} onChange=${(e) => pick(e.target.value)}>${PRODUCTS.map((x) => html`<option value=${x.id}>${x.name}</option>`)}</select>
      <//>
      <${Field} label="סכום העסקה" hint=${total !== p.price ? `המחיר בסל: ${fmt(p.price)}` : 'המחיר מהסל'}><${MoneyInput} value=${total} onInput=${setTotal} /><//>
      <${Field} label=${termsOf(terms).n === 0 ? 'תשלום ראשון' : 'תאריך התשלום הראשון'}><input type="date" class=${inputCls} value=${first} onInput=${(e) => setFirst(e.target.value || TODAY)} /><//>
    </div>
    <${Field} label="תנאי תשלום">
      <${Chips} options=${TERMS.map((t) => ({ ...t, tag: t.id === p.terms ? 'מההצעה' : '' }))} value=${terms} onChange=${setTerms} />
    <//>
    ${plan.length > 0 &&
    html`<div class="rounded-[14px] bg-white p-3">
      <p class="mb-1.5 text-[12px] font-bold text-muted">לוח התשלומים · ייכנס לגרף ול"מגיע ב-30 הימים"</p>
      <ul class="flex flex-col divide-y divide-line">
        ${plan.map(
          (x, i) => html`<li key=${i} class="flex items-center gap-2 py-1.5 text-[14px]">
            <span class="w-12 font-display font-extrabold tabular-nums">${dm(x.due)}</span>
            <span class="flex-1 text-muted">${x.monthly ? 'כל חודש, עד ביטול' : plan.length > 1 ? `תשלום ${i + 1} מתוך ${plan.length}` : 'תשלום אחד'}</span>
            <span class="font-display font-extrabold tabular-nums text-money">${fmt(x.amount)}</span>
          </li>`,
        )}
      </ul>
    </div>`}
  <//>`;
}

function SettingsSheet({ state, onClose, onSave }) {
  const [cushion, setCushion] = useState(state.cushion);
  const [taxPct, setTax] = useState(state.taxPct);
  const monthly = Math.round(state.expenses.reduce((s, x) => s + monthlyCost(x), 0));
  return html`<${Sheet}
    title="הגדרות הלוח"
    onClose=${onClose}
    footer=${html`<${Button} variant="secondary" onClick=${onClose}>חזרה<//><${Button} onClick=${() => onSave({ cushion, taxPct })}>שמירה<//>`}
  >
    <${Field} label="כרית ביטחון" hint=${`הצעה: שני חודשי הוצאות, ${fmt(monthly * 2)}.`}><${MoneyInput} value=${cushion} onInput=${setCushion} /><//>
    <${Field} label="הפרשה למס, באחוזים מכל הכנסה" hint=${`ברירת המחדל ל${ENTITIES[state.entity].label} (מאזור רואה החשבון). הערכה בלבד, לא ייעוץ מס.`}>
      <div class="relative" dir="ltr"><span class="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted">%</span><input type="number" class=${cx(inputCls, 'pl-8 text-left font-display font-extrabold')} value=${taxPct} onInput=${(e) => setTax(Number(e.target.value))} /></div>
    <//>
  <//>`;
}

// ---------- first entry: three questions, then the board ----------

function Setup({ state, onDone }) {
  const [i, setI] = useState(0);
  const [amount, setAmount] = useState(null);
  const [exps, setExps] = useState(state.expenses);
  const monthly = Math.round(exps.reduce((s, x) => s + monthlyCost(x), 0));
  const [cushion, setCushion] = useState(null);
  const [taxPct, setTax] = useState(ENTITIES[state.entity].taxPct);
  const steps = ['היתרה היום', 'ההוצאות הקבועות', 'כרית ומס'];
  const next = () => (i < 2 ? setI(i + 1) : onDone({ amount, expenses: exps, cushion: cushion ?? monthly * 2, taxPct }));
  const off = i === 0 && amount == null;
  useEffect(() => {
    const k = (e) => e.key === 'Enter' && !off && document.activeElement?.tagName !== 'SELECT' && next();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });
  return html`<div class="mx-auto max-w-[640px]">
    <div class="mb-4 flex items-center gap-3">
      <div class="flex flex-1 gap-1.5">${steps.map((s, k) => html`<span key=${s} class=${cx('h-2 flex-1 rounded-full', k < i ? 'bg-brand-600' : k === i ? 'bg-brand-300' : 'bg-line')}></span>`)}</div>
      <span class="text-[12px] font-bold text-muted">${steps[i]} · ${i + 1}/3</span>
    </div>
    <section class="rise fb-panel !p-5 md:!p-7" key=${i}>
      ${i === 0 &&
      html`<span class="fb-eyebrow">הגדרת המרכז הפיננסי · כ-2 דקות</span>
        <h1 class="fb-h1 mt-1 text-[26px] md:text-[32px]">כמה כסף יש היום <${Mark}>בחשבון העסק<//>?</h1>
        <p class="mt-2 text-[16px] text-ink">מהמספר הזה נבנית הקופה. כל תשלום שמסומן "התקבל" מוסיף לה, וכל הוצאה יורדת ממנה ביום החיוב.</p>
        <div class="mt-5 max-w-[320px]"><${MoneyInput} value=${amount} onInput=${setAmount} big autofocus /></div>
        <p class="mt-2 text-[12px] text-muted">אפשר לבדוק באפליקציה של הבנק. פעם בחודש נבקש לאשר את היתרה.</p>`}
      ${i === 1 &&
      html`<span class="fb-eyebrow">הגדרת המרכז הפיננסי</span>
        <h1 class="fb-h1 mt-1 text-[26px] md:text-[32px]">מתי יורדות <${Mark}>ההוצאות הקבועות<//>?</h1>
        <p class="mt-2 flex items-center gap-1.5 text-[14px] font-semibold text-sky-text"><${Icon} name="pencil" size=${14} />מילאנו לפי התקציב שבנית ב"העסק במספרים". רק לבדוק את יום החיוב.</p>
        <ul class="mt-4 flex flex-col divide-y divide-line">
          ${exps.map(
            (x, k) => html`<li key=${x.id} class="flex flex-wrap items-center gap-2 py-2.5">
              <span class="min-w-0 flex-1"><b class="block text-[14px]">${x.name}</b><span class="font-display text-[14px] font-extrabold tabular-nums">${fmt(x.amount)}</span></span>
              <select class=${cx(inputCls, '!h-10 !w-auto !text-[14px]')} value=${x.freq} onChange=${(e) => setExps(exps.map((o, j) => (j === k ? { ...o, freq: e.target.value, day: e.target.value === 'weekly' ? 0 : e.target.value === 'yearly' ? '01-01' : 1 } : o)))}>
                ${FREQS.filter((f) => f.id !== 'once').map((f) => html`<option value=${f.id}>${f.label}</option>`)}
              </select>
              ${x.freq === 'monthly' && html`<select class=${cx(inputCls, '!h-10 !w-auto !text-[14px]')} value=${x.day} onChange=${(e) => setExps(exps.map((o, j) => (j === k ? { ...o, day: Number(e.target.value) } : o)))}>${Array.from({ length: 28 }, (_, d) => html`<option value=${d + 1}>ב-${d + 1} לחודש</option>`)}</select>`}
              ${x.freq === 'weekly' && html`<select class=${cx(inputCls, '!h-10 !w-auto !text-[14px]')} value=${x.day} onChange=${(e) => setExps(exps.map((o, j) => (j === k ? { ...o, day: Number(e.target.value) } : o)))}>${Array.from({ length: 7 }, (_, d) => html`<option value=${d}>יום ${dayName(d)}</option>`)}</select>`}
              ${x.freq === 'yearly' && html`<span class="text-[14px] text-muted">${freqText(x).replace('פעם בשנה ', '')}</span>`}
            </li>`,
          )}
        </ul>`}
      ${i === 2 &&
      html`<span class="fb-eyebrow">הגדרת המרכז הפיננסי</span>
        <h1 class="fb-h1 mt-1 text-[26px] md:text-[32px]">כרית ביטחון <${Mark}>והפרשה למס<//></h1>
        <div class="mt-5 grid gap-4 sm:grid-cols-2">
          <${Field} label="כרית ביטחון" hint="מתחת לסכום הזה הכריש מתריע.">
            <${MoneyInput} value=${cushion ?? monthly * 2} onInput=${setCushion} />
            <span class="mt-1.5 inline-flex"><${Tag} tone="due">הצעה: שני חודשי הוצאות<//></span>
          <//>
          <${Field} label="הפרשה למס מכל הכנסה" hint=${`ברירת מחדל ל${ENTITIES[state.entity].label}, מאזור רואה החשבון. הערכה בלבד, כדאי לבדוק מול רואה חשבון.`}>
            <div class="relative" dir="ltr"><span class="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted">%</span><input type="number" class=${cx(inputCls, 'pl-8 text-left font-display font-extrabold')} value=${taxPct} onInput=${(e) => setTax(Number(e.target.value))} /></div>
          <//>
        </div>`}
    </section>
    <div class="mt-4 flex items-center justify-between">
      ${i > 0 ? html`<${Button} variant="secondary" onClick=${() => setI(i - 1)}>חזרה<//>` : html`<span></span>`}
      ${off && html`<span class="fb-status is-reason max-sm:hidden">צריך את היתרה כדי להמשיך</span>`}
      <${Button} disabled=${off} onClick=${next}>${i < 2 ? 'המשך' : 'סיום ההגדרה'}${i < 2 ? html`<${Icon} name="arrow-left" size=${20} />` : html`<${PencilCheck} size=${20} color="#fff" weight=${2.8} />`}<kbd class="fb-key max-md:hidden">↵</kbd><//>
    </div>
  </div>`;
}

// ---------- notifications (the bell) ----------

function Bell({ list, onAct }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (e) => !e.target.closest?.('[data-bell]') && setOpen(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  return html`<div class="relative" data-bell>
    <button type="button" onClick=${() => setOpen((o) => !o)} aria-label=${`תזכורות: ${list.length}`} aria-expanded=${open} class="relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-brand-50 hover:text-brand-600 cursor-pointer">
      <${Icon} name="bell" size=${19} />
      ${list.length > 0 && html`<span class="absolute end-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-error px-1 text-[11px] font-extrabold text-white ring-2 ring-surface">${list.length}</span>`}
    </button>
    ${open &&
    html`<div class="pop-in fixed inset-x-3 top-16 z-40 rounded-[14px] bg-white p-3 shadow-[0_12px_30px_-10px_rgba(45,62,102,.35)] ring-1 ring-line sm:absolute sm:inset-x-auto sm:end-0 sm:top-[calc(100%+6px)] sm:w-[380px]">
      <p class="mb-2 text-[14px] font-bold">תזכורות</p>
      ${list.length === 0 ? html`<p class="text-[14px] text-muted">אין תזכורות כרגע.</p>` : html`<ul class="flex flex-col gap-2">${list.map((a) => html`<${AlertRow} key=${a.id} a=${a} onAct=${(x) => (setOpen(false), onAct(x))} />`)}</ul>`}
      <p class="mt-2 text-[12px] text-muted">התזכורות מגיעות גם כהתראה בטלפון, לפי ההגדרות.</p>
    </div>`}
  </div>`;
}

// ---------- the app ----------

function App({ view, onViewChange }) {
  const handoff = useRef();
  if (handoff.current === undefined) handoff.current = takeHandoff();
  const from = (k, f) => (handoff.current && k in handoff.current ? handoff.current[k] : f);
  const urlScenario = new URLSearchParams(location.search).get('scenario');
  const [scenarioId, setScenarioId] = useState(() => from('scenarioId', SCENARIOS.some((s) => s.id === urlScenario) ? urlScenario : DEFAULT_SCENARIO));
  const [state, setState] = useState(() => from('state', SCENARIOS.find((s) => s.id === scenarioId).make()));
  const [tab, setTab] = useState(() => from('tab', 'week'));
  // ?sheet=deal|remind|balance|expense|settings opens that window on load (direct links for the dev team).
  const [sheet, setSheet] = useState(() => {
    const t = new URLSearchParams(location.search).get('sheet');
    if (t === 'remind') {
      const deal = state.deals.find((d) => d.payments.some((p) => paymentStatus(p) === 'late'));
      return deal ? { type: 'remind', deal, payment: deal.payments.find((p) => paymentStatus(p) === 'late') } : null;
    }
    return ['deal', 'balance', 'expense', 'settings'].includes(t) && state.setupDone ? { type: t } : null;
  });
  const [dev, setDev] = useState(false);
  const [toast, setToast] = useState(null);
  const [read, setRead] = useState(() => new Set());
  const tabsRef = useRef();

  const showToast = (text, icon, undo) => {
    const id = Date.now();
    setToast({ id, text, icon, undo });
    setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), undo ? 5000 : 2600);
  };
  const update = (fn) => setState((s) => {
    const n = clone(s);
    fn(n);
    return n;
  });
  useEffect(() => {
    window.__flowbizSnapshot = () => ({ scenarioId, state, tab });
  });
  const switchView = (v) => {
    if (!IS_PHONE) writeHandoff({ scenarioId, state, tab });
    onViewChange(v);
  };
  const setScenario = (id) => {
    setScenarioId(id);
    setState(SCENARIOS.find((s) => s.id === id).make());
    setSheet(null);
    showToast(`תרחיש: ${SCENARIOS.find((s) => s.id === id).label}`, 'flask-conical');
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'D' && e.shiftKey && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) setDev((d) => !d);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ----- actions -----
  const markPaid = (deal, payment) => {
    const before = clone(state);
    update((s) => {
      const d = s.deals.find((x) => x.id === deal.id);
      const p = d.payments.find((x) => x.id === payment.id);
      if (p) p.paidOn = TODAY;
      else d.paidMonthly = { ...(d.paidMonthly || {}), [payment.due]: TODAY };
    });
    showToast(`${fmt(payment.amount)} מ${deal.client} נכנסו לקופה`, 'check', () => setState(before));
  };
  const remind = (deal, payment) => setSheet({ type: 'remind', deal, payment });
  const act = (a) => {
    if (a.action === 'remind') remind(a.deal, a.payment);
    else if (a.action === 'paid') markPaid(a.deal, a.payment);
    else {
      setTab('payments');
      setTimeout(() => tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
    }
  };
  const onNav = (id) => (id === 'finance' ? null : showToast('במוק-אפ הזה יש רק את עמוד הכספים', 'info'));

  const list = alerts(state);
  const top = list[0];
  const nextMonthAlert = list.find((a) => a.id.startsWith('month-'));
  const insight = nextMonthAlert ? `${nextMonthAlert.title}. ${nextMonthAlert.text}` : null;
  const sharkMsg = !state.setupDone
    ? 'שלוש שאלות קצרות, ואז רואים את הקופה של העסק: מה יש היום, מה נכנס ויוצא, ומה מגיע בשבועות הקרובים.'
    : top
      ? top.action === 'remind'
        ? `${top.title}: ${top.text}. רוצה לשלוח תזכורת ב-WhatsApp? ההודעה כבר כתובה.`
        : `${top.title}. ${top.text}`
      : 'הכול בזמן. אין תשלומים באיחור, והקופה מעל כרית הביטחון.';
  const sharkMood = !state.setupDone ? 'calm' : top && top.tone !== 'info' ? 'alert' : top ? 'thinking' : 'happy';

  return html`<div dir="rtl" class="flex h-dvh flex-col bg-canvas text-ink">
    ${EMBED &&
    html`<div dir="ltr" class="flex h-11 shrink-0 items-end justify-between bg-surface px-7 pb-1.5 text-[14px] font-bold text-ink" aria-hidden="true">
      <span>9:41</span>
      <span class="flex items-center gap-1.5"><${Icon} name="signal" size=${15} /><${Icon} name="wifi" size=${15} /><${Icon} name="battery-full" size=${18} /></span>
    </div>`}

    <header class="no-print z-20 flex h-16 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 sm:gap-3 md:px-5">
      <${Logo} />
      <nav class="hidden min-w-0 flex-1 items-center justify-evenly gap-1 lg:mx-2 lg:flex xl:mx-4 2xl:mx-10 2xl:gap-2" aria-label="ניווט ראשי">
        ${NAV.map(
          ([id, label, icon]) => html`<button
            key=${id}
            type="button"
            onClick=${() => onNav(id)}
            aria-current=${id === 'finance' ? 'page' : undefined}
            class=${cx(
              'relative flex h-10 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 text-[14px] font-bold transition-colors cursor-pointer xl:px-3 2xl:gap-2 2xl:px-4',
              id === 'finance' ? 'bg-brand-100 text-brand-600' : 'text-muted hover:bg-canvas hover:text-ink',
            )}
          ><${Icon} name=${icon} size=${17} /> ${label}</button>`,
        )}
      </nav>
      <div class="ms-auto flex items-center gap-1.5 lg:ms-0">
        <span class="hidden rounded border border-warn/40 bg-warn-50 px-1.5 py-0.5 text-[12px] font-bold text-warn 2xl:inline">מוק-אפ</span>
        ${!EMBED && html`<${ViewToggle} view=${view} onChange=${switchView} />`}
        <${Bell} list=${list} onAct=${act} />
        <button type="button" onClick=${() => setDev((d) => !d)} title="הערות למפתחים (Shift+D)" aria-label="הערות למפתחים" class="inline-flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-brand-50 hover:text-brand-600 cursor-pointer">
          <${Icon} name="code-xml" size=${18} />
        </button>
        <span class="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 font-display text-[14px] font-extrabold text-white max-sm:hidden">${USER.firstName[0]}</span>
      </div>
    </header>

    <div class="fb-notebook fb-margin relative min-h-0 flex-1">
      <main class="thin-scroll absolute inset-0 overflow-y-auto">
        <div class="mx-auto max-w-6xl px-4 pb-28 pt-4 md:px-8 md:pt-6 lg:pb-12">
          ${!state.setupDone
            ? html`<${Setup}
                state=${state}
                onDone=${({ amount, expenses, cushion, taxPct }) => {
                  update((s) => {
                    s.setupDone = true;
                    s.opening = { amount, date: TODAY };
                    s.expenses = expenses;
                    s.cushion = cushion;
                    s.taxPct = taxPct;
                  });
                  showToast('המרכז הפיננסי מוכן', 'check');
                }}
              />`
            : html`<div class="rise flex flex-col gap-4 md:gap-5">
                <div class="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <span class="fb-eyebrow">המרכז הפיננסי · ${monthName(TODAY)} 2026</span>
                    <h1 class="fb-h1 mt-1 text-[28px] md:text-[36px]">הכסף של העסק, <${Mark}>בזמן אמת<//></h1>
                  </div>
                  <div class="flex items-center gap-2">
                    <${Button} variant="secondary" class="!h-11" onClick=${() => setSheet({ type: 'balance' })}><${Icon} name="landmark" size=${17} />עדכון יתרה<//>
                    <${Button} variant="secondary" class="!h-11" onClick=${() => setSheet({ type: 'expense' })}><${Icon} name="plus" size=${17} /><span class="max-sm:hidden">הוצאה</span><//>
                    <button type="button" onClick=${() => setSheet({ type: 'settings' })} title="הגדרות הלוח" aria-label="הגדרות הלוח" class="inline-flex h-11 w-11 items-center justify-center rounded-xl text-muted hover:bg-white hover:text-brand-600 cursor-pointer"><${Icon} name="settings-2" size=${19} /></button>
                  </div>
                </div>

                <${Kpis} state=${state} onBalance=${() => setSheet({ type: 'balance' })} />

                ${list.filter((a) => !a.id.startsWith('month-')).length > 0 &&
                html`<ul class="flex flex-col gap-2" aria-label="דורש תשומת לב">
                  ${list.filter((a) => !a.id.startsWith('month-')).slice(0, 3).map((a) => html`<${AlertRow} key=${a.id} a=${a} onAct=${act} />`)}
                </ul>`}

                <div class="grid gap-4 md:gap-5 lg:grid-cols-[minmax(0,1fr)_370px]">
                  <${ChartPanel} state=${state} insight=${insight} />
                  <${Next30} state=${state} onPaid=${markPaid} onRemind=${remind} />
                </div>

                <div ref=${tabsRef} class="scroll-mt-4">
                  <${Tabs} tab=${tab} onTab=${setTab}>
                    ${tab === 'week' && html`<${WeekTable} state=${state} />`}
                    ${tab === 'payments' && html`<${PaymentsTab} state=${state} onPaid=${markPaid} onRemind=${remind} onNewDeal=${() => setSheet({ type: 'deal' })} />`}
                    ${tab === 'expenses' && html`<${ExpensesTab} state=${state} onEdit=${(x) => setSheet({ type: 'expense', expense: x })} onAdd=${() => setSheet({ type: 'expense' })} onSettings=${() => setSheet({ type: 'settings' })} />`}
                  <//>
                </div>
              </div>`}
        </div>
      </main>
      <${PartnerBubble}
        message=${sharkMsg}
        mood=${sharkMood}
        unread=${!read.has(sharkMsg)}
        onRead=${() => setRead((s) => new Set(s).add(sharkMsg))}
        action=${top?.action && state.setupDone
          ? html`<div class="mt-2.5 flex items-center gap-3"><${Button} variant="mini" onClick=${() => act(top)}>${top.action === 'remind' ? 'תזכורת ב-WhatsApp' : top.action === 'paid' ? 'התקבל' : 'לעסקאות הפתוחות'}<//></div>`
          : null}
      />
    </div>

    <nav class="no-print pb-safe z-20 flex shrink-0 items-stretch justify-around border-t border-line bg-surface px-1 pt-1.5 lg:hidden" aria-label="ניווט ראשי">
      ${NAV.filter(([id]) => MOBILE_NAV.includes(id))
        .sort((a, b) => MOBILE_NAV.indexOf(a[0]) - MOBILE_NAV.indexOf(b[0]))
        .map(
          ([id, label, icon]) => html`<button
            key=${id}
            type="button"
            onClick=${() => onNav(id)}
            aria-current=${id === 'finance' ? 'page' : undefined}
            class=${cx('relative flex min-w-[60px] flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-[12px] font-bold cursor-pointer', id === 'finance' ? 'text-brand-600' : 'text-muted')}
          >
            <span class=${cx('flex h-8 w-12 items-center justify-center rounded-full', id === 'finance' && 'bg-brand-100')}><${Icon} name=${icon} size=${20} /></span>
            ${label}
          </button>`,
        )}
    </nav>

    ${EMBED &&
    html`<div class="flex h-6 shrink-0 items-center justify-center bg-surface" aria-hidden="true">
      <span class="h-[5px] w-32 rounded-full bg-ink/80"></span>
    </div>`}

    ${sheet?.type === 'remind' &&
    html`<${RemindSheet}
      deal=${sheet.deal}
      payment=${sheet.payment}
      onClose=${() => setSheet(null)}
      onSend=${() => {
        update((s) => (s.reminders[sheet.payment.id] = TODAY));
        setSheet(null);
        showToast(`כאן נפתח WhatsApp עם ההודעה ל${sheet.deal.client}`, 'message-circle');
      }}
    />`}
    ${sheet?.type === 'balance' &&
    html`<${BalanceSheet}
      state=${state}
      onClose=${() => setSheet(null)}
      onSave=${(v) => {
        const diff = v - balanceOn(state, TODAY);
        if (diff) update((s) => s.adjustments.push({ date: TODAY, amount: diff }));
        setSheet(null);
        showToast(diff ? `היתרה עודכנה · ${signed(diff)} נרשמו כעדכון יתרה` : 'היתרה אושרה', 'check');
      }}
    />`}
    ${sheet?.type === 'expense' &&
    html`<${ExpenseSheet}
      expense=${sheet.expense}
      onClose=${() => setSheet(null)}
      onSave=${(x) => {
        update((s) => {
          if (x.id) s.expenses = s.expenses.map((o) => (o.id === x.id ? x : o));
          else s.expenses.push({ ...x, id: `x${Date.now()}` });
        });
        setSheet(null);
        showToast(x.id ? 'ההוצאה עודכנה' : 'ההוצאה נוספה · היא כבר בגרף', 'check');
      }}
      onDelete=${(x) => {
        const before = clone(state);
        update((s) => (s.expenses = s.expenses.filter((o) => o.id !== x.id)));
        setSheet(null);
        showToast(`"${x.name}" נמחקה`, 'trash-2', () => setState(before));
      }}
    />`}
    ${sheet?.type === 'deal' &&
    html`<${DealSheet}
      state=${state}
      onClose=${() => setSheet(null)}
      onSave=${(d) => {
        update((s) => {
          const id = `d${Date.now()}`;
          const monthly = termsOf(d.terms).n === 0;
          s.deals.push({
            id,
            client: d.client,
            phone: '050-0000000',
            product: d.product,
            total: d.total,
            terms: d.terms,
            closed: TODAY,
            ...(monthly ? { monthly: { amount: d.total, day: Number(d.first.slice(8)), from: d.first } } : {}),
            payments: monthly ? [] : d.plan.map((p, i) => ({ id: `${id}-${i + 1}`, due: p.due, amount: p.amount, paidOn: null })),
          });
          if (d.fromOpen) s.openDeals = s.openDeals.filter((o) => o.id !== d.fromOpen);
        });
        setSheet(null);
        setTab('payments');
        showToast(`לוח התשלומים של ${d.client} נכנס לגרף`, 'check');
      }}
    />`}
    ${sheet?.type === 'settings' &&
    html`<${SettingsSheet}
      state=${state}
      onClose=${() => setSheet(null)}
      onSave=${(v) => {
        update((s) => Object.assign(s, v));
        setSheet(null);
        showToast('ההגדרות נשמרו', 'check');
      }}
    />`}

    <${DevPanel} open=${dev} onClose=${() => setDev(false)} scenario=${scenarioId} onScenario=${setScenario} />
    <${Toast} toast=${toast} onUndo=${() => {
      toast?.undo?.();
      setToast(null);
    }} />
  </div>`;
}

function Root() {
  const [view, setView] = useState(readView);
  useEffect(() => applyPhoneViewport(view), [view]);
  const change = (v) => {
    saveView(v);
    setView(v);
  };
  if (!EMBED && !IS_PHONE && view === 'mobile') return html`<${PhonePreview} onSwitch=${change} />`;
  return html`<${App} view=${view} onViewChange=${change} />`;
}

applyPhoneViewport(readView());
render(html`<${Root} />`, document.getElementById('app'));
