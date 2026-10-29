// "המרכז הפיננסי" adapts to the stage of the business:
//   1. הקמה           - no paying clients yet: the setup budget, how long the money lasts,
//                        the break-even point, getting ready for the first client
//   2. לקוחות ראשונים - payments from the first clients, what is left this month
//   3. עסק פעיל        - the full cash flow
// The first entry asks where the business is (the data pre-selects the answer). Later
// the data suggests moving on: the first deal closed, or 3 months in a row with income.
// The user confirms. Every board opens with one "next step" note with one button.
import { html, render, useState, useEffect, useRef, Icon, PencilCheck, cx } from './lib.js';
import { Button, Toast, Logo, PartnerBubble } from './components.js';
import { DevPanel } from './devnotes.js';
import { Field, MoneyInput, Tag, inputCls, BoardHeading, StageTrack, NextStep } from './ui.js';
import { SetupBoard, FirstBoard, ActiveBoard } from './boards.js';
import {
  RemindSheet, BalanceSheet, ExpenseSheet, SetupItemSheet, PayMethodSheet, DealSheet,
  SettingsSheet, StagesSheet, MoveToActiveSheet,
} from './sheets.js';
import { TODAY, USER, ENTITIES, FREQS, STAGES, SCENARIOS, DEFAULT_SCENARIO } from './data.js';
import {
  addDays, dm, monthName, toDate, dayName, fmt, signed, balanceOn, alerts, paymentStatus, termsOf,
  freqText, monthlyCost, monthSummary, setupSummary, runway, breakEven, readiness, stageSuggestion,
  guessStage, incomeStreak, ACTION_LABEL,
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
const SHEETS = ['deal', 'remind', 'balance', 'expense', 'settings', 'stages', 'pay', 'item', 'active'];
const clone = (o) => JSON.parse(JSON.stringify(o));
const monthYear = (s) => `${monthName(s)} ${toDate(s).getFullYear()}`;

const HEADINGS = {
  setup: { title: ['התקציב של ', 'ההקמה'], sub: 'כמה תכננת, כמה כבר שילמת, וכמה זמן הכסף מחזיק עד הלקוח הראשון.' },
  first: { title: ['הלקוחות הראשונים, ', 'והכסף שהם מביאים'], sub: 'מה התקבל, מה באיחור, ומה נשאר לך החודש.' },
  active: { title: ['הכסף של העסק, ', 'בזמן אמת'], sub: 'מה יש בקופה, מה נכנס ויוצא, ואיך תיראה הקופה בחודשים הבאים.' },
};

// ---------- first entry: where is the business, then 2-3 short questions ----------

function Onboarding({ state, onDone }) {
  const guess = guessStage(state);
  const [stage, setStage] = useState(null);
  const [i, setI] = useState(0);
  const [amount, setAmount] = useState(null);
  const [paid, setPaid] = useState(() => new Set());
  const [exps, setExps] = useState(state.expenses);
  const monthly = Math.round(exps.reduce((s, x) => s + monthlyCost(x), 0));
  const [cushion, setCushion] = useState(null);
  const [taxPct, setTax] = useState(ENTITIES[state.entity].taxPct);
  const QUESTIONS = {
    setup: ['השלב', 'הכסף לעסק', 'תקציב ההקמה'],
    first: ['השלב', 'הכסף לעסק', 'ההוצאות הקבועות'],
    active: ['השלב', 'היתרה בבנק', 'ההוצאות הקבועות', 'כרית ומס'],
  };
  const steps = QUESTIONS[stage || guess];
  const last = i === steps.length - 1;
  const finish = () => onDone({ stage, amount, paid, expenses: exps, cushion: cushion ?? monthly * 2, taxPct });
  const next = () => (last ? finish() : setI(i + 1));
  const off = (i === 0 && !stage) || (i === 1 && amount == null);
  // A single choice moves on by itself.
  const pick = (id) => {
    setStage(id);
    setTimeout(() => setI(1), 220);
  };
  useEffect(() => {
    const k = (e) => e.key === 'Enter' && !off && document.activeElement?.tagName !== 'SELECT' && next();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });
  const dataHint = state.deals.length === 0 ? 'בלידים עוד לא נסגרה אף עסקה' : `בלידים נסגרו ${state.deals.length} עסקאות, ${incomeStreak(state)} חודשים ברציפות עם הכנסה`;
  return html`<div class="mx-auto max-w-[680px]">
    <div class="mb-4 flex items-center gap-3">
      <div class="flex flex-1 gap-1.5">${steps.map((s, k) => html`<span key=${s} class=${cx('h-2 flex-1 rounded-full', k < i ? 'bg-brand-600' : k === i ? 'bg-brand-300' : 'bg-line')}></span>`)}</div>
      <span class="text-[12px] font-bold text-muted">${steps[i]} · ${i + 1}/${steps.length}</span>
    </div>
    <section class="rise fb-panel !p-5 md:!p-7" key=${i}>
      ${i === 0 &&
      html`<span class="fb-eyebrow">המרכז הפיננסי · כ-2 דקות</span>
        <h1 class="fb-h1 mt-1 text-[26px] md:text-[32px]">איפה <span class="fb-marker">העסק עומד</span> היום?</h1>
        <p class="mt-2 text-[16px] text-ink">לפי התשובה נראה לך רק את מה שחשוב עכשיו. כשהעסק יתקדם, נציע לעבור לשלב הבא.</p>
        <div class="mt-5 flex flex-col gap-2.5" role="radiogroup">
          ${STAGES.map(
            (s) => html`<button
              key=${s.id}
              type="button"
              role="radio"
              aria-checked=${stage === s.id}
              onClick=${() => pick(s.id)}
              class=${cx('fb-tile !items-start !gap-3 !px-4 !py-3.5 text-start', stage === s.id && 'is-on')}
            >
              <span class=${cx('grid h-10 w-10 shrink-0 place-items-center rounded-xl border-2 font-display text-[18px] font-extrabold', stage === s.id ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white text-ink')}>${s.n}</span>
              <span class="min-w-0 flex-1">
                <span class="flex flex-wrap items-center gap-2"><b class="!text-[17px]">${s.who}</b>${s.id === guess && html`<${Tag} tone="due">לפי הנתונים<//>`}</span>
                <span class="mt-0.5 block text-[14px] leading-relaxed text-muted">${s.label}: ${s.shows}</span>
              </span>
            </button>`,
          )}
        </div>
        <p class="mt-3 flex items-center gap-1.5 text-[13px] font-semibold text-sky-text"><${Icon} name="info" size=${15} />${dataHint}.</p>`}
      ${i === 1 &&
      html`<span class="fb-eyebrow">שלב ${STAGES.find((s) => s.id === stage).n}: ${STAGES.find((s) => s.id === stage).label}</span>
        <h1 class="fb-h1 mt-1 text-[26px] md:text-[32px]">${stage === 'active' ? html`כמה יש היום <span class="fb-marker">בחשבון העסק</span>?` : html`כמה כסף <span class="fb-marker">יש היום לעסק</span>?`}</h1>
        <p class="mt-2 text-[16px] text-ink">${stage === 'setup' ? 'הכסף ששמת בצד לעסק, אחרי מה שכבר שילמת. ממנו נחשב כמה זמן הכסף מחזיק.' : 'מהמספר הזה נבנית הקופה. כל תשלום שמסומן "התקבל" מוסיף לה, וכל הוצאה יורדת ממנה ביום החיוב.'}</p>
        <div class="mt-5 max-w-[320px]"><${MoneyInput} value=${amount} onInput=${setAmount} big autofocus /></div>
        <p class="mt-2 text-[12px] text-muted">אפשר לבדוק באפליקציה של הבנק. פעם בחודש נבקש לאשר את המספר.</p>`}
      ${i === 2 &&
      stage === 'setup' &&
      html`<span class="fb-eyebrow">שלב 1: הקמה</span>
        <h1 class="fb-h1 mt-1 text-[26px] md:text-[32px]">מה כבר <span class="fb-marker">שילמת</span> מההקמה?</h1>
        <p class="mt-2 flex items-center gap-1.5 text-[14px] font-semibold text-sky-text"><${Icon} name="pencil" size=${14} />הפריטים מהתקציב שבנית ב"העסק במספרים". לסמן מה כבר שולם.</p>
        <ul class="mt-4 flex flex-col gap-2">
          ${state.setup.map(
            (x) => html`<li key=${x.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked=${paid.has(x.id)}
                onClick=${() => setPaid((p) => {
                  const n = new Set(p);
                  n.has(x.id) ? n.delete(x.id) : n.add(x.id);
                  return n;
                })}
                class=${cx('flex min-h-[52px] w-full items-center gap-3 rounded-xl border-[1.5px] bg-white px-3 py-2 text-start cursor-pointer', paid.has(x.id) ? 'border-brand-600' : 'border-line')}
              >
                <span class=${cx('grid h-6 w-6 place-items-center rounded-md border-2', paid.has(x.id) ? 'border-ink' : 'border-line')}>${paid.has(x.id) && html`<${PencilCheck} size=${16} color="#0038b8" weight=${3} />`}</span>
                <b class="flex-1 text-[15px]">${x.name}</b>
                <span class="font-display text-[15px] font-extrabold tabular-nums">${fmt(x.planned)}</span>
              </button>
            </li>`,
          )}
        </ul>`}
      ${i === 2 &&
      stage !== 'setup' &&
      html`<span class="fb-eyebrow">שלב ${STAGES.find((s) => s.id === stage).n}: ${STAGES.find((s) => s.id === stage).label}</span>
        <h1 class="fb-h1 mt-1 text-[26px] md:text-[32px]">מתי יורדות <span class="fb-marker">ההוצאות הקבועות</span>?</h1>
        <p class="mt-2 flex items-center gap-1.5 text-[14px] font-semibold text-sky-text"><${Icon} name="pencil" size=${14} />מילאנו לפי התקציב שבנית ב"העסק במספרים". רק לבדוק את יום החיוב.</p>
        <ul class="mt-4 flex flex-col divide-y divide-line">
          ${exps.map(
            (x, k) => html`<li key=${x.id} class="flex flex-wrap items-center gap-2 py-2.5">
              <span class="min-w-0 flex-1"><b class="block text-[14px]">${x.name}</b><span class="font-display text-[14px] font-extrabold tabular-nums">${fmt(x.amount)}</span></span>
              <select class=${cx(inputCls, '!h-11 !w-auto !text-[14px]')} value=${x.freq} onChange=${(e) => setExps(exps.map((o, j) => (j === k ? { ...o, freq: e.target.value, day: e.target.value === 'weekly' ? 0 : e.target.value === 'yearly' ? '01-01' : 1 } : o)))}>
                ${FREQS.filter((f) => f.id !== 'once').map((f) => html`<option value=${f.id}>${f.label}</option>`)}
              </select>
              ${x.freq === 'monthly' && html`<select class=${cx(inputCls, '!h-11 !w-auto !text-[14px]')} value=${x.day} onChange=${(e) => setExps(exps.map((o, j) => (j === k ? { ...o, day: Number(e.target.value) } : o)))}>${Array.from({ length: 28 }, (_, d) => html`<option value=${d + 1}>ב-${d + 1} לחודש</option>`)}</select>`}
              ${x.freq === 'weekly' && html`<select class=${cx(inputCls, '!h-11 !w-auto !text-[14px]')} value=${x.day} onChange=${(e) => setExps(exps.map((o, j) => (j === k ? { ...o, day: Number(e.target.value) } : o)))}>${Array.from({ length: 7 }, (_, d) => html`<option value=${d}>יום ${dayName(d)}</option>`)}</select>`}
              ${x.freq === 'yearly' && html`<span class="text-[14px] text-muted">${freqText(x).replace('פעם בשנה ', '')}</span>`}
            </li>`,
          )}
        </ul>`}
      ${i === 3 &&
      html`<span class="fb-eyebrow">שלב 3: עסק פעיל</span>
        <h1 class="fb-h1 mt-1 text-[26px] md:text-[32px]">כרית ביטחון <span class="fb-marker">והפרשה למס</span></h1>
        <div class="mt-5 grid gap-4 sm:grid-cols-2">
          <${Field} label="כרית ביטחון" hint="מתחת לסכום הזה הכריש מתריע.">
            <${MoneyInput} value=${cushion ?? monthly * 2} onInput=${setCushion} />
            <span class="mt-1.5 inline-flex"><${Tag} tone="due">הצעה: שני חודשי הוצאות<//></span>
          <//>
          <${Field} label="הפרשה למס מכל הכנסה" hint=${`ברירת מחדל ל${ENTITIES[state.entity].label}, מאזור רואה החשבון. הערכה בלבד.`}>
            <div class="relative" dir="ltr"><span class="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted">%</span><input type="number" class=${cx(inputCls, 'pl-8 text-left font-display font-extrabold')} value=${taxPct} onInput=${(e) => setTax(Number(e.target.value))} /></div>
          <//>
        </div>`}
    </section>
    <div class="mt-4 flex items-center justify-between gap-3">
      ${i > 0 ? html`<${Button} variant="secondary" onClick=${() => setI(i - 1)}>חזרה<//>` : html`<span></span>`}
      ${off && i === 1 && html`<span class="fb-status is-reason max-sm:hidden">צריך את הסכום כדי להמשיך</span>`}
      ${i > 0 && html`<${Button} disabled=${off} onClick=${next}>${last ? 'סיום' : 'המשך'}${last ? html`<${PencilCheck} size=${20} color="#fff" weight=${2.8} />` : html`<${Icon} name="arrow-left" size=${20} />`}<kbd class="fb-key max-md:hidden">↵</kbd><//>`}
    </div>
  </div>`;
}

// ---------- the bell ----------

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
      ${list.length === 0
        ? html`<p class="text-[14px] text-muted">אין תזכורות כרגע.</p>`
        : html`<ul class="flex flex-col gap-2">
            ${list.map(
              (a) => html`<li key=${a.id} class="flex items-start gap-2.5 rounded-xl bg-canvas px-3 py-2.5">
                <${Icon} name=${a.icon} size=${18} class=${cx('mt-0.5', a.tone === 'error' ? 'text-error' : a.tone === 'warn' ? 'text-warn' : 'text-brand-600')} />
                <span class="min-w-0 flex-1"><b class="block text-[14px]">${a.title}</b><span class="block text-[13px] text-muted">${a.text}</span>
                  ${a.action && html`<button type="button" onClick=${() => (setOpen(false), onAct(a))} class="mt-1 text-[13px] font-bold text-brand-600 cursor-pointer">${ACTION_LABEL[a.action]}</button>`}
                </span>
              </li>`,
            )}
          </ul>`}
    </div>`}
  </div>`;
}

// ---------- the next step: what matters now, one button ----------

function nextStep(state, list, run) {
  const sug = stageSuggestion(state);
  const more = (skip) => list.filter((a) => a !== skip).map((a) => ({ ...a, actionLabel: ACTION_LABEL[a.action] }));
  const fromAlert = (a) => ({
    mood: a.tone === 'info' ? 'thinking' : 'alert',
    title: a.title,
    text: a.action === 'remind' ? `${a.text}. ההודעה כבר כתובה, רק לשלוח.` : a.text,
    action: ACTION_LABEL[a.action],
    run: () => run.alert(a),
    more: more(a),
  });

  if (state.stage === 'setup') {
    if (sug === 'first') {
      const d = state.deals[state.deals.length - 1];
      return { mood: 'happy', celebrate: true, title: `הלקוח הראשון נסגר: ${d.client}, ${fmt(d.total)}`, text: 'מעכשיו המרכז הפיננסי יעקוב גם אחרי התשלומים מהלקוחות. התקציב וההוצאות עוברים איתך.', action: 'מעבר לשלב 2', run: () => run.stage('first') };
    }
    const r = runway(state);
    const when = r.until ? `הכסף מחזיק עד ${monthYear(r.until)}.` : '';
    const ready = readiness(state).find((x) => !x.done);
    if (r.until && r.months < 2)
      return { mood: 'alert', title: `${when} זה פחות מחודשיים.`, text: 'כדאי לעצור הוצאות הקמה שלא חייבים עכשיו, ולשים את כל הכוח על הלקוח הראשון.', action: 'לצייד הלקוחות', run: run.leads };
    if (ready)
      return {
        mood: 'thinking',
        title: `${when} עכשיו מתכוננים ללקוח הראשון.`,
        text: ready.id === 'pay' ? 'נשאר להגדיר איך לקוחות ישלמו לך. הפרטים ייכנסו לכל תזכורת תשלום.' : 'נשאר חשבון בנק נפרד לעסק, כדי שהכסף של העסק לא יתערבב עם הפרטי.',
        action: ready.id === 'pay' ? 'הגדרת דרך תשלום' : 'יש לי חשבון נפרד',
        run: ready.id === 'pay' ? run.pay : run.bank,
      };
    const open = state.setup.find((x) => !x.done);
    if (open)
      return { mood: 'calm', title: `${when} נשאר לשלם ${fmt(setupSummary(state).remaining)} על ההקמה.`, text: `כשמשלמים על "${open.name}", מעדכנים כאן, והמספרים מתעדכנים לבד.`, action: 'עדכון תשלום', run: () => run.item(open) };
    return { mood: 'happy', title: 'העסק מוכן לקבל כסף.', text: 'ההקמה שולמה, ודרך התשלום מוגדרת. עכשיו כל הכוח על הלקוח הראשון.', action: 'לצייד הלקוחות', run: run.leads };
  }

  if (state.stage === 'first') {
    if (sug === 'active')
      return { mood: 'happy', celebrate: true, title: 'שלושה חודשים ברציפות עם הכנסה', text: 'זה הזמן לעבור לניהול תזרים מלא: היתרה בבנק, הקופה הצפויה בחודשים הבאים, וכרית ביטחון.', action: 'מעבר לשלב 3', run: () => run.stage('active'), more: more() };
    if (list[0]) return fromAlert(list[0]);
    const m = monthSummary(state);
    const be = breakEven(state);
    if (m.received < be.cover)
      return { mood: 'thinking', title: `עוד ${fmt(be.cover - m.received)} החודש כדי לכסות את ההוצאות הקבועות`, text: state.openDeals.length ? `יש ${state.openDeals.length} עסקאות פתוחות בלידים.` : 'כל עסקה שנסגרת בלידים נכנסת לכאן עם לוח התשלומים שלה.', action: state.openDeals.length ? 'לעסקאות הפתוחות' : null, run: run.deals };
    return { mood: 'happy', title: 'הכול בזמן. ההכנסות של החודש כיסו את ההוצאות.', text: `עד היעד: עוד ${fmt(Math.max(0, be.goal - m.received))}.`, action: null };
  }

  if (list[0]) return fromAlert(list[0]);
  return { mood: 'happy', title: 'הכול בזמן', text: 'אין תשלומים באיחור, והקופה מעל כרית הביטחון.', action: null };
}

// ---------- the app ----------

function App({ view, onViewChange }) {
  const handoff = useRef();
  if (handoff.current === undefined) handoff.current = takeHandoff();
  const from = (k, f) => (handoff.current && k in handoff.current ? handoff.current[k] : f);
  const q = new URLSearchParams(location.search);
  const urlScenario = q.get('scenario');
  const [scenarioId, setScenarioId] = useState(() => from('scenarioId', SCENARIOS.some((s) => s.id === urlScenario) ? urlScenario : DEFAULT_SCENARIO));
  const [state, setState] = useState(() => from('state', SCENARIOS.find((s) => s.id === scenarioId).make()));
  const [tab, setTab] = useState(() => from('tab', q.get('tab') || 'week'));
  // ?sheet=... opens that window on load (direct links for the dev team).
  const [sheet, setSheet] = useState(() => {
    const t = q.get('sheet');
    if (!state.setupDone || !SHEETS.includes(t)) return null;
    if (t === 'remind') {
      const deal = state.deals.find((d) => d.payments.some((p) => paymentStatus(p) !== 'paid'));
      return deal ? { type: 'remind', deal, payment: deal.payments.find((p) => paymentStatus(p) !== 'paid') } : null;
    }
    if (t === 'item') return { type: 'item', item: state.setup.find((x) => !x.done) };
    return { type: t };
  });
  const [dev, setDev] = useState(false);
  const [toast, setToast] = useState(null);
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
    showToast(`${fmt(payment.amount)} מ${deal.client} נכנסו`, 'check', () => setState(before));
  };
  const remind = (deal, payment) => setSheet({ type: 'remind', deal, payment });
  const toTab = (t) => {
    if (state.stage === 'active') setTab(t);
    setTimeout(() => tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  };
  const moveStage = (id) => {
    if (id === 'active') return setSheet({ type: 'active' });
    const before = clone(state);
    update((s) => (s.stage = id));
    setSheet(null);
    showToast(`עברת לשלב ${STAGES.find((s) => s.id === id).n}: ${STAGES.find((s) => s.id === id).label}`, 'milestone', () => setState(before));
  };
  const on = {
    paid: markPaid,
    remind,
    balance: () => setSheet({ type: 'balance' }),
    expense: (x) => setSheet({ type: 'expense', expense: x }),
    item: (x) => setSheet({ type: 'item', item: x }),
    addItem: () => setSheet({ type: 'item' }),
    pay: () => setSheet({ type: 'pay' }),
    bank: () => {
      update((s) => (s.bankAccount = true));
      showToast('סומן: יש חשבון בנק נפרד לעסק', 'check');
    },
    deal: () => setSheet({ type: 'deal' }),
    settings: () => setSheet({ type: 'settings' }),
  };
  const list = alerts(state);
  const alertAct = (a) => (a.action === 'remind' ? remind(a.deal, a.payment) : a.action === 'paid' ? markPaid(a.deal, a.payment) : toTab('payments'));
  const step = state.setupDone
    ? nextStep(state, list, {
        alert: alertAct,
        stage: moveStage,
        pay: on.pay,
        bank: on.bank,
        item: on.item,
        deals: () => toTab('payments'),
        leads: () => showToast('כאן עוברים לשלב "צייד הלקוחות" במסע', 'info'),
      })
    : null;
  const onNav = (id) => (id === 'finance' ? null : showToast('במוק-אפ הזה יש רק את עמוד הכספים', 'info'));
  const nextMonth = list.find((a) => a.id.startsWith('month-'));
  const head = HEADINGS[state.stage];

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
      <div class="ms-auto flex items-center gap-1 lg:ms-0">
        <span class="hidden rounded border border-warn/40 bg-warn-50 px-1.5 py-0.5 text-[12px] font-bold text-warn 2xl:inline">מוק-אפ</span>
        ${!EMBED && html`<${ViewToggle} view=${view} onChange=${switchView} />`}
        ${state.setupDone && html`<${Bell} list=${list} onAct=${alertAct} />`}
        <button type="button" onClick=${() => setDev((d) => !d)} title="הערות למפתחים (Shift+D)" aria-label="הערות למפתחים" class="inline-flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-brand-50 hover:text-brand-600 cursor-pointer">
          <${Icon} name="code-xml" size=${18} />
        </button>
        <span class="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 font-display text-[14px] font-extrabold text-white max-sm:hidden">${USER.firstName[0]}</span>
      </div>
    </header>

    <div class="fb-notebook fb-margin relative min-h-0 flex-1">
      <main class="thin-scroll absolute inset-0 overflow-y-auto">
        <div class="mx-auto max-w-6xl px-4 pb-28 pt-5 md:px-8 md:pt-8 lg:pb-12">
          ${!state.setupDone
            ? html`<${Onboarding}
                state=${state}
                onDone=${({ stage, amount, paid, expenses, cushion, taxPct }) => {
                  update((s) => {
                    s.setupDone = true;
                    s.stage = stage;
                    s.opening = { amount, date: TODAY };
                    s.expenses = expenses;
                    s.taxPct = taxPct;
                    if (stage === 'active') s.cushion = cushion;
                    // What was paid before today is already out of the amount entered.
                    s.setup = s.setup.map((x) => (paid.has(x.id) ? { ...x, spent: x.planned, done: true, spentOn: addDays(TODAY, -1) } : x));
                  });
                  showToast('המרכז הפיננסי מוכן', 'check');
                }}
              />`
            : html`<div class="rise flex flex-col gap-5 md:gap-6">
                <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <${BoardHeading} stage=${state.stage} title=${head.title} sub=${head.sub} />
                  <div class="flex items-center gap-2">
                    <${StageTrack} stage=${state.stage} onOpen=${() => setSheet({ type: 'stages' })} />
                    <button type="button" onClick=${on.settings} title="הגדרות" aria-label="הגדרות" class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-white hover:text-brand-600 cursor-pointer"><${Icon} name="settings-2" size=${20} /></button>
                  </div>
                </div>

                <${NextStep} ...${step} onAction=${step.run} onMore=${alertAct} />

                ${state.stage === 'setup' && html`<${SetupBoard} state=${state} on=${on} />`}
                ${state.stage === 'first' && html`<${FirstBoard} state=${state} on=${on} tab=${tab} onTab=${setTab} payRef=${tabsRef} />`}
                ${state.stage === 'active' && html`<${ActiveBoard} state=${state} on=${on} tab=${tab} onTab=${setTab} insight=${nextMonth ? `${nextMonth.title}. ${nextMonth.text}` : null} tabsRef=${tabsRef} />`}
              </div>`}
        </div>
      </main>
      <${PartnerBubble}
        message=${step ? `${step.title}. ${step.text || ''}`.trim() : 'כמה שאלות קצרות, ואז רואים רק את מה שחשוב לעסק עכשיו.'}
        mood=${step ? step.mood : 'calm'}
        unread=${false}
        onRead=${() => {}}
        action=${step?.action ? html`<div class="mt-2.5"><${Button} variant="mini" onClick=${step.run}>${step.action}<//></div>` : null}
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
      state=${state}
      deal=${sheet.deal}
      payment=${sheet.payment}
      onClose=${() => setSheet(null)}
      onPayMethod=${() => setSheet({ type: 'pay' })}
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
        showToast(diff ? `עודכן · ${signed(diff)} נרשמו כעדכון יתרה` : 'הסכום אושר', 'check');
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
        showToast(x.id ? 'ההוצאה עודכנה' : 'ההוצאה נוספה', 'check');
      }}
      onDelete=${(x) => {
        const before = clone(state);
        update((s) => (s.expenses = s.expenses.filter((o) => o.id !== x.id)));
        setSheet(null);
        showToast(`"${x.name}" נמחקה`, 'trash-2', () => setState(before));
      }}
    />`}
    ${sheet?.type === 'item' &&
    html`<${SetupItemSheet}
      item=${sheet.item}
      onClose=${() => setSheet(null)}
      onSave=${(x) => {
        const before = clone(state);
        update((s) => {
          if (x.id) s.setup = s.setup.map((o) => (o.id === x.id ? x : o));
          else s.setup.push({ ...x, id: `s${Date.now()}` });
        });
        setSheet(null);
        showToast(x.id ? `"${x.name}" עודכן` : 'הפריט נוסף לתקציב', 'check', () => setState(before));
      }}
      onDelete=${(x) => {
        const before = clone(state);
        update((s) => (s.setup = s.setup.filter((o) => o.id !== x.id)));
        setSheet(null);
        showToast(`"${x.name}" נמחק מהתקציב`, 'trash-2', () => setState(before));
      }}
    />`}
    ${sheet?.type === 'pay' &&
    html`<${PayMethodSheet}
      state=${state}
      onClose=${() => setSheet(null)}
      onSave=${(m) => {
        update((s) => (s.payMethod = m));
        setSheet(null);
        showToast('דרך התשלום נשמרה · היא תיכנס לכל תזכורת', 'check');
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
        if (state.stage === 'active') setTab('payments');
        showToast(`לוח התשלומים של ${d.client} נשמר`, 'check');
      }}
    />`}
    ${sheet?.type === 'settings' &&
    html`<${SettingsSheet}
      state=${state}
      onClose=${() => setSheet(null)}
      onStages=${() => setSheet({ type: 'stages' })}
      onSave=${(v) => {
        update((s) => Object.assign(s, v));
        setSheet(null);
        showToast('ההגדרות נשמרו', 'check');
      }}
    />`}
    ${sheet?.type === 'stages' && html`<${StagesSheet} state=${state} onClose=${() => setSheet(null)} onPick=${moveStage} />`}
    ${sheet?.type === 'active' &&
    html`<${MoveToActiveSheet}
      state=${state}
      onClose=${() => setSheet(null)}
      onSave=${({ bal, cushion }) => {
        const before = clone(state);
        const diff = bal - balanceOn(state, TODAY);
        update((s) => {
          s.stage = 'active';
          s.cushion = cushion;
          if (diff) s.adjustments.push({ date: TODAY, amount: diff });
        });
        setSheet(null);
        setTab('week');
        showToast('עברת לשלב 3: עסק פעיל', 'milestone', () => setState(before));
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
