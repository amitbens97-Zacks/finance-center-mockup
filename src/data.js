// Mock data for the finance center. In production:
//   opening balance, cushion, tax %     -> a new finance settings record per business
//   deals and their payment schedules   -> the CRM (a deal moved to "נסגר") + the
//                                          payment terms from "בניית הצעה מנצחת"
//   fixed expenses                      -> "העסק במספרים" (today: "תקציב הקמה"),
//                                          plus a charge day and a frequency
//   leads / calls per week              -> the CRM
//   the monthly goal and weekly targets -> "העסק במספרים" (the plan back from the goal)
//   entity type                         -> the accountant area ("רואה חשבון")
// The mockup's "today" is fixed so every number on the page stays the same.

export const TODAY = '2026-10-29';

export const USER = { firstName: 'דניאל', fullName: 'דניאל כהן', business: 'שיווק שעובד' };
export const PARTNER = { name: 'הכריש', role: 'השותף העסקי' };

// "כמה כסף צריך להישאר לך בכל חודש?" from "העסק במספרים".
export const GOAL = 12000;

// The plan back from the goal ("העסק במספרים"), per week.
export const WEEK_TARGET = { leads: 10, calls: 4, closes: 1, income: 3500 };

// Paid products from the basket ("בניית סל מוצרים"), with the payment terms set in
// "בניית הצעה מנצחת". The deal form reads both.
export const PRODUCTS = [
  { id: 'b1', name: 'סדנת אסטרטגיה אישית (3 שעות)', price: 890, terms: 'one' },
  { id: 'p1', name: 'תוכנית ליווי 90 יום 1:1', price: 7500, terms: 'three' },
  { id: 'p2', name: 'יום VIP אסטרטגי', price: 3900, terms: 'one' },
  { id: 'r1', name: 'ריטיינר ליווי חודשי', price: 2200, terms: 'monthly' },
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

const base = () => ({
  setupDone: true,
  opening: { amount: 9500, date: '2026-09-30' },
  cushion: 2640,
  entity: 'exempt',
  taxPct: 15,
  expenses: clone(EXPENSES),
  deals: clone(DEALS),
  openDeals: clone(OPEN_DEALS),
  crmWeeks: clone(CRM_WEEKS),
  adjustments: [],
  reminders: {},
});

export const SCENARIOS = [
  {
    id: 'regular',
    label: 'חודש רגיל · תשלום אחד באיחור',
    make: base,
  },
  {
    id: 'setup',
    label: 'כניסה ראשונה · הגדרת הלוח',
    make: () => ({ ...base(), setupDone: false, opening: { amount: null, date: TODAY } }),
  },
  {
    id: 'tight',
    label: 'הקופה מתחת לכרית הביטחון',
    make: () => {
      const s = base();
      s.opening.amount = 500;
      s.deals = s.deals.filter((d) => d.id !== 'd1');
      return s;
    },
  },
  {
    id: 'paid',
    label: 'הכול שולם בזמן',
    make: () => {
      const s = base();
      s.deals.find((d) => d.id === 'd2').payments[1].paidOn = '2026-10-25';
      return s;
    },
  },
  {
    id: 'nodeals',
    label: 'עוד אין לקוחות',
    make: () => ({ ...base(), opening: { amount: 6000, date: '2026-09-30' }, deals: [], openDeals: [], crmWeeks: CRM_WEEKS.map((w) => ({ ...w, leads: 0, calls: 0 })) }),
  },
];

export const DEFAULT_SCENARIO = 'regular';
