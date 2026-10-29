// Mock data for the finance center. In production:
//   the stage of the business            -> the first-entry question, then the data
//                                           (first deal closed, months with income)
//   money set aside / opening balance,
//   cushion, tax %                       -> a new finance settings record per business
//   the setup budget (one-time items)    -> "העסק במספרים" (the setup budget part),
//                                           plus what was actually paid
//   fixed expenses                       -> "העסק במספרים", plus a charge day and a frequency
//   deals and their payment schedules    -> the CRM (a deal moved to "נסגר") + the
//                                           payment terms from "הצעה מנצחת"
//   leads / calls per week               -> the CRM
//   the monthly goal and weekly targets  -> "העסק במספרים" (the plan back from the goal)
//   entity type                          -> the accountant area ("רואה חשבון")
// The mockup's "today" is fixed so every number on the page stays the same.

export const TODAY = '2026-10-29';

export const USER = { firstName: 'דניאל', fullName: 'דניאל כהן', business: 'שיווק שעובד' };
export const PARTNER = { name: 'הכריש', role: 'השותף העסקי' };

// The three stages. The finance center shows a different board for each.
export const STAGES = [
  {
    id: 'setup',
    n: 1,
    label: 'הקמה',
    short: 'הקמה',
    who: 'עוד אין לקוחות משלמים',
    shows: 'תקציב ההקמה מול מה שכבר הוצאת, כמה זמן הכסף מחזיק, כמה צריך למכור כדי לכסות את ההוצאות, והכנה ללקוח הראשון.',
    next: 'כשליד ראשון עובר ל"נסגר", הכריש מציע לעבור לשלב 2.',
  },
  {
    id: 'first',
    n: 2,
    label: 'לקוחות ראשונים',
    short: 'לקוחות ראשונים',
    who: 'יש לקוחות משלמים, עוד לא כל חודש',
    shows: 'התשלומים מהלקוחות (מה התקבל, מה באיחור, מה מגיע), כמה נשאר לך החודש, ואם ההכנסות כבר מכסות את ההוצאות.',
    next: 'אחרי 3 חודשים ברציפות עם הכנסה, הכריש מציע לעבור לשלב 3.',
  },
  {
    id: 'active',
    n: 3,
    label: 'עסק פעיל',
    short: 'עסק פעיל',
    who: 'יש הכנסה כל חודש',
    shows: 'ניהול תזרים מלא, עם היתרה בבנק, הקופה הצפויה בחודשים הבאים, כרית ביטחון, תזכורות ושבוע במספרים.',
    next: null,
  },
];

// "כמה כסף צריך להישאר לך בכל חודש?" from "העסק במספרים".
export const GOAL = 12000;

// The plan back from the goal ("העסק במספרים"), per week.
export const WEEK_TARGET = { leads: 10, calls: 4, closes: 1, income: 3500 };

// Paid products from the basket ("סל מוצרים"), with the payment terms set in
// "הצעה מנצחת". The deal form reads both.
export const PRODUCTS = [
  { id: 'b1', name: 'סדנת אסטרטגיה אישית (3 שעות)', short: 'סדנה אישית', price: 890, terms: 'one' },
  { id: 'p1', name: 'תוכנית ליווי 90 יום 1:1', short: 'ליווי 90 יום', price: 7500, terms: 'three' },
  { id: 'p2', name: 'יום VIP אסטרטגי', short: 'יום VIP', price: 3900, terms: 'one' },
  { id: 'r1', name: 'ריטיינר ליווי חודשי', short: 'ריטיינר חודשי', price: 2200, terms: 'monthly' },
];

export const TERMS = [
  { id: 'one', label: 'תשלום אחד', n: 1 },
  { id: 'two', label: '2 תשלומים', n: 2 },
  { id: 'three', label: '3 תשלומים', n: 3 },
  { id: 'monthly', label: 'מנוי חודשי', n: 0 },
];

export const CATEGORIES = {
  marketing: { label: 'שיווק', icon: 'megaphone' },
  tools: { label: 'כלים ותוכנות', icon: 'monitor' },
  pro: { label: 'אנשי מקצוע', icon: 'briefcase' },
  insurance: { label: 'ביטוח', icon: 'shield-check' },
  other: { label: 'אחר', icon: 'circle-dot' },
};

export const FREQS = [
  { id: 'monthly', label: 'כל חודש' },
  { id: 'weekly', label: 'כל שבוע' },
  { id: 'yearly', label: 'פעם בשנה' },
  { id: 'once', label: 'פעם אחת' },
];

// How clients pay (set once, used in the reminder message). Until FlowBiz connects
// to a clearing provider, these are the user's own details.
export const PAY_METHODS = [
  { id: 'bit', label: 'ביט', ask: 'מספר הטלפון בביט', icon: 'smartphone' },
  { id: 'paybox', label: 'פייבוקס', ask: 'מספר הטלפון בפייבוקס', icon: 'smartphone' },
  { id: 'bank', label: 'העברה בנקאית', ask: 'בנק, סניף ומספר חשבון', icon: 'landmark' },
  { id: 'card', label: 'קישור לאשראי', ask: 'הקישור לתשלום', icon: 'credit-card' },
];

// Default tax provision by entity type (set by FlowBiz; shown as a provision, not advice).
export const ENTITIES = {
  exempt: { label: 'עוסק פטור', taxPct: 15 },
  licensed: { label: 'עוסק מורשה', taxPct: 25 },
};

// Fixed expenses as they come from the budget, with the charge day added.
const EXPENSES = [
  { id: 'x1', name: 'Zoom', amount: 60, category: 'tools', freq: 'monthly', day: 1 },
  { id: 'x2', name: 'Canva ואחסון אתר', amount: 110, category: 'tools', freq: 'monthly', day: 1 },
  { id: 'x3', name: 'הנהלת חשבונות', amount: 350, category: 'pro', freq: 'monthly', day: 10 },
  { id: 'x4', name: 'פרסום ממומן בפייסבוק', amount: 200, category: 'marketing', freq: 'weekly', day: 0 },
  { id: 'x5', name: 'ביטוח אחריות מקצועית', amount: 1320, category: 'insurance', freq: 'yearly', day: '03-12' },
];
// Before the first client there is no paid advertising yet.
const SETUP_EXPENSES = EXPENSES.filter((x) => x.id !== 'x4');

// The setup budget: one-time items planned in "העסק במספרים". spent = what was paid
// so far (on spentOn), done = nothing more to pay. All three come in from that step,
// so the first entry never asks for them.
const SETUP_ITEMS = [
  { id: 's1', name: 'לוגו ומיתוג', icon: 'palette', planned: 1200, spent: 1200, spentOn: '2026-09-08', done: true },
  { id: 's2', name: 'אתר ודף נחיתה', icon: 'monitor', planned: 2500, spent: 1800, spentOn: '2026-09-22', done: false },
  { id: 's3', name: 'מצלמה ותאורה לזום', icon: 'camera', planned: 900, spent: 0, spentOn: null, done: false },
  { id: 's4', name: 'פתיחת תיק ועורך דין לחוזה', icon: 'scale', planned: 800, spent: 950, spentOn: '2026-10-05', done: true },
  { id: 's5', name: 'קמפיין השקה', icon: 'megaphone', planned: 1500, spent: 0, spentOn: null, done: false },
];

// Closed deals. Each payment: due date, amount, and the day it was marked as received.
const DEALS = [
  {
    id: 'd1',
    client: 'יואב כהן',
    phone: '050-7123456',
    product: 'p2',
    total: 3900,
    terms: 'one',
    closed: '2026-10-06',
    payments: [{ id: 'd1-1', due: '2026-10-06', amount: 3900, paidOn: '2026-10-06' }],
  },
  {
    id: 'd2',
    client: 'דנה לוי',
    phone: '052-3345678',
    product: 'p1',
    total: 7500,
    terms: 'three',
    closed: '2026-10-12',
    payments: [
      { id: 'd2-1', due: '2026-10-12', amount: 2500, paidOn: '2026-10-12' },
      { id: 'd2-2', due: '2026-10-25', amount: 2500, paidOn: null },
      { id: 'd2-3', due: '2026-11-25', amount: 2500, paidOn: null },
    ],
  },
  {
    id: 'd3',
    client: 'נועם ברק',
    phone: '054-9981122',
    product: 'b1',
    total: 890,
    terms: 'one',
    closed: '2026-10-20',
    payments: [{ id: 'd3-1', due: '2026-10-20', amount: 890, paidOn: '2026-10-20' }],
  },
  {
    id: 'd4',
    client: 'רוני שגיא',
    phone: '053-4417788',
    product: 'r1',
    total: 2200,
    terms: 'monthly',
    closed: '2026-10-27',
    monthly: { amount: 2200, day: 1, from: '2026-11-01' },
    payments: [],
  },
];

// Open deals in the CRM, by the chance of their stage. Never inside the expected cash.
const OPEN_DEALS = [
  { id: 'o1', client: 'מיכל אברהם', product: 'p1', total: 7500, terms: 'three', stage: 'נשלחה הצעה', chance: 50, expected: '2026-11-10' },
  { id: 'o2', client: 'אורי פרץ', product: 'p2', total: 3900, terms: 'one', stage: 'שיחה נקבעה', chance: 20, expected: '2026-11-20' },
];

// Leads and calls per week (Sunday to Saturday), from the CRM.
const CRM_WEEKS = [
  { start: '2026-10-04', leads: 9, calls: 4 },
  { start: '2026-10-11', leads: 7, calls: 3 },
  { start: '2026-10-18', leads: 11, calls: 5 },
  { start: '2026-10-25', leads: 4, calls: 2 },
];

const clone = (o) => JSON.parse(JSON.stringify(o));

// An active business (stage 3): the setup was paid long before the opening date.
const base = () => ({
  stage: 'active',
  setupDone: true,
  opening: { amount: 9500, date: '2026-09-30' },
  cushion: 2640,
  entity: 'exempt',
  taxPct: 15,
  payMethod: { id: 'bit', detail: '050-1234567' },
  bankAccount: true,
  setup: SETUP_ITEMS.map((s) => ({ ...s, spent: s.planned, done: true, spentOn: '2026-06-01' })),
  expenses: clone(EXPENSES),
  deals: clone(DEALS),
  openDeals: clone(OPEN_DEALS),
  crmWeeks: clone(CRM_WEEKS),
  adjustments: [],
  reminders: {},
});

// A business in setup (stage 1): 10,000 ₪ set aside on 1.9, no clients yet.
const setupBase = () => ({
  ...base(),
  stage: 'setup',
  opening: { amount: 10000, date: '2026-09-01' },
  cushion: 0,
  payMethod: null,
  bankAccount: false,
  setup: clone(SETUP_ITEMS),
  expenses: clone(SETUP_EXPENSES),
  deals: [],
  openDeals: [{ id: 'o3', client: 'שירה כץ', product: 'b1', total: 890, terms: 'one', stage: 'שיחה נקבעה', chance: 20, expected: '2026-11-08' }],
  crmWeeks: CRM_WEEKS.map((w) => ({ ...w, leads: Math.round(w.leads / 3), calls: Math.round(w.calls / 3) })),
});

// First clients (stage 2): the setup is almost done, two clients so far.
const firstBase = () => {
  const s = setupBase();
  s.stage = 'first';
  s.payMethod = { id: 'bit', detail: '050-1234567' };
  s.setup = s.setup.map((x) =>
    x.id === 's2' ? { ...x, spent: 2500, done: true } : x.id === 's3' ? { ...x, spent: 900, spentOn: '2026-10-02', done: true } : x.id === 's5' ? { ...x, spent: 300, spentOn: '2026-10-15' } : x,
  );
  s.deals = clone(DEALS).filter((d) => d.id === 'd2' || d.id === 'd3');
  s.openDeals = clone(OPEN_DEALS);
  return s;
};

export const SCENARIOS = [
  {
    id: 'start',
    label: 'כניסה ראשונה · באיזה שלב העסק?',
    make: () => ({ ...setupBase(), stage: null, setupDone: false, opening: { amount: null, date: TODAY } }),
  },
  { id: 'setup', label: 'שלב 1 · הקמה', make: setupBase },
  {
    id: 'firstdeal',
    label: 'שלב 1 · הלקוח הראשון נסגר היום',
    make: () => {
      const s = setupBase();
      s.payMethod = { id: 'bit', detail: '050-1234567' };
      s.openDeals = [];
      s.deals = [{ id: 'd5', client: 'שירה כץ', phone: '058-6612345', product: 'b1', total: 890, terms: 'one', closed: TODAY, payments: [{ id: 'd5-1', due: '2026-11-03', amount: 890, paidOn: null }] }];
      return s;
    },
  },
  { id: 'first', label: 'שלב 2 · לקוחות ראשונים · תשלום באיחור', make: firstBase },
  {
    id: 'ready',
    label: 'שלב 2 · 3 חודשים עם הכנסה',
    make: () => {
      const s = firstBase();
      s.opening = { amount: 10000, date: '2026-07-01' };
      s.setup = s.setup.map((x) => ({ ...x, spent: x.id === 's4' ? 950 : x.planned, done: true, spentOn: x.spentOn && x.spentOn < '2026-07-01' ? x.spentOn : '2026-07-20' }));
      s.deals = [
        { id: 'e1', client: 'יואב כהן', phone: '050-7123456', product: 'p2', total: 3900, terms: 'one', closed: '2026-08-14', payments: [{ id: 'e1-1', due: '2026-08-14', amount: 3900, paidOn: '2026-08-14' }] },
        { id: 'e2', client: 'נועם ברק', phone: '054-9981122', product: 'b1', total: 890, terms: 'one', closed: '2026-09-09', payments: [{ id: 'e2-1', due: '2026-09-09', amount: 890, paidOn: '2026-09-09' }] },
        ...clone(DEALS).filter((d) => d.id === 'd2'),
      ];
      s.deals[2].payments[1].paidOn = '2026-10-25';
      return s;
    },
  },
  { id: 'regular', label: 'שלב 3 · חודש רגיל · תשלום אחד באיחור', make: base },
  {
    id: 'tight',
    label: 'שלב 3 · הקופה מתחת לכרית הביטחון',
    make: () => {
      const s = base();
      s.opening.amount = 500;
      s.deals = s.deals.filter((d) => d.id !== 'd1');
      return s;
    },
  },
  {
    id: 'paid',
    label: 'שלב 3 · הכול שולם בזמן',
    make: () => {
      const s = base();
      s.deals.find((d) => d.id === 'd2').payments[1].paidOn = '2026-10-25';
      return s;
    },
  },
];

export const DEFAULT_SCENARIO = 'start';
