// Reading a profit and loss report ("דוח רווח והפסד") exported to Excel from any invoicing
// system. Nothing here assumes one layout. The parser looks at the table the way a person
// would:
//   1. the header row is the one with months in it (2026-01, 01/2026, ינואר 2026, a date).
//      With no months, the report covers one period and the amount column is the one with
//      the most numbers.
//   2. the name of each row is its first text cell.
//   3. a row with a name and no numbers opens a section: הכנסות or הוצאות (and the words
//      around them: מכירות, עלות המכר, הוצאות הנהלה...).
//   4. a row that sums others (סה"כ, סיכום, רווח, a row with no name, or a row that equals
//      the rows above it) is not counted. It is kept as a check.
//   5. every other row with numbers is one item: income or an expense, by its section, or
//      by its sign and its words when the report has no sections.
// Then every check row is compared with what was read, month by month. "בדיוק" is proven,
// not assumed: when a check fails, the review screen says so before anything is saved.

const HE_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const HE_SHORT = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];
const EN_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const SUMMARY = /סה["״']?כ|סך\s*ה?כ[ו]?ל|סיכום|^total|\btotal\b|רווח|הפסד|profit|loss|\bnet\b|נקי|גולמי|תפעולי|לפני מס/i;
const PROFIT = /רווח|הפסד|profit|loss|\bnet\b|נקי|גולמי|תפעולי|לפני מס/i;
const INCOME = /הכנסה|הכנסות|מכירות|פדיון|תקבולים|income|revenue|sales/i;
const EXPENSE = /הוצאה|הוצאות|עלות|עלויות|רכש|expense|cost/i;
const TOTAL_COL = /סה["״']?כ|סך|סיכום|total|שנתי|מצטבר/i;

const pad = (n) => String(n).padStart(2, '0');
const year4 = (y) => (y < 100 ? 2000 + y : y);
const clean = (s) => String(s).replace(/[‎‏‪-‮ ]/g, ' ').replace(/\s+/g, ' ').trim();

// A number from a cell: real numbers, and text such as "-9,316.00", "₪ 1,200", "(450)",
// "450-" or "1.234,50".
export function num(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v == null || v instanceof Date || typeof v !== 'string') return null;
  let s = clean(v).replace(/₪|ש["״]?ח|nis|ils/gi, '').replace(/\s/g, '');
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) (neg = true), (s = s.slice(1, -1));
  if (/^-.+|.+-$/.test(s)) (neg = !neg), (s = s.replace(/^-|-$/g, ''));
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return neg ? -n : n;
}

// A month ('YYYY-MM') from a header cell, or null.
export function monthOf(v) {
  // Excel dates arrive a few hours (or seconds) off midnight, depending on the time zone.
  // Half a day forward, read in UTC, lands on the right day either way.
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const d = new Date(v.getTime() + 12 * 3600e3);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
  }
  if (typeof v !== 'string') return null;
  const s = clean(v).toLowerCase();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})$/);
  if (m && +m[2] >= 1 && +m[2] <= 12) return `${m[1]}-${pad(+m[2])}`;
  m = s.match(/^(\d{1,2})[-/.](\d{2}|\d{4})$/);
  if (m && +m[1] >= 1 && +m[1] <= 12) return `${year4(+m[2])}-${pad(+m[1])}`;
  m = s.match(/^([֐-׿a-z]+)['׳.]?[\s-]*(\d{2}|\d{4})$/);
  if (m) {
    const w = m[1];
    let i = HE_MONTHS.indexOf(w);
    if (i < 0) i = HE_SHORT.findIndex((x) => w.startsWith(x));
    if (i < 0) i = EN_MONTHS.findIndex((x) => w.startsWith(x));
    if (i >= 0) return `${year4(+m[2])}-${pad(i + 1)}`;
  }
  return null;
}

// "01/01/2026 - 30/11/2026" anywhere in the top rows.
function findPeriod(rows) {
  const re = /(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})\s*(?:-|–|עד)\s*(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})/;
  for (const row of rows.slice(0, 12))
    for (const c of row) {
      const m = typeof c === 'string' && clean(c).match(re);
      if (m) return { from: `${year4(+m[3])}-${pad(+m[2])}-${pad(+m[1])}`, to: `${year4(+m[6])}-${pad(+m[5])}-${pad(+m[4])}` };
    }
  return null;
}

// Which columns hold the amounts: { header row, columns: [{c, month}], total column }.
function findColumns(rows) {
  for (let r = 0; r < Math.min(rows.length, 20); r++) {
    const cols = rows[r].map((v, c) => ({ c, month: monthOf(v) })).filter((x) => x.month);
    if (cols.length >= 2) {
      const total = rows[r].findIndex((v, c) => c > cols[0].c && typeof v === 'string' && TOTAL_COL.test(v) && !monthOf(v));
      return { header: r, cols, total: total >= 0 ? total : null };
    }
  }
  // One period: the column with the most numbers, ignoring a column of account codes
  // (whole numbers that only grow down the page).
  const counts = {};
  const size = {};
  rows.forEach((row) => row.forEach((v, c) => num(v) != null && ((counts[c] = (counts[c] || 0) + 1), (size[c] = (size[c] || 0) + Math.abs(num(v))))));
  const isCodes = (c) => {
    const vs = rows.map((row) => row[c]).filter((v) => typeof v === 'number');
    return vs.length > 2 && vs.every((v, i) => Number.isInteger(v) && v >= 100 && (i === 0 || v > vs[i - 1]));
  };
  const best = Object.keys(counts)
    .map(Number)
    .filter((c) => !isCodes(c))
    // A percent column has as many numbers as the amounts, but smaller ones.
    .sort((a, b) => counts[b] - counts[a] || size[b] - size[a])[0];
  return best == null ? null : { header: -1, cols: [{ c: best, month: null }], total: null };
}

const near = (a, b) => Math.abs(a - b) < 1;
const round2 = (n) => Math.round(n * 100) / 100;

export function parseReport(rows) {
  rows = rows.map((r) => (Array.isArray(r) ? r : []));
  const layout = findColumns(rows);
  if (!layout) return { ok: false, error: 'לא מצאנו בקובץ עמודה של סכומים.' };
  const { cols, total } = layout;
  const valueCols = new Set([...cols.map((x) => x.c), total]);
  const months = cols.map((x) => x.month).filter(Boolean);
  const keys = months.length ? months : ['all'];

  let section = null; // 'in' | 'out'
  let group = []; // items since the last header or subtotal, for unnamed subtotals
  const items = [];
  const checks = [];
  let zero = 0;

  for (let r = layout.header + 1; r < rows.length; r++) {
    const row = rows[r];
    const name = clean(row.find((v, c) => !valueCols.has(c) && typeof v === 'string' && v.trim() && num(v) == null) || '');
    const vals = keys.map((_, k) => num(row[cols[k].c]));
    const has = vals.some((v) => v != null);
    if (!has) {
      // "סיכום הכנסות והוצאות" is a title, not a section: it names both.
      const isIn = INCOME.test(name);
      const isOut = EXPENSE.test(name);
      if (name && isIn && !isOut) section = 'in';
      else if (name && isOut && !isIn) section = 'out';
      if (name) group = [];
      continue;
    }
    const amounts = Object.fromEntries(keys.map((k, i) => [k, vals[i] ?? 0]));
    const sumOf = (list) => Object.fromEntries(keys.map((k) => [k, list.reduce((t, x) => t + x.raw[k], 0)]));
    const equals = (a) => keys.every((k) => near(a[k], amounts[k]));
    // A row equal to the rows above it is a subtotal even without a name, but only in a
    // monthly report: with one column, two items can add up to a third by chance.
    const isSum = !name || SUMMARY.test(name) || (keys.length >= 2 && group.length >= 2 && keys.filter((k) => amounts[k]).length >= 2 && equals(sumOf(group)));
    if (isSum) {
      checks.push({ row: r + 1, name: name || 'שורת הרווח', amounts, profit: !name || PROFIT.test(name), kind: INCOME.test(name) && !EXPENSE.test(name) ? 'in' : EXPENSE.test(name) ? 'out' : section, upto: items.length, group: group.slice() });
      group = [];
      continue;
    }
    if (keys.every((k) => !amounts[k])) {
      zero += 1;
      continue;
    }
    const item = { id: `r${r + 1}`, row: r + 1, name, section, raw: amounts };
    items.push(item);
    group.push(item);
  }

  // Expenses written as negative numbers (a whole section below zero) are flipped.
  // With no sections, the sign and the words decide.
  const neg = (list) => {
    const vs = list.flatMap((x) => keys.map((k) => x.raw[k])).filter((v) => v);
    return vs.length && vs.filter((v) => v < 0).length > vs.length / 2;
  };
  const outNeg = neg(items.filter((x) => x.section === 'out'));
  for (const x of items) {
    const t = keys.reduce((s, k) => s + x.raw[k], 0);
    x.kind = x.section || (t < 0 || (EXPENSE.test(x.name) && !INCOME.test(x.name)) ? 'out' : 'in');
    const flip = (x.section === 'out' && outNeg) || (!x.section && t < 0);
    x.byMonth = Object.fromEntries(keys.map((k) => [k, round2(flip ? -x.raw[k] : x.raw[k])]));
    x.total = round2(keys.reduce((s, k) => s + x.byMonth[k], 0));
    x.category = x.kind === 'out' ? categoryOf(x.name) : null;
    x.months = keys.filter((k) => x.byMonth[k]).length;
    x.include = true;
  }

  // The checks: a subtotal matches its section (or the group above it), a profit row
  // matches income minus expenses up to that row. Every month must match.
  const totals = (list, kind) => Object.fromEntries(keys.map((k) => [k, round2(list.filter((x) => !kind || x.kind === kind).reduce((t, x) => t + x.byMonth[k], 0))]));
  const result = checks.map((ck) => {
    const before = items.slice(0, ck.upto);
    const abs = (o) => Object.fromEntries(keys.map((k) => [k, Math.abs(o[k])]));
    const same = (a, b, absolute) => keys.every((k) => near(absolute ? Math.abs(a[k]) : a[k], absolute ? Math.abs(b[k]) : b[k]));
    let expected;
    let label;
    if (ck.profit) {
      const inc = totals(before, 'in');
      const out = totals(before, 'out');
      expected = Object.fromEntries(keys.map((k) => [k, round2(inc[k] - out[k])]));
      label = 'רווח';
    } else {
      const kind = ck.kind || 'in';
      const sec = totals(before, kind);
      const grp = totals(ck.group, null);
      expected = same(grp, ck.amounts, true) && ck.group.length ? grp : sec;
      label = kind === 'in' ? 'הכנסות' : 'הוצאות';
    }
    const ok = same(expected, ck.amounts, !ck.profit);
    const bad = keys.filter((k) => !near(ck.profit ? expected[k] : Math.abs(expected[k]), ck.profit ? ck.amounts[k] : Math.abs(ck.amounts[k])));
    return { row: ck.row, name: ck.name, label, ok, inFile: round2(keys.reduce((t, k) => t + ck.amounts[k], 0)), read: round2(keys.reduce((t, k) => t + expected[k], 0)), bad };
  });

  // The total column, when there is one: each row's months must add up to it.
  const rowTotals = total == null ? [] : items.filter((x) => num(rows[x.row - 1][total]) != null && !near(Math.abs(num(rows[x.row - 1][total])), Math.abs(keys.reduce((t, k) => t + x.raw[k], 0))));

  return {
    ok: items.length > 0,
    error: items.length ? null : 'לא מצאנו בקובץ שורות של הכנסות או הוצאות.',
    period: findPeriod(rows),
    months,
    items,
    checks: result,
    rowTotals: rowTotals.map((x) => x.name),
    zero,
    sections: items.some((x) => x.section),
  };
}

// Totals for the page: per month and for the whole report, from the items kept.
export function reportTotals(rep) {
  const keys = rep.months.length ? rep.months : ['all'];
  const kept = rep.items.filter((x) => x.include);
  const by = (kind) => Object.fromEntries(keys.map((k) => [k, round2(kept.filter((x) => x.kind === kind).reduce((t, x) => t + x.byMonth[k], 0))]));
  const inc = by('in');
  const out = by('out');
  const sum = (o) => round2(keys.reduce((t, k) => t + o[k], 0));
  return {
    keys,
    months: keys.map((k) => ({ month: k, in: inc[k], out: out[k], net: round2(inc[k] - out[k]) })),
    in: sum(inc),
    out: sum(out),
    net: round2(sum(inc) - sum(out)),
    withIncome: keys.filter((k) => inc[k] > 0).length,
  };
}

// An expense that shows up in most months of the report, at about the same amount:
// a candidate for the fixed expenses.
export function recurring(rep) {
  const n = rep.months.length;
  if (n < 3) return [];
  return rep.items
    .filter((x) => x.include && x.kind === 'out' && x.months >= Math.max(3, Math.ceil(n * 0.6)))
    .map((x) => {
      const vs = rep.months.map((k) => x.byMonth[k]).filter((v) => v > 0);
      const avg = vs.reduce((t, v) => t + v, 0) / vs.length;
      return { ...x, monthly: Math.round(avg), steady: vs.every((v) => Math.abs(v - avg) <= avg * 0.25) };
    })
    .filter((x) => x.steady);
}

// The FlowBiz expense categories, by the words in the report's own names.
const CAT_WORDS = [
  ['marketing', /פרסום|שיווק|קמפיין|ממומן|קידום|מודעות|facebook|google|ads|marketing/i],
  ['tools', /תוכנ|מנוי|אחסון|דומיין|ענן|אפליקצ|software|saas|zoom|canva|wix|תוכנות ועזרים|מחשוב|אינטרנט|טלפון|סלולר/i],
  ['pro', /ראיית חשבון|רואה חשבון|הנהלת חשבונות|עורך דין|עו["״]ד|ייעוץ|יועץ|שירותים מקצועיים|שירותים לעסק|קורס|השתלמ|הדרכ|מנטור|ליווי|פרילנס|קבלני משנה/i],
  ['insurance', /ביטוח/i],
];
export function categoryOf(name) {
  return (CAT_WORDS.find(([, re]) => re.test(name)) || ['other'])[0];
}

// SheetJS reads xlsx, xls and csv. Loaded on the first file, not with the page.
const SHEETJS = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
function sheetjs() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = SHEETJS;
    s.onload = () => ok(window.XLSX);
    s.onerror = () => fail(new Error('load'));
    document.head.append(s);
  });
}

// The sheet with the most numbers in it, as rows of cells.
export async function readFile(file) {
  const XLSX = await sheetjs();
  const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
  const sheets = wb.SheetNames.map((n) => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null, blankrows: false }));
  const score = (rows) => rows.reduce((t, r) => t + r.filter((v) => num(v) != null).length, 0);
  return sheets.sort((a, b) => score(b) - score(a))[0] || [];
}
