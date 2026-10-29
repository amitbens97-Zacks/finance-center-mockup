// Developer notes for the finance center, plus scenarios (Shift+D).
import { html, Icon, cx } from './lib.js';
import { SCENARIOS } from './data.js';

const NOTES = [
  {
    title: 'מה בעמוד',
    items: [
      'ארבעה מספרים למעלה: בקופה היום, נכנס החודש, יוצא החודש, ורווח נקי החודש מול היעד.',
      'תזכורות (עד 3 בעמוד, כולן בפעמון): תשלום באיחור, תשלום שמגיע ב-3 הימים הקרובים, קופה מתחת לכרית הביטחון. לכל אחת פעולה אחת.',
      'גרף הקופה עד סוף דצמבר, ולידו "מגיע ב-30 הימים הקרובים".',
      'שלוש לשוניות: שבוע במספרים, תשלומים מלקוחות, הוצאות קבועות.',
      'הכריש מתריע רק על אירוע עסקי, עם פעולה אחת. כשהכול בזמן: הודעה שקטה.',
      'כניסה ראשונה: שלוש שאלות (יתרה, יום חיוב להוצאות, כרית ומס), ואז הלוח.',
    ],
  },
  {
    title: 'הכללים של המספרים (בקוד, לא במודל)',
    items: [
      'בקופה = יתרת פתיחה + תשלומים שסומנו "התקבל" − הוצאות ביום החיוב + עדכוני יתרה. רק מה שקרה אחרי תאריך יתרת הפתיחה.',
      'הקופה הצפויה (קו מקווקו) נבנית רק מתשלומים שנקבעו ומהוצאות. תשלום באיחור יוצא מהצפי עד שמסמנים "התקבל".',
      'עסקאות פתוחות מוצגות כטווח נפרד (אזור תכלת) ובקופסה "אולי ייכנס". אף פעם לא בתוך הקופה הצפויה.',
      'נכנס החודש = תשלומים שהתקבלו בחודש. יוצא החודש = הוצאות החודש + ההפרשה למס.',
      'הפרשה למס = אחוז מכל הכנסה, לפי סוג העוסק מאזור רואה החשבון. מוצגת כהפרשה, לא כייעוץ מס.',
      'רווח נקי = נכנס − הוצאות − הפרשה למס. היעד מ"העסק במספרים".',
      'מנוי חודשי חוזר כל חודש עד ביטול. תשלומים מחולקים: הסכום לחלק שווה, והשארית בתשלום האחרון.',
      'ציר הזמן בגרף משמאל לימין, כמו בגרפים של הבנק.',
    ],
  },
  {
    title: 'מאיפה הנתונים',
    items: [
      'יתרת פתיחה, כרית ביטחון ואחוז מס: רשומה חדשה של הגדרות כספים לכל עסק.',
      'עסקאות ולוח תשלומים: מהלידים (CRM). כשליד עובר ל"נסגר" נפתח חלון לוח התשלומים, עם המוצר והמחיר מהסל ותנאי התשלום מההצעה המנצחת. במוק-אפ: "עסקה שנסגרה" בלשונית התשלומים.',
      'הוצאות קבועות: מ"העסק במספרים" (היום "תקציב הקמה"), עם יום חיוב ותדירות.',
      'לידים ושיחות לשבוע: מהלידים. היעד לשבוע: מהתוכנית אחורה מהיעד ב"העסק במספרים".',
      'הקישור לתשלום בתזכורת: מהשלב "גביית כספים".',
      'כל הנתונים לפי העסק הפעיל בלבד (בלי ערבוב בין עסקים של אותו משתמש).',
    ],
  },
  {
    title: 'מה יורד מהעמוד של היום',
    items: [
      'מסלול הרצה: נבלע בגרף הקופה ובכרית הביטחון.',
      '"איפה הכסף נשרף": הופך לרשימת ההוצאות הקבועות עם יום חיוב.',
      'קטלוג "מוצרים ותמחור" נפרד: המוצרים נקראים מהסל.',
      'התחזית השנתית: עוברת ל"העסק במספרים", ומופיעה כאן רק כיעד.',
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
