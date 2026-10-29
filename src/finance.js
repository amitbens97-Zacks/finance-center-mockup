// The finance center's numbers, all computed in code (never by the model).
//
// Rules (see the task document):
//   - "בקופה" = the opening balance, plus payments marked as received, minus fixed
//     expenses on their charge day, plus manual balance corrections. Only what
//     happened after the opening date counts.
//   - The expected cash is built only from payments that were scheduled. An overdue
//     payment leaves the forecast until it is received. Open deals are shown apart,
//     as a range, and never inside the expected cash.
//   - Net profit = money in, minus expenses, minus the tax provision (a % of money in).
//   - Setup payments (one-time items of the setup budget) leave the cash on the day paid.
import { TODAY, GOAL, WEEK_TARGET, PRODUCTS, TERMS, STAGES } from './data.js';

// ---------- dates as 'YYYY-MM-DD' ----------

export const toDate = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const iso = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
export const addDays = (s, n) => {
  const dt = toDate(s);
  dt.setDate(dt.getDate() + n);
  return iso(dt);
};
export const addMonths = (s, n, day) => {
  const dt = toDate(s);
  const want = day ?? dt.getDate();
  const t = new Date(dt.getFullYear(), dt.getMonth() + n, 1);
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  t.setDate(Math.min(want, last));
  return iso(t);
};
export const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);
export const monthKey = (s) => s.slice(0, 7);
export const dm = (s) => {
  const dt = toDate(s);
  return `${dt.getDate()}.${dt.getMonth() + 1}`;
};
const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export const monthName = (s) => MONTHS[toDate(s.length === 7 ? `${s}-01` : s).getMonth()];
export const dayName = (i) => DAYS[i];
export const monthStart = (s) => `${monthKey(s)}-01`;
export const monthEnd = (s) => addDays(addMonths(monthStart(s), 1), -1);

export const productOf = (id) => PRODUCTS.find((p) => p.id === id);
export const termsOf = (id) => TERMS.find((t) => t.id === id);

// ---------- what each record turns into, between two dates (inclusive) ----------

export function expenseDates(x, from, to) {
  const out = [];
  if (x.freq === 'once') {
    if (x.day >= from && x.day <= to) out.push(x.day);
    return out;
  }
  if (x.freq === 'weekly') {
    let d = from;
    const shift = (x.day - toDate(d).getDay() + 7) % 7;
    d = addDays(d, shift);
    for (; d <= to; d = addDays(d, 7)) out.push(d);
    return out;
  }
  if (x.freq === 'yearly') {
    for (let y = toDate(from).getFullYear(); y <= toDate(to).getFullYear(); y++) {
      const d = `${y}-${x.day}`;
      if (d >= from && d <= to) out.push(d);
    }
    return out;
  }
  // monthly
  for (let m = monthStart(from); m <= to; m = addMonths(m, 1, 1)) {
    const d = addMonths(m, 0, x.day);
    if (d >= from && d <= to) out.push(d);
  }
  return out;
}

// Monthly cost of an expense, for the "בחודש" total.
export const monthlyCost = (x) =>
  x.freq === 'monthly' ? x.amount : x.freq === 'weekly' ? (x.amount * 52) / 12 : x.freq === 'yearly' ? x.amount / 12 : 0;

export function freqText(x) {
  if (x.freq === 'monthly') return `כל חודש ב-${x.day}`;
  if (x.freq === 'weekly') return `כל יום ${dayName(x.day)}`;
  if (x.freq === 'yearly') {
    const [m, d] = x.day.split('-').map(Number);
    return `פעם בשנה ב-${d}.${m}`;
  }
  return `פעם אחת ב-${dm(x.day)}`;
}

// All payments of a deal up to a date. A monthly subscription repeats until cancelled.
export function dealPayments(deal, to) {
  if (!deal.monthly) return deal.payments;
  const out = [...deal.payments];
  for (let d = deal.monthly.from; d <= to; d = addMonths(d, 1, deal.monthly.day)) {
    const id = `${deal.id}-${d}`;
    if (!out.some((p) => p.id === id)) out.push({ id, due: d, amount: deal.monthly.amount, paidOn: deal.paidMonthly?.[d] ?? null });
  }
  return out.sort((a, b) => (a.due < b.due ? -1 : 1));
}

export const paymentStatus = (p) => (p.paidOn ? 'paid' : p.due < TODAY ? 'late' : 'due');

// Every cash event between two dates. kind: in | out | fix. sure: false = open deal.
export function events(state, from, to) {
  const ev = [];
  for (const deal of state.deals) {
    for (const p of dealPayments(deal, to)) {
      const st = paymentStatus(p);
      const date = p.paidOn || p.due;
      if (date < from || date > to) continue;
      // Received payments count on the day received; overdue ones are out of the
      // forecast until received; scheduled ones count on their due date.
      if (st === 'late') continue;
      // Due today and not received yet: not in the till; it is in the list as "היום".
      if (st === 'due' && p.due === TODAY) continue;
      ev.push({ date, amount: p.amount, kind: 'in', sure: true, label: deal.client, deal, payment: p, status: st });
    }
  }
  for (const x of state.expenses) {
    for (const d of expenseDates(x, from, to)) ev.push({ date: d, amount: -x.amount, kind: 'out', sure: true, label: x.name, expense: x });
  }
  for (const s of state.setup || []) if (s.spent > 0 && s.spentOn && s.spentOn >= from && s.spentOn <= to) ev.push({ date: s.spentOn, amount: -s.spent, kind: 'out', sure: true, label: s.name, setupItem: s });
  for (const a of state.adjustments) if (a.date >= from && a.date <= to) ev.push({ date: a.date, amount: a.amount, kind: 'fix', sure: true, label: 'עדכון יתרה' });
  return ev.sort((a, b) => (a.date < b.date ? -1 : 1));
}

// The open deals as cash, if they close: their payments by their own terms.
export function maybeEvents(state, to) {
  const ev = [];
  for (const o of state.openDeals) {
    const t = termsOf(o.terms);
    const n = t.n || 0;
    if (n === 0) {
      for (let d = o.expected; d <= to; d = addMonths(d, 1)) ev.push({ date: d, amount: o.total, deal: o });
    } else {
      for (let i = 0; i < n; i++) {
        const d = addMonths(o.expected, i);
        if (d <= to) ev.push({ date: d, amount: Math.round(o.total / n), deal: o });
      }
    }
  }
  return ev;
}

// The balance on each day from the opening date to `to`.
export function series(state, to) {
  if (state.opening.amount == null) return [];
  const from = addDays(state.opening.date, 1);
  const ev = events(state, from, to);
  const maybe = maybeEvents(state, to);
  const out = [{ date: state.opening.date, bal: state.opening.amount, maybe: state.opening.amount, ev: [] }];
  let bal = state.opening.amount;
  let extra = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const todays = ev.filter((e) => e.date === d);
    for (const e of todays) bal += e.amount;
    for (const m of maybe) if (m.date === d && d > TODAY) extra += m.amount;
    out.push({ date: d, bal, maybe: bal + extra, ev: todays });
  }
  return out;
}

export const balanceOn = (state, date) => {
  const s = series(state, date);
  return s.length ? s[s.length - 1].bal : null;
};

// ---------- this month ----------

export function monthSummary(state, anyDay = TODAY) {
  const from = monthStart(anyDay);
  const to = monthEnd(anyDay);
  let received = 0;
  let pending = 0;
  const pendingList = [];
  for (const deal of state.deals) {
    for (const p of dealPayments(deal, to)) {
      if (p.paidOn && p.paidOn >= from && p.paidOn <= to) received += p.amount;
      else if (!p.paidOn && p.due >= from && p.due <= to) {
        pending += p.amount;
        pendingList.push({ ...p, client: deal.client });
      }
    }
  }
  const expenses = state.expenses.reduce((s, x) => s + expenseDates(x, from, to).length * x.amount, 0);
  const tax = Math.round((received * state.taxPct) / 100);
  const net = received - expenses - tax;
  const goal = goalOf(state);
  return { from, to, received, pending, pendingList, expenses, tax, out: expenses + tax, net, goal, gap: Math.max(0, goal - net) };
}

// Sure money in for a whole month (received + scheduled, not overdue).
export function monthIncome(state, anyDay) {
  const from = monthStart(anyDay);
  const to = monthEnd(anyDay);
  let sure = 0;
  for (const deal of state.deals)
    for (const p of dealPayments(deal, to)) {
      const d = p.paidOn || p.due;
      if (d >= from && d <= to && paymentStatus(p) !== 'late') sure += p.amount;
    }
  const expenses = state.expenses.reduce((s, x) => s + expenseDates(x, from, to).length * x.amount, 0);
  const tax = Math.round((sure * state.taxPct) / 100);
  return { sure, expenses, tax, net: sure - expenses - tax };
}

// ---------- the next 30 days ----------

export function next30(state) {
  const to = addDays(TODAY, 30);
  const late = [];
  for (const deal of state.deals)
    for (const p of dealPayments(deal, to)) {
      const st = paymentStatus(p);
      if (st === 'late' || (st === 'due' && p.due === TODAY)) late.push({ date: p.due, amount: p.amount, kind: 'in', label: deal.client, deal, payment: p, status: st === 'late' ? 'late' : 'today' });
    }
  const coming = events(state, addDays(TODAY, 1), to).filter((e) => e.kind !== 'fix');
  const maybe = maybeEvents(state, to).filter((m) => m.date > TODAY);
  const firstMaybe = state.openDeals.map((o) => ({ deal: o, date: o.expected, amount: o.total })).filter((m) => m.date <= to || maybe.some((x) => x.deal === m.deal));
  return { late, coming, maybe: firstMaybe };
}

// ---------- reminders: an event of the business, each with one action ----------

export function alerts(state) {
  if (!state.setupDone) return [];
  const out = [];
  const n = next30(state);
  for (const l of n.late.filter((x) => x.status === 'late')) {
    const days = daysBetween(l.date, TODAY);
    out.push({
      id: `late-${l.payment.id}`,
      tone: 'error',
      icon: 'circle-alert',
      title: `תשלום באיחור · ${l.label}`,
      text: `${paymentLabel(l.deal, l.payment)} · ${fmt(l.amount)} · היה אמור להיכנס ב-${dm(l.date)} (לפני ${days} ימים)`,
      action: 'remind',
      payment: l.payment,
      deal: l.deal,
    });
  }
  const active = state.stage === 'active';
  const s = active ? series(state, addDays(TODAY, 60)) : [];
  const today = s.find((d) => d.date === TODAY);
  if (today && today.bal < state.cushion)
    out.push({ id: 'cushion-now', tone: 'warn', icon: 'shield-alert', title: 'הקופה מתחת לכרית הביטחון', text: `בקופה ${fmt(today.bal)}, והכרית היא ${fmt(state.cushion)}.`, action: state.openDeals.length ? 'deals' : null });
  else {
    const dip = s.find((d) => d.date > TODAY && d.bal < state.cushion);
    if (dip) out.push({ id: 'cushion-soon', tone: 'warn', icon: 'shield-alert', title: `ב-${dm(dip.date)} הקופה תרד מתחת לכרית`, text: `לפי התשלומים שנקבעו: ${fmt(dip.bal)}, והכרית היא ${fmt(state.cushion)}.`, action: state.openDeals.length ? 'deals' : null });
  }
  const soon = [...n.late.filter((x) => x.status === 'today'), ...n.coming.filter((e) => e.kind === 'in' && daysBetween(TODAY, e.date) <= 3)];
  for (const e of soon)
    out.push({
      id: `soon-${e.payment.id}`,
      tone: 'info',
      icon: 'bell',
      title: `${e.label} · תשלום מגיע ${['היום', 'מחר'][daysBetween(TODAY, e.date)] || `ב-${dm(e.date)}`}`,
      text: `${paymentLabel(e.deal, e.payment)} · ${fmt(e.amount)}`,
      action: 'remind',
      payment: e.payment,
      deal: e.deal,
    });
  // The first month ahead with no sure income above its expenses.
  for (let i = 1; i <= 2 && active; i++) {
    const m = addMonths(monthStart(TODAY), i, 1);
    const inc = monthIncome(state, m);
    if (inc.sure === 0 || inc.net < goalOf(state) / 4) {
      const open = state.openDeals.reduce((t, o) => t + o.total, 0);
      out.push({
        id: `month-${m}`,
        tone: 'info',
        icon: 'calendar-x',
        title: inc.sure === 0 ? `ל${monthName(m)} עוד אין אף תשלום שנקבע` : `ל${monthName(m)} נקבעו רק ${fmt(inc.sure)}`,
        text: open ? `חסרים ${fmt(Math.max(0, goalOf(state) - inc.net))} ליעד. יש ${state.openDeals.length} עסקאות פתוחות, עד ${fmt(open)}.` : `חסרים ${fmt(Math.max(0, goalOf(state) - inc.net))} ליעד.`,
        action: open ? 'deals' : null,
      });
      break;
    }
  }
  return out;
}

export const ACTION_LABEL = { remind: 'תזכורת ב-WhatsApp', paid: 'התקבל', deals: 'לעסקאות הפתוחות' };

export function paymentLabel(deal, p) {
  if (deal.monthly) return `מנוי חודשי · ${monthName(p.due)}`;
  const i = deal.payments.findIndex((x) => x.id === p.id);
  return deal.payments.length > 1 ? `תשלום ${i + 1} מתוך ${deal.payments.length}` : 'תשלום אחד';
}

// ---------- the week in numbers ----------

export function weeks(state) {
  return state.crmWeeks.map((w) => {
    const end = addDays(w.start, 6);
    const closes = state.deals.filter((d) => d.closed >= w.start && d.closed <= end).length;
    let income = 0;
    for (const deal of state.deals) for (const p of dealPayments(deal, end)) if (p.paidOn && p.paidOn >= w.start && p.paidOn <= end) income += p.amount;
    const last = end < TODAY ? end : TODAY;
    const marketing = state.expenses
      .filter((x) => x.category === 'marketing')
      .reduce((s, x) => s + expenseDates(x, w.start, last).length * x.amount, 0);
    return { ...w, end, current: w.start <= TODAY && TODAY <= end, closes, income, marketing };
  });
}

export const WEEK_ROWS = [
  { id: 'leads', label: 'לידים', target: WEEK_TARGET.leads },
  { id: 'calls', label: 'שיחות', target: WEEK_TARGET.calls },
  { id: 'closes', label: 'סגירות', target: WEEK_TARGET.closes },
  { id: 'income', label: 'הכנסה', target: WEEK_TARGET.income, money: true },
  { id: 'marketing', label: 'הוצאות שיווק', money: true },
];

// ---------- a new deal's payment schedule, by the terms of the offer ----------

export function schedule(total, terms, first) {
  const t = termsOf(terms);
  if (t.n === 0) return [{ due: first, amount: total, monthly: true }];
  const each = Math.floor(total / t.n);
  return Array.from({ length: t.n }, (_, i) => ({ due: addMonths(first, i), amount: i === t.n - 1 ? total - each * (t.n - 1) : each }));
}

const nf = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 });
export const fmt = (n) => `${nf.format(Math.round(n))} ₪`;
// The sign stays next to the number in RTL text (an LTR isolate around sign + number).
// A WhatsApp chat with a client: wa.me needs the number in international form
// (050-1234567 -> 972501234567). With text, the message is already typed in the chat;
// the user still presses send. No API and no WhatsApp Business account needed.
export function waLink(phone, text) {
  let n = String(phone || '').replace(/\D/g, '');
  if (n.startsWith('0')) n = `972${n.slice(1)}`;
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
export const signed = (n) => `⁦${n >= 0 ? '+' : '−'}${nf.format(Math.abs(Math.round(n)))}⁩ ₪`;

// ---------- stages ----------

export const stageOf = (id) => STAGES.find((s) => s.id === id);

// Consecutive months with money received, counting back from this month (or from
// last month, when nothing came in yet this month).
export function incomeStreak(state) {
  const months = new Set();
  for (const deal of state.deals) for (const p of dealPayments(deal, TODAY)) if (p.paidOn) months.add(monthKey(p.paidOn));
  let m = monthStart(TODAY);
  if (!months.has(monthKey(m))) m = addMonths(m, -1, 1);
  let n = 0;
  while (months.has(monthKey(m))) {
    n += 1;
    m = addMonths(m, -1, 1);
  }
  return n;
}

// What the data says, for the first-entry question and for moving on.
export function guessStage(state) {
  if (!state.deals.length) return 'setup';
  return incomeStreak(state) >= 3 ? 'active' : 'first';
}

// The stage the data suggests moving to (the user confirms), or null.
export function stageSuggestion(state) {
  if (state.stage === 'setup' && state.deals.length > 0) return 'first';
  if (state.stage === 'first' && incomeStreak(state) >= 3) return 'active';
  return null;
}

// ---------- the setup budget, the runway and the break-even point ----------

// The monthly goal ("כמה כסף צריך להישאר לך בכל חודש?"), editable on the page.
export const goalOf = (state) => state.goal ?? GOAL;
export const monthlyFixed = (state) => state.expenses.reduce((s, x) => s + monthlyCost(x), 0);

// The setup budget. `budget` is the total the user set (the slider), `allocated` is
// what the items add up to. The part not yet split into items still counts as money
// that will be spent, so it is inside "נשאר לשלם" and shortens how long the money lasts.
export function setupSummary(state) {
  const items = state.setup || [];
  const allocated = items.reduce((t, x) => t + x.planned, 0);
  const budget = state.setupBudget ?? allocated;
  const spent = items.reduce((t, x) => t + x.spent, 0);
  const over = items.reduce((t, x) => t + Math.max(0, x.spent - x.planned), 0);
  // The part of the budget not split into items is a reserve: an item that went over its
  // plan takes from it first, so raising the budget can cover an overrun.
  const unallocated = Math.max(0, budget - allocated - over);
  // What is still to pay: the rest of every item that is not done, plus the reserve.
  const remaining = items.filter((x) => !x.done).reduce((t, x) => t + Math.max(0, x.planned - x.spent), 0) + unallocated;
  // What the setup will cost in the end, and how much of that is past the budget.
  const final = spent + remaining;
  const overBudget = Math.max(0, final - budget);
  const overItems = items.filter((x) => x.spent > x.planned).map((x) => ({ ...x, over: x.spent - x.planned }));
  return { items, planned: budget, budget, allocated, unallocated, spent, remaining, over, final, overBudget, overItems, done: items.filter((x) => x.done).length };
}

// How long the money lasts: the cash today, minus what is left to pay for the setup,
// then every fixed expense (and every scheduled payment from a client) by its date.
export function runway(state) {
  const now = balanceOn(state, TODAY);
  const left = setupSummary(state).remaining;
  const after = now - left;
  const monthly = Math.round(monthlyFixed(state));
  let until = after < 0 ? TODAY : null;
  if (!until)
    for (const d of series(state, addMonths(TODAY, 36))) {
      if (d.date > TODAY && d.bal - left < 0) {
        until = addDays(d.date, -1);
        break;
      }
    }
  return { now, left, after, monthly, until, months: until ? Math.max(0, daysBetween(TODAY, until) / 30.44) : null };
}

// How much has to come in each month: to cover the fixed expenses, and to reach the goal
// (both after the tax provision). Per product: how many sales a month that is.
export function breakEven(state) {
  const keep = 1 - state.taxPct / 100;
  const monthly = Math.round(monthlyFixed(state));
  const cover = Math.ceil(monthly / keep);
  const goal = Math.ceil((goalOf(state) + monthly) / keep);
  const products = PRODUCTS.map((p) => ({ ...p, cover: Math.max(1, Math.ceil(cover / p.price)), goal: Math.ceil(goal / p.price) }));
  return { monthly, cover, goal, products };
}

// Ready to take money from the first client.
export function readiness(state) {
  return [
    { id: 'products', label: 'מחירים בסל המוצרים', done: PRODUCTS.length > 0, text: `${PRODUCTS.length} מוצרים בתשלום, מ"סל מוצרים"` },
    { id: 'entity', label: 'סוג עוסק ואחוז מס', done: !!state.entity, text: state.entity === 'licensed' ? 'עוסק מורשה, מאזור רואה החשבון' : 'עוסק פטור, מאזור רואה החשבון' },
    { id: 'pay', label: 'איך הלקוח משלם לך', done: !!state.payMethod, text: state.payMethod ? 'נכנס לכל תזכורת ללקוח' : 'ביט, פייבוקס, העברה או אשראי', action: 'pay' },
    { id: 'bank', label: 'חשבון בנק נפרד לעסק', done: !!state.bankAccount, text: state.bankAccount ? 'הכסף של העסק לא מתערבב עם הפרטי' : 'כדי שהכסף של העסק לא יתערבב עם הפרטי', action: 'bank' },
  ];
}
