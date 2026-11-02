// The profit and loss report from the user's invoicing system, on the page:
//   ImportSheet  - choose a file, then a review screen: every row the parser found, as
//                  income or an expense, checked against the report's own total rows.
//                  Nothing is saved before the user confirms.
//   ReportPanel  - what the report says: profit for the period, income and expenses by
//                  month (a precise bar chart, or a table), by line, and the expenses that
//                  repeat every month (one click adds them to the fixed expenses).
//   ReportInvite - one quiet row while there is no report yet.
import { html, useState, useRef, Icon, cx } from './lib.js';
import { Button } from './components.js';
import { Sheet, Tag } from './ui.js';
import { CATEGORIES } from './data.js';
import { fmt, monthName, dm } from './finance.js';
import { readFile, parseReport, reportTotals, recurring } from './report.js';
import { useWidth } from './chart.js';

const IN = '#12805c';
const OUT = '#5b86e5';
const INK = '#2d3e66';
const MUTED = '#5f6775';
const GRID = '#ebe6dc';
const FONT = 'Assistant, sans-serif';

// Agorot only where the report has them, so a total can be compared with the file.
const nf2 = new Intl.NumberFormat('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const exact = (n) => (Number.isInteger(Math.round(n * 100) / 100) ? fmt(n) : `${nf2.format(n)} ₪`);
const monthYear = (k) => `${monthName(k)} ${k.slice(2, 4)}`;
const periodText = (rep) =>
  rep.period ? `${dm(rep.period.from)}.${rep.period.from.slice(2, 4)} עד ${dm(rep.period.to)}.${rep.period.to.slice(2, 4)}` : rep.months.length ? `${monthYear(rep.months[0])} עד ${monthYear(rep.months[rep.months.length - 1])}` : '';

export const SAMPLES = [
  { file: 'sample-monthly.xlsx', label: 'דוח חודשי', note: 'כמו iCount' },
  { file: 'sample-gross.xlsx', label: 'עם רווח גולמי', note: 'מספרי חשבון ותאריכים' },
  { file: 'sample-single.xlsx', label: 'לתקופה אחת', note: 'הוצאות במינוס' },
];

// ---------- the window: choose a file, then check what was read ----------

export function ImportSheet({ first, onClose, onSave }) {
  const [rep, setRep] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [drag, setDrag] = useState(false);
  const input = useRef();

  const read = async (file, name) => {
    setError(null);
    if (name == null && !/\.(xlsx|xls|csv)$/i.test(file.name || '')) return setError('צריך קובץ אקסל (xlsx או xls) או csv, כמו שמייצאים ממערכת החשבוניות.');
    setBusy(true);
    try {
      const r = parseReport(await readFile(file));
      if (!r.ok) setError(`${r.error} כדאי לבדוק שזה דוח רווח והפסד, עם הסכומים בעמודות.`);
      else setRep({ ...r, file: name || file.name });
    } catch {
      setError('לא הצלחנו לקרוא את הקובץ. צריך קובץ אקסל (xlsx או xls) או csv.');
    }
    setBusy(false);
  };
  const sample = async (s) => read(await (await fetch(`./samples/${s.file}`)).blob(), `${s.label} (לדוגמה)`);

  if (rep) return html`<${Review} rep=${rep} onBack=${() => setRep(null)} onClose=${onClose} onSave=${onSave} />`;

  // On the first entry (stage 2 or 3) the window is an offer: a clear way on without a file.
  const skip = first
    ? html`<span class="text-[13px] text-muted max-sm:hidden">אפשר להעלות גם אחר כך, מ"דוח רווח והפסד" בראש הלוח.</span><${Button} variant="secondary" onClick=${onClose} class="max-sm:flex-1">להמשיך בלי דוח<${Icon} name="arrow-left" size=${17} /><//>`
    : null;
  return html`<${Sheet} title=${first ? 'יש לך מערכת חשבוניות?' : 'העלאת דוח רווח והפסד'} onClose=${onClose} footer=${skip} wide>
    <p class="mb-3 text-[15px] text-ink">${first ? 'אפשר להעלות את דוח הרווח והפסד שלה, וההכנסות וההוצאות שנרשמו שם ייכנסו לכאן לפי חודשים. לא חובה.' : 'מכל מערכת חשבוניות. ההכנסות וההוצאות שנרשמו שם ייכנסו לכאן לפי חודשים, ואפשר לבדוק כל שורה לפני השמירה.'}</p>
    <label
      class=${cx('flex cursor-pointer flex-col items-center gap-2 rounded-[16px] border-2 border-dashed px-4 py-7 text-center transition-colors', drag ? 'border-brand-600 bg-brand-50' : 'border-brand-300 bg-white hover:bg-brand-50')}
      onDragOver=${(e) => (e.preventDefault(), setDrag(true))}
      onDragLeave=${() => setDrag(false)}
      onDrop=${(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) read(f);
      }}
    >
      <span class="grid h-12 w-12 place-items-center rounded-2xl bg-brand-100 text-brand-600"><${Icon} name=${busy ? 'loader' : 'file-spreadsheet'} size=${24} class=${busy ? 'animate-spin' : ''} /></span>
      <b class="text-[16px] text-ink">${busy ? 'קוראים את הדוח...' : 'לבחור קובץ אקסל'}</b>
      <span class="text-[13px] text-muted">או לגרור אותו לכאן · xlsx, xls, csv</span>
      <input ref=${input} type="file" accept=".xlsx,.xls,.csv" class="sr-only" onChange=${(e) => e.target.files[0] && read(e.target.files[0])} />
    </label>
    ${error && html`<p role="alert" class="mt-3 flex items-start gap-2 rounded-xl bg-error-50 px-3 py-2.5 text-[14px] font-semibold text-error"><${Icon} name="circle-alert" size=${17} class="mt-0.5 shrink-0" />${error}</p>`}

    <div class="mt-4 rounded-[14px] bg-white px-4 py-3">
      <p class="text-[13px] font-bold text-muted">איך מוציאים את הדוח</p>
      <p class="mt-1 text-[14px] text-ink">במערכת החשבוניות, בדוחות, בוחרים "רווח והפסד" לפי חודשים ומייצאים לאקסל. כל מערכת עובדת: הקובץ נקרא לפי מה שכתוב בו, לא לפי תבנית קבועה.</p>
    </div>

    <div class="mt-4">
      <p class="text-[13px] font-bold text-muted">אין קובץ בהישג יד? לנסות עם דוח לדוגמה</p>
      <div class="mt-2 grid gap-2 sm:grid-cols-3">
        ${SAMPLES.map(
          (s) => html`<div key=${s.file} class="flex items-center rounded-xl border-[1.5px] border-line bg-white">
            <button type="button" disabled=${busy} onClick=${() => sample(s)} class="min-w-0 flex-1 px-3 py-2 text-start cursor-pointer hover:text-brand-600">
              <b class="block text-[14px]">${s.label}</b><span class="block text-[12px] text-muted">${s.note}</span>
            </button>
            <a href=${`./samples/${s.file}`} download title="להוריד את הקובץ" aria-label=${`להוריד: ${s.label}`} class="grid h-10 w-10 shrink-0 place-items-center text-muted hover:text-brand-600"><${Icon} name="download" size=${16} /></a>
          </div>`,
        )}
      </div>
    </div>
    <p class="mt-3 text-[12px] text-muted">במוק-אפ הקובץ נקרא רק בדפדפן שלך, ולא נשלח ולא נשמר בשום מקום.</p>
  <//>`;
}

const KINDS = [
  { id: 'in', label: 'הכנסה' },
  { id: 'out', label: 'הוצאה' },
  { id: 'skip', label: 'לא לספור' },
];

function Review({ rep: first, onBack, onClose, onSave }) {
  const [rep, setRep] = useState(first);
  const set = (id, patch) => setRep((r) => ({ ...r, items: r.items.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  const t = reportTotals(rep);
  const base = reportTotals(first);
  const changed = t.in !== base.in || t.out !== base.out;
  const bad = rep.checks.filter((c) => !c.ok);
  const kindOf = (x) => (!x.include ? 'skip' : x.kind);
  const group = (kind) => rep.items.filter((x) => x.kind === kind);

  const row = (x) => html`<li key=${x.id} class=${cx('grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 border-t border-line py-2.5 sm:grid-cols-[minmax(0,1fr)_96px_112px_120px]', !x.include && 'opacity-55')}>
    <span class="min-w-0">
      <b class=${cx('block truncate text-[15px]', !x.include && 'line-through')}>${x.name}</b>
      <span class="text-[12px] text-muted">${rep.months.length ? (x.months === 1 ? 'בחודש אחד' : `ב-${x.months} חודשים`) : `שורה ${x.row} בקובץ`}</span>
    </span>
    <span class="text-end font-display text-[15px] font-extrabold tabular-nums sm:order-none">${exact(x.total)}</span>
    <select
      aria-label=${`${x.name}: הכנסה או הוצאה`}
      value=${kindOf(x)}
      onChange=${(e) => set(x.id, e.target.value === 'skip' ? { include: false } : { include: true, kind: e.target.value, category: e.target.value === 'out' ? x.category || 'other' : null })}
      class="h-9 justify-self-start rounded-lg border-[1.5px] border-line bg-white px-2 text-[13px] font-bold text-ink outline-none focus:border-brand-600 sm:justify-self-stretch"
    >${KINDS.map((k) => html`<option value=${k.id}>${k.label}</option>`)}</select>
    ${x.kind === 'out' && x.include
      ? html`<select aria-label=${`${x.name}: קטגוריה`} value=${x.category} onChange=${(e) => set(x.id, { category: e.target.value })} class="h-9 justify-self-end rounded-lg border-[1.5px] border-line bg-white px-2 text-[13px] text-ink outline-none focus:border-brand-600 sm:justify-self-stretch">
          ${Object.entries(CATEGORIES).map(([id, c]) => html`<option value=${id}>${c.label}</option>`)}
        </select>`
      : html`<span class="hidden sm:block"></span>`}
  </li>`;

  return html`<${Sheet}
    title="בדיקה לפני שמירה"
    onClose=${onClose}
    wide
    footer=${html`<${Button} variant="secondary" onClick=${onBack}>קובץ אחר<//><${Button} onClick=${() => onSave(rep)}><${Icon} name="check" size=${18} />שמירה במרכז הפיננסי<//>`}
  >
    <p class="flex flex-wrap items-center gap-x-2 text-[14px] text-muted"><${Icon} name="file-spreadsheet" size=${16} class="text-brand-600" /><b class="text-ink"><bdi>${rep.file}</bdi></b>${periodText(rep) && html`<span>· ${periodText(rep)}</span>`}${rep.months.length > 0 && html`<span>· ${rep.months.length} חודשים</span>`}</p>

    ${rep.checks.length === 0
      ? html`<p class="mt-3 flex items-start gap-2 rounded-xl bg-warn-50 px-3 py-2.5 text-[14px] text-warn"><${Icon} name="info" size=${17} class="mt-0.5 shrink-0" />בקובץ אין שורות סיכום לבדוק מולן. כדאי לעבור על השורות לפני השמירה.</p>`
      : bad.length === 0
        ? html`<div class="mt-3 rounded-xl bg-money-50 px-3 py-2.5 text-[14px] text-ink">
            <p class="flex items-center gap-2 font-bold text-money"><${Icon} name="circle-check" size=${17} />הסכומים תואמים לדוח${rep.months.length > 1 ? `, בכל ${rep.months.length} החודשים` : ''}</p>
            <p class="mt-0.5 text-[13px] text-muted">נבדק מול השורות: ${rep.checks.map((c) => `${c.name} ${exact(c.inFile)}`).join(' · ')}</p>
          </div>`
        : html`<div class="mt-3 rounded-xl bg-error-50 px-3 py-2.5 text-[14px] text-ink">
            <p class="flex items-center gap-2 font-bold text-error"><${Icon} name="triangle-alert" size=${17} />יש פער מול שורת סיכום בקובץ</p>
            ${bad.map((c) => html`<p class="mt-0.5 text-[13px]">"${c.name}" בקובץ: ${exact(c.inFile)}. קראנו: ${exact(c.read)}${c.bad.length && c.bad[0] !== 'all' ? ` (ב${c.bad.map(monthName).join(', ')})` : ''}. כדאי לבדוק את השורות שמעליה.</p>`)}
          </div>`}
    ${changed && html`<p class="mt-2 text-[13px] text-muted">שינית שורות, ולכן הסכומים כבר לא כמו בדוח: הכנסות ${exact(base.in)} בדוח, ${exact(t.in)} אחרי השינוי.</p>`}

    <dl class="mt-4 grid gap-1.5 rounded-[14px] bg-white px-4 py-3 sm:grid-cols-3 sm:gap-3">
      <div class="flex items-baseline justify-between gap-2 sm:block"><dt class="flex items-center gap-1.5 text-[13px] font-bold text-muted"><span class="h-2.5 w-2.5 rounded-sm" style=${{ background: IN }}></span>הכנסות</dt><dd class="whitespace-nowrap font-display text-[16px] font-extrabold tabular-nums sm:text-[18px] md:text-[22px]">${exact(t.in)}</dd></div>
      <div class="flex items-baseline justify-between gap-2 sm:block"><dt class="flex items-center gap-1.5 text-[13px] font-bold text-muted"><span class="h-2.5 w-2.5 rounded-sm" style=${{ background: OUT }}></span>הוצאות</dt><dd class="whitespace-nowrap font-display text-[16px] font-extrabold tabular-nums sm:text-[18px] md:text-[22px]">${exact(t.out)}</dd></div>
      <div class="flex items-baseline justify-between gap-2 sm:block"><dt class="text-[13px] font-bold text-muted">${t.net < 0 ? 'הפסד' : 'רווח'}</dt><dd class=${cx('whitespace-nowrap font-display text-[16px] font-extrabold tabular-nums sm:text-[18px] md:text-[22px]', t.net < 0 && 'text-error')}>${exact(Math.abs(t.net))}</dd></div>
    </dl>

    ${['in', 'out'].map(
      (kind) => html`<section key=${kind} class="mt-4">
        <h3 class="flex items-baseline justify-between text-[15px] font-extrabold">${kind === 'in' ? 'הכנסות' : 'הוצאות'}<span class="text-[12px] font-bold text-muted">${group(kind).length} שורות</span></h3>
        <ul class="mt-1">${group(kind).map(row)}</ul>
      </section>`,
    )}
    ${rep.zero > 0 && html`<p class="mt-3 text-[12px] text-muted">עוד ${rep.zero} שורות בקובץ בלי סכום בכלל, ולכן לא מוצגות.</p>`}
  <//>`;
}

// ---------- the board ----------

export function ReportInvite({ on, class: cls = '' }) {
  return html`<div class=${cx('flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[16px] border-[1.5px] border-dashed border-brand-300 bg-white/70 px-4 py-3', cls)}>
    <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-600"><${Icon} name="file-spreadsheet" size=${20} /></span>
    <p class="min-w-0 grow basis-[240px]"><b class="block text-[15px]">יש לך מערכת חשבוניות?</b><span class="text-[14px] text-muted">מעלים דוח רווח והפסד באקסל, וההכנסות וההוצאות שנרשמו שם נכנסות לכאן לפי חודשים.</span></p>
    <${Button} variant="mini" onClick=${on.importReport}><${Icon} name="upload" size=${15} />העלאת דוח<//>
  </div>`;
}

function Lines({ items, total, color }) {
  const [all, setAll] = useState(false);
  const list = [...items].sort((a, b) => b.total - a.total);
  const shown = all ? list : list.slice(0, 5);
  return html`<div>
    <ul class="flex flex-col gap-2">
      ${shown.map(
        (x) => html`<li key=${x.id}>
          <div class="flex items-baseline justify-between gap-2 text-[14px]"><span class="min-w-0 truncate">${x.name}</span><b class="shrink-0 font-display tabular-nums">${fmt(x.total)}</b></div>
          <div class="mt-1 h-2 rounded-full bg-line/60"><div class="h-2 rounded-full" style=${{ width: `${Math.max(2, (x.total / (list[0]?.total || 1)) * 100)}%`, background: color }}></div></div>
        </li>`,
      )}
    </ul>
    ${list.length > 5 && html`<button type="button" onClick=${() => setAll((a) => !a)} class="mt-2 text-[13px] font-bold text-brand-600 hover:underline cursor-pointer">${all ? 'פחות' : `עוד ${list.length - 5} שורות`}</button>`}
    <p class="mt-2 border-t border-line pt-2 text-[13px] text-muted">סך הכול <b class="font-display tabular-nums text-ink">${fmt(total)}</b></p>
  </div>`;
}

export function ReportPanel({ state, on, n }) {
  const rep = state.report;
  const [asTable, setAsTable] = useState(false);
  const t = reportTotals(rep);
  const kept = rep.items.filter((x) => x.include);
  const has = (name) => state.expenses.some((e) => e.name === name);
  const rec = recurring(rep).filter((x) => !has(x.name));
  const best = t.months.length > 1 ? t.months.reduce((a, b) => (b.net > a.net ? b : a)) : null;
  return html`<section class="fb-panel flex min-w-0 flex-col !p-4 md:!p-6">
    <div class="mb-4 flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 class="fb-h3 flex items-center gap-2.5">${n != null && html`<span class="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-600 font-display text-[16px] font-extrabold text-white" aria-hidden="true">${n}</span>`}רווח והפסד, מהדוח שהעלית</h2>
        <p class="mt-1 flex flex-wrap items-center gap-x-1.5 text-[14px] text-muted"><${Icon} name="file-spreadsheet" size=${15} /><bdi>${rep.file}</bdi>${periodText(rep) && ` · ${periodText(rep)}`}</p>
      </div>
      <div class="flex shrink-0 items-center gap-1">
        ${t.months.length > 1 && html`<button type="button" onClick=${() => setAsTable((v) => !v)} class="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-[14px] font-bold text-brand-600 hover:bg-brand-50 cursor-pointer"><${Icon} name=${asTable ? 'chart-column' : 'table-2'} size=${16} />${asTable ? 'גרף' : 'טבלה'}</button>`}
        <${Button} variant="mini" onClick=${on.importReport}><${Icon} name="upload" size=${15} />דוח מעודכן<//>
      </div>
    </div>

    <div class="flex flex-wrap items-end gap-x-8 gap-y-3">
      <div>
        <p class="text-[13px] font-bold text-muted">${t.net < 0 ? 'הפסד בתקופה' : 'רווח בתקופה'}</p>
        <p class=${cx('font-display text-[36px] font-extrabold leading-none tabular-nums md:text-[44px]', t.net < 0 ? 'text-error' : 'text-ink')}>${fmt(Math.abs(t.net))}</p>
      </div>
      <dl class="flex gap-6 pb-1">
        <div><dt class="flex items-center gap-1.5 text-[13px] font-bold text-muted"><span class="h-2.5 w-2.5 rounded-sm" style=${{ background: IN }}></span>הכנסות</dt><dd class="font-display text-[20px] font-extrabold tabular-nums">${fmt(t.in)}</dd></div>
        <div><dt class="flex items-center gap-1.5 text-[13px] font-bold text-muted"><span class="h-2.5 w-2.5 rounded-sm" style=${{ background: OUT }}></span>הוצאות</dt><dd class="font-display text-[20px] font-extrabold tabular-nums">${fmt(t.out)}</dd></div>
      </dl>
    </div>
    ${t.months.length > 1 &&
    html`<p class="mt-2 text-[14px] text-muted">הכנסה ב-${t.withIncome} מתוך ${t.months.length} חודשים${best && best.net > 0 ? `. החודש הכי טוב: ${monthName(best.month)}, רווח של ${fmt(best.net)}` : ''}.</p>`}

    ${t.months.length > 1 &&
    html`<div class="mt-4">
      ${asTable ? html`<${MonthTable} months=${t.months} />` : html`<${MonthBars} months=${t.months} />`}
      ${!asTable &&
      html`<ul class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-semibold text-muted" aria-label="מקרא">
        <li class="flex items-center gap-1.5"><span class="h-3 w-3 rounded-sm" style=${{ background: IN }}></span>הכנסות</li>
        <li class="flex items-center gap-1.5"><span class="h-3 w-3 rounded-sm" style=${{ background: OUT }}></span>הוצאות</li>
      </ul>`}
    </div>`}

    <div class="mt-5 grid gap-5 md:grid-cols-2">
      <div><h3 class="mb-2 text-[15px] font-extrabold">ההכנסות לפי שורה</h3><${Lines} items=${kept.filter((x) => x.kind === 'in')} total=${t.in} color=${IN} /></div>
      <div><h3 class="mb-2 text-[15px] font-extrabold">ההוצאות לפי שורה</h3><${Lines} items=${kept.filter((x) => x.kind === 'out')} total=${t.out} color=${OUT} /></div>
    </div>

    ${rec.length > 0 &&
    html`<div class="mt-5 rounded-[14px] bg-brand-100/60 px-4 py-3">
      <p class="text-[14px] font-bold text-brand-600">הוצאות שחוזרות כמעט כל חודש בדוח</p>
      <p class="text-[13px] text-muted">כדאי שיהיו בהוצאות הקבועות, כדי ש"כמה זמן הכסף מחזיק" ונקודת האיזון יכללו אותן.</p>
      <ul class="mt-2 flex flex-col gap-1.5">
        ${rec.map(
          (x) => html`<li key=${x.id} class="flex flex-wrap items-center justify-between gap-2 text-[14px]">
            <span><b>${x.name}</b> · <span class="font-display font-extrabold tabular-nums">${fmt(x.monthly)}</span> בחודש<span class="text-muted">, ב-${x.months} חודשים</span></span>
            <button type="button" onClick=${() => on.addRecurring([x])} class="text-[13px] font-bold text-brand-600 hover:underline cursor-pointer">להוספה להוצאות הקבועות</button>
          </li>`,
        )}
      </ul>
      ${rec.length > 1 && html`<${Button} variant="mini" class="mt-2.5" onClick=${() => on.addRecurring(rec)}><${Icon} name="plus" size=${15} />להוסיף את כולן<//>`}
    </div>`}

    <p class="mt-4 flex items-start gap-1.5 text-[13px] text-muted"><${Icon} name="info" size=${15} class="mt-0.5 shrink-0" />הדוח מראה מה נרשם במערכת החשבוניות. הוא לא משנה את הכסף שיש היום בקופה, שמגיע מהבנק.</p>
  </section>`;
}

// Income and expenses side by side for each month. Bars start at zero, one scale for
// both, and every bar's amount is in the tooltip and in the table view.
function MonthBars({ months }) {
  const box = useRef();
  const W = useWidth(box, 720);
  const [hover, setHover] = useState(null);
  const small = W < 520;
  const H = small ? 200 : 240;
  const PAD = { top: 14, right: 8, bottom: 28, left: small ? 46 : 60 };
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const hi = Math.max(1, ...months.flatMap((m) => [m.in, m.out]));
  const raw = hi / (small ? 3 : 4);
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw);
  const yMax = Math.ceil(hi / step) * step;
  const y = (v) => PAD.top + ih - (v / yMax) * ih;
  const slot = iw / months.length;
  const bw = Math.max(3, Math.min(22, (slot - 10) / 2));
  // Time runs left to right, like the cash chart.
  const cx0 = (i) => PAD.left + slot * i + slot / 2;
  const ticks = [];
  for (let v = 0; v <= yMax + 1; v += step) ticks.push(v);
  const tick = (v) => (small && v >= 1000 ? `${v / 1000}K ₪` : fmt(v));
  const bar = (x, v, color) => {
    const h = Math.max(0, y(0) - y(v));
    const r = Math.min(4, h, bw / 2);
    // Rounded at the top only, flat on the baseline.
    return h <= 0
      ? null
      : html`<path d=${`M${x} ${y(0)} V${y(v) + r} Q${x} ${y(v)} ${x + r} ${y(v)} H${x + bw - r} Q${x + bw} ${y(v)} ${x + bw} ${y(v) + r} V${y(0)} Z`} fill=${color} />`;
  };
  const hm = hover != null ? months[hover] : null;
  const tipLeft = hm ? Math.min(Math.max(cx0(hover) - 95, 4), W - 194) : 0;
  return html`<div ref=${box} class="relative" dir="ltr">
    <svg
      width=${W}
      height=${H}
      viewBox=${`0 0 ${W} ${H}`}
      role="img"
      tabindex="0"
      aria-label=${`הכנסות והוצאות לפי חודש, מ${monthName(months[0].month)} עד ${monthName(months[months.length - 1].month)}. החיצים מראים כל חודש.`}
      class="block select-none rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
      onPointerMove=${(e) => {
        const r = box.current.getBoundingClientRect();
        const i = Math.floor((e.clientX - r.left - PAD.left) / slot);
        setHover(i >= 0 && i < months.length ? i : null);
      }}
      onPointerLeave=${() => setHover(null)}
      onBlur=${() => setHover(null)}
      onKeyDown=${(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          setHover((h) => Math.max(0, Math.min(months.length - 1, (h ?? -1) + (e.key === 'ArrowRight' ? 1 : -1))));
        }
      }}
    >
      ${ticks.map(
        (v) => html`<g key=${v}>
          <line x1=${PAD.left} x2=${W - PAD.right} y1=${y(v)} y2=${y(v)} stroke=${v === 0 ? '#9aa1ab' : GRID} />
          <text x=${PAD.left - 8} y=${y(v) + 4} text-anchor="end" font-size="12" font-weight="600" fill=${MUTED} font-family=${FONT} style="font-variant-numeric: tabular-nums">${tick(v)}</text>
        </g>`,
      )}
      ${months.map(
        (m, i) => html`<g key=${m.month}>
          ${hover === i && html`<rect x=${PAD.left + slot * i + 2} y=${PAD.top} width=${slot - 4} height=${ih} rx="6" fill=${INK} opacity="0.05" />`}
          ${bar(cx0(i) - bw - 1, m.in, IN)}
          ${bar(cx0(i) + 1, m.out, OUT)}
          ${(!small || i % 2 === 0 || months.length <= 6) && html`<text x=${cx0(i)} y=${H - 9} text-anchor="middle" font-size="12" font-weight="700" fill=${MUTED} font-family=${FONT}>${small && months.length > 6 ? monthName(m.month).slice(0, 3) : monthName(m.month)}</text>`}
        </g>`,
      )}
    </svg>
    ${hm &&
    html`<div dir="rtl" class="pointer-events-none absolute top-0 z-10 w-[190px] rounded-xl bg-ink px-3 py-2 text-white shadow-xl" style=${{ left: `${tipLeft}px` }}>
      <p class="text-[12px] font-bold text-brand-300">${monthName(hm.month)} ${hm.month.slice(0, 4)}</p>
      <p class="flex justify-between text-[13px]"><span>הכנסות</span><span class="tabular-nums">${fmt(hm.in)}</span></p>
      <p class="flex justify-between text-[13px]"><span>הוצאות</span><span class="tabular-nums">${fmt(hm.out)}</span></p>
      <p class="mt-0.5 flex justify-between border-t border-white/20 pt-0.5 text-[13px] font-bold"><span>${hm.net < 0 ? 'הפסד' : 'רווח'}</span><span class="tabular-nums">${fmt(Math.abs(hm.net))}</span></p>
    </div>`}
  </div>`;
}

function MonthTable({ months }) {
  return html`<table class="w-full text-[14px]">
    <thead><tr class="text-[12px] font-bold text-muted"><th class="pb-1.5 text-start">חודש</th><th class="pb-1.5 text-start">הכנסות</th><th class="pb-1.5 text-start">הוצאות</th><th class="pb-1.5 text-start">רווח</th></tr></thead>
    <tbody>
      ${months.map(
        (m) => html`<tr key=${m.month} class="border-t border-line">
          <td class="py-2 font-bold">${monthName(m.month)} ${m.month.slice(2, 4)}</td>
          <td class="py-2 tabular-nums">${fmt(m.in)}</td>
          <td class="py-2 tabular-nums">${fmt(m.out)}</td>
          <td class=${cx('py-2 font-display font-extrabold tabular-nums', m.net < 0 && 'text-error')}>${m.net < 0 ? `−${fmt(-m.net)}` : fmt(m.net)}</td>
        </tr>`,
      )}
    </tbody>
  </table>`;
}
