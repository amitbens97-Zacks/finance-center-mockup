// Developer notes for the finance center, plus scenarios (Shift+D).
import { html, Icon, cx } from './lib.js';
import { SCENARIOS } from './data.js';

const NOTES = [
  {
    title: 'שלושה שלבים',
    items: [
      'המרכז הפיננסי מתאים את עצמו לשלב של העסק, ומראה לוח אחר בכל שלב.',
      'שלב 1, הקמה (אין לקוחות משלמים): תקציב ההקמה מול מה ששולם, כמה זמן הכסף מחזיק, נקודת האיזון, הכנה ללקוח הראשון.',
      'שלב 2, לקוחות ראשונים: תשלומים מלקוחות, נכנס ויוצא החודש, כמה נשאר, והאם ההכנסות כיסו את ההוצאות.',
      'שלב 3, עסק פעיל: ניהול תזרים מלא (הקופה, הגרף, 30 הימים הקרובים, כרית ביטחון, שבוע במספרים).',
    ],
  },
  {
    title: 'איך נקבע השלב',
    items: [
      'כניסה ראשונה: "איפה העסק עומד היום?" עם שלוש תשובות. התשובה שהנתונים מצביעים עליה מסומנת "לפי הנתונים".',
      'בשלב 1 הכניסה הראשונה שואלת רק כמה כסף יש היום לעסק. מה ששולם מתקציב ההקמה לא נשאל: הוא מגיע אוטומטית מ"העסק במספרים".',
      'לפי הנתונים: אין עסקה ב"נסגר" = שלב 1. יש עסקאות = שלב 2. 3 חודשים ברציפות עם תשלום שהתקבל = שלב 3.',
      'מעבר משלב 1 ל-2: כשליד ראשון עובר ל"נסגר", הכריש מציע. המשתמש מאשר בלחיצה.',
      'מעבר משלב 2 ל-3: אחרי 3 חודשים ברציפות עם הכנסה, הכריש מציע. במעבר שתי שאלות: היתרה בבנק וכרית ביטחון.',
      'אפשר לשנות שלב ידנית: "מה כל שלב כולל" או ההגדרות. אף פעם לא מעבר אוטומטי בלי אישור.',
    ],
  },
  {
    title: 'הכללים של המספרים (בקוד, לא במודל)',
    items: [
      'הכסף של העסק = הסכום מהכניסה הראשונה + תשלומים שסומנו "התקבל" − הוצאות קבועות ביום החיוב − תשלומי הקמה ביום התשלום + עדכונים.',
      'כמה זמן הכסף מחזיק: הכסף היום, פחות מה שנשאר לשלם על ההקמה, ואז כל הוצאה קבועה (וכל תשלום שנקבע מלקוח) לפי התאריך. החודש האחרון שבו הכסף לא יורד מתחת לאפס.',
      'נקודת האיזון = ההוצאות הקבועות בחודש ÷ (1 − אחוז המס). ליעד: (היעד + ההוצאות) ÷ (1 − אחוז המס). מכירות בחודש = הסכום ÷ המחיר בסל, מעוגל למעלה.',
      'בשלב 3: הקופה הצפויה רק מתשלומים שנקבעו. תשלום באיחור יוצא מהצפי. עסקאות פתוחות רק כטווח נפרד.',
      'הפרשה למס = אחוז מכל הכנסה, לפי סוג העוסק. מוצגת כהפרשה, לא כייעוץ מס.',
    ],
  },
  {
    title: 'מאיפה הנתונים',
    items: [
      'תקציב ההקמה וההוצאות הקבועות: מ"העסק במספרים". חדש: בתקציב ההקמה שם נאסף גם כמה שולם, מתי, ו"שולם במלואו", ומשם נכנס למרכז הפיננסי אוטומטית.',
      'עסקאות ולוח תשלומים: מהלידים. ליד שעובר ל"נסגר" פותח את חלון לוח התשלומים.',
      'דרך תשלום (ביט, פייבוקס, העברה, קישור לאשראי): חדש, בהגדרות הכספים. נכנסת להודעת התזכורת.',
      'סוג עוסק: מאזור רואה החשבון. מוצרים ומחירים: מסל המוצרים.',
      'כל הנתונים לפי העסק הפעיל בלבד.',
    ],
  },
];

export function DevPanel({ open, onClose, scenario, onScenario }) {
  return html`<aside
    class=${cx(
      'fixed inset-y-0 end-0 z-40 flex w-full max-w-sm flex-col border-s border-slate-200 bg-white shadow-2xl transition-transform duration-300',
      open ? 'translate-x-0' : '-translate-x-full pointer-events-none invisible',
    )}
    aria-hidden=${!open}
  >
    <div class="flex items-center justify-between border-b border-slate-200 px-4 py-3">
      <h2 class="flex items-center gap-2 text-[16px] font-bold text-slate-900"><${Icon} name="code-xml" size=${17} /> הערות למפתחים</h2>
      <button type="button" onClick=${onClose} aria-label="סגירה" class="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer"><${Icon} name="x" size=${18} /></button>
    </div>
    <div class="flex-1 overflow-y-auto thin-scroll p-4 text-[14px] leading-relaxed text-slate-700">
      <section class="mb-5 rounded-xl border border-dashed border-brand-300 bg-brand-50/60 p-3">
        <h3 class="mb-2 font-bold text-brand-900">תרחישים</h3>
        <p class="mb-2 text-[12px] text-slate-600">"היום" במוק-אפ הוא 29.10.2026, כדי שהמספרים יישארו קבועים.</p>
        <div class="flex flex-col gap-1.5">
          ${SCENARIOS.map(
            (s) => html`<button
              key=${s.id}
              type="button"
              onClick=${() => onScenario(s.id)}
              aria-pressed=${scenario === s.id}
              class=${cx(
                'rounded-lg border px-3 py-1.5 text-start text-[12px] font-medium cursor-pointer',
                scenario === s.id ? 'border-brand-600 bg-brand-600 text-white' : 'border-brand-200 bg-white text-brand-800 hover:bg-brand-100',
              )}
            >${s.label}</button>`,
          )}
        </div>
      </section>
      ${NOTES.map(
        (n) => html`<section key=${n.title} class="mb-4 p-1">
          <h3 class="mb-1.5 font-bold text-slate-900">${n.title}</h3>
          <ul class="list-disc space-y-1 ps-4">${n.items.map((t) => html`<li>${t}</li>`)}</ul>
        </section>`,
      )}
    </div>
  </aside>`;
}
