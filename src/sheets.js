// The windows of the finance center. On a phone each one opens from the bottom.
import { html, useState, Icon, PencilCheck, cx } from './lib.js';
import { Button } from './components.js';
import { Sheet, Field, MoneyInput, Chips, Tag, inputCls } from './ui.js';
import { TODAY, USER, PRODUCTS, TERMS, CATEGORIES, FREQS, ENTITIES, PAY_METHODS, STAGES } from './data.js';
import { addDays, dm, dayName, fmt, signed, balanceOn, schedule, paymentLabel, productOf, termsOf, monthlyCost, monthlyFixed, waLink } from './finance.js';

const payLine = (m) => {
  if (!m) return '';
  const pm = PAY_METHODS.find((x) => x.id === m.id);
  return m.id === 'card' ? `אפשר לשלם בקישור: ${m.detail}` : `אפשר להעביר ב${pm.label}: ${m.detail}`;
};

export function RemindSheet({ state, deal, payment, onClose, onSend, onPayMethod }) {
  const late = payment.due < TODAY;
  const pay = payLine(state.payMethod);
  const [text, setText] = useState(
    late
      ? `היי ${deal.client.split(' ')[0]}, תזכורת קטנה: ${paymentLabel(deal, payment)} (${fmt(payment.amount)}) על "${productOf(deal.product)?.name}" היה אמור להיכנס ב-${dm(payment.due)}.${pay ? ` ${pay}.` : ''} תודה! ${USER.firstName}`
      : `היי ${deal.client.split(' ')[0]}, רק מזכיר ש${paymentLabel(deal, payment)} (${fmt(payment.amount)}) מגיע ב-${dm(payment.due)}.${pay ? ` ${pay}.` : ''} תודה! ${USER.firstName}`,
  );
  return html`<${Sheet}
    title="תזכורת ב-WhatsApp"
    onClose=${onClose}
    footer=${html`<${Button} variant="secondary" onClick=${onClose}>חזרה<//><${Button} onClick=${() => onSend(waLink(deal.phone, text))}><${Icon} name="message-circle" size=${18} />פתיחה ב-WhatsApp<//>`}
  >
    <p class="mb-3 text-[14px] text-muted">אל <b class="text-ink">${deal.client}</b> · ${deal.phone}. ההודעה כתובה בשפה שלך, ואפשר לשנות אותה לפני השליחה.</p>
    <div class="rounded-[14px] bg-[#e7f4ef] p-3">
      <textarea rows="5" value=${text} onInput=${(e) => setText(e.target.value)} class="w-full resize-none rounded-xl bg-white p-3 text-[16px] leading-relaxed text-ink outline-none focus:ring-4 focus:ring-brand-100"></textarea>
    </div>
    ${!state.payMethod &&
    html`<button type="button" onClick=${onPayMethod} class="mt-2 flex w-full items-center gap-2 rounded-xl bg-warn-50 px-3 py-2 text-start text-[14px] font-semibold text-warn cursor-pointer">
      <${Icon} name="wallet" size=${17} />עוד לא הגדרת איך לקוחות משלמים לך. להגדרה, והפרטים ייכנסו להודעה
    </button>`}
    <p class="mt-2 text-[12px] text-muted">FlowBiz לא שולחים את ההודעה בעצמם: הכפתור פותח את השיחה עם ${deal.client.split(' ')[0]} ב-WhatsApp, ההודעה כבר כתובה, ונשאר רק ללחוץ שליחה.</p>
  <//>`;
}

export function BalanceSheet({ state, onClose, onSave }) {
  const calc = balanceOn(state, TODAY);
  const [v, setV] = useState(calc);
  const diff = v == null ? 0 : v - calc;
  return html`<${Sheet}
    title=${state.stage === 'active' ? 'עדכון יתרה' : 'כמה כסף יש לעסק?'}
    onClose=${onClose}
    footer=${html`<${Button} variant="secondary" onClick=${onClose}>חזרה<//><${Button} disabled=${v == null} onClick=${() => onSave(v)}>שמירה<//>`}
  >
    <${Field} label=${state.stage === 'active' ? 'כמה יש היום בחשבון העסק?' : 'כמה כסף יש היום לעסק?'} hint="אפשר לבדוק באפליקציה של הבנק. פעם בחודש נבקש לאשר את המספר.">
      <${MoneyInput} value=${v} onInput=${setV} big autofocus />
    <//>
    <p class="rounded-xl bg-white p-3 text-[14px]">
      לפי החישוב: <b class="font-display tabular-nums">${fmt(calc)}</b>
      ${diff !== 0 && html`<br />ההפרש, <b class="font-display tabular-nums">${signed(diff)}</b>, יירשם כ"עדכון יתרה" של היום. אם זה תשלום או הוצאה שלא נרשמו, עדיף להוסיף אותם.`}
    </p>
  <//>`;
}

export function ExpenseSheet({ expense, onClose, onSave, onDelete }) {
  const [x, setX] = useState(expense || { name: '', amount: null, category: 'tools', freq: 'monthly', day: 1 });
  const set = (k, v) => setX((o) => ({ ...o, [k]: v }));
  const setFreq = (f) => setX((o) => ({ ...o, freq: f, day: f === 'monthly' ? 1 : f === 'weekly' ? 0 : f === 'yearly' ? '01-01' : addDays(TODAY, 7) }));
  const ok = x.name.trim() && x.amount > 0;
  return html`<${Sheet}
    title=${expense ? 'עריכת הוצאה קבועה' : 'הוצאה קבועה חדשה'}
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

// One item of the setup budget: what was planned, what was paid, and whether it is done.
export function SetupItemSheet({ item, onClose, onSave, onDelete }) {
  const [x, setX] = useState(item || { name: '', icon: 'circle-dot', planned: null, spent: 0, spentOn: null, done: false });
  const set = (k, v) => setX((o) => ({ ...o, [k]: v }));
  const ok = x.name.trim() && x.planned > 0;
  const over = (x.spent || 0) - (x.planned || 0);
  return html`<${Sheet}
    title=${item ? x.name || 'פריט בתקציב' : 'פריט חדש בתקציב ההקמה'}
    onClose=${onClose}
    footer=${html`<span class="flex gap-2">${item ? html`<${Button} variant="text" class="!text-error" onClick=${() => onDelete(x)}><${Icon} name="trash-2" size=${15} />מחיקה<//>` : html`<${Button} variant="secondary" onClick=${onClose}>חזרה<//>`}</span>
      <${Button} disabled=${!ok} onClick=${() => onSave({ ...x, spentOn: x.spent > 0 ? (x.spent !== (item?.spent || 0) ? TODAY : x.spentOn) : null })}>שמירה<//>`}
  >
    ${!item && html`<${Field} label="מה צריך לקנות או לשלם?"><input class=${inputCls} value=${x.name} onInput=${(e) => set('name', e.target.value)} placeholder="למשל: מיקרופון" /><//>`}
    <div class="grid grid-cols-2 gap-3">
      <${Field} label="תכננת"><${MoneyInput} value=${x.planned} onInput=${(v) => set('planned', v)} /><//>
      <${Field} label="שילמת עד היום"><${MoneyInput} value=${x.spent} onInput=${(v) => set('spent', v ?? 0)} autofocus=${!!item} /><//>
    </div>
    ${over > 0 && html`<p class="-mt-1 mb-3 flex items-center gap-1.5 text-[14px] font-bold text-warn"><${Icon} name="triangle-alert" size=${16} />${fmt(over)} מעל מה שתכננת</p>`}
    <button
      type="button"
      role="checkbox"
      aria-checked=${x.done}
      onClick=${() => set('done', !x.done)}
      class=${cx('flex w-full items-center gap-3 rounded-xl border-[1.5px] bg-white px-3 py-3 text-start cursor-pointer', x.done ? 'border-brand-600' : 'border-line')}
    >
      <span class=${cx('grid h-6 w-6 place-items-center rounded-md border-2', x.done ? 'border-ink' : 'border-line')}>${x.done && html`<${PencilCheck} size=${16} color="#0038b8" weight=${3} />`}</span>
      <span><b class="block text-[15px]">שולם במלואו</b><span class="text-[13px] text-muted">אין עוד מה לשלם על הפריט הזה</span></span>
    </button>
    <p class="mt-3 text-[12px] text-muted">התקציב מ"העסק במספרים". מה ששילמת יורד מהכסף של העסק ביום התשלום.</p>
  <//>`;
}

// How clients pay. Until FlowBiz connects to a clearing provider, the user's own details.
export function PayMethodSheet({ state, onClose, onSave }) {
  const [id, setId] = useState(state.payMethod?.id || 'bit');
  const [detail, setDetail] = useState(state.payMethod?.detail || '');
  const m = PAY_METHODS.find((x) => x.id === id);
  return html`<${Sheet}
    title="איך הלקוח משלם לך?"
    onClose=${onClose}
    footer=${html`<${Button} variant="secondary" onClick=${onClose}>חזרה<//><${Button} disabled=${!detail.trim()} onClick=${() => onSave({ id, detail: detail.trim() })}>שמירה<//>`}
  >
    <p class="mb-3 text-[14px] text-muted">הפרטים נכנסים לכל תזכורת תשלום ללקוח, כדי שיהיה לו קל לשלם.</p>
    <div class="mb-4 grid grid-cols-2 gap-2">
      ${PAY_METHODS.map(
        (p) => html`<button
          key=${p.id}
          type="button"
          role="radio"
          aria-checked=${id === p.id}
          onClick=${() => setId(p.id)}
          class=${cx('fb-tile !gap-2.5 !px-3 !py-2.5', id === p.id && 'is-on')}
        ><span class="fb-chip-ic !h-9 !w-9"><${Icon} name=${p.icon} size=${18} /></span><b class="!text-[15px]">${p.label}</b></button>`,
      )}
    </div>
    <${Field} label=${m.ask}><input class=${inputCls} dir=${id === 'bank' ? 'rtl' : 'ltr'} value=${detail} onInput=${(e) => setDetail(e.target.value)} placeholder=${id === 'bank' ? 'למשל: לאומי, סניף 802, חשבון 123456' : id === 'card' ? 'https://' : '050-0000000'} /><//>
  <//>`;
}

// What opens in the CRM when a lead moves to "נסגר": the payment schedule of the deal,
// by the payment terms of the winning offer. In the mockup it opens from the payments list.
export function DealSheet({ state, onClose, onSave }) {
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
      <p class="mb-1.5 text-[12px] font-bold text-muted">לוח התשלומים</p>
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

export function SettingsSheet({ state, onClose, onSave, onStages }) {
  const [cushion, setCushion] = useState(state.cushion);
  const [taxPct, setTax] = useState(state.taxPct);
  const monthly = Math.round(state.expenses.reduce((s, x) => s + monthlyCost(x), 0));
  return html`<${Sheet}
    title="הגדרות"
    onClose=${onClose}
    footer=${html`<${Button} variant="secondary" onClick=${onClose}>חזרה<//><${Button} onClick=${() => onSave({ cushion, taxPct })}>שמירה<//>`}
  >
    <button type="button" onClick=${onStages} class="mb-4 flex w-full items-center gap-3 rounded-xl bg-white px-3 py-3 text-start ring-1 ring-line hover:ring-brand-300 cursor-pointer">
      <span class="fb-chip-ic !h-9 !w-9"><${Icon} name="milestone" size=${18} /></span>
      <span class="flex-1"><b class="block text-[15px]">השלב של העסק: ${STAGES.find((s) => s.id === state.stage).label}</b><span class="text-[13px] text-muted">לשינוי השלב</span></span>
      <${Icon} name="chevron-left" size=${18} class="text-muted" />
    </button>
    ${state.stage === 'active' &&
    html`<${Field} label="כרית ביטחון" hint=${`הצעה: שני חודשי הוצאות, ${fmt(monthly * 2)}.`}><${MoneyInput} value=${cushion} onInput=${setCushion} /><//>`}
    <${Field} label="הפרשה למס, באחוזים מכל הכנסה" hint=${`ברירת המחדל ל${ENTITIES[state.entity].label} (מאזור רואה החשבון). הערכה בלבד, לא ייעוץ מס.`}>
      <div class="relative" dir="ltr"><span class="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted">%</span><input type="number" class=${cx(inputCls, 'pl-8 text-left font-display font-extrabold')} value=${taxPct} onInput=${(e) => setTax(Number(e.target.value))} /></div>
    <//>
  <//>`;
}

// The three stages: what each one shows, and how the business moves on. The user can
// change the stage here; usually the shark suggests it when the data shows it.
export function StagesSheet({ state, onClose, onPick }) {
  const i = STAGES.findIndex((s) => s.id === state.stage);
  return html`<${Sheet} wide title="שלושת השלבים של המרכז הפיננסי" onClose=${onClose}>
    <p class="mb-3 text-[14px] text-muted">המרכז הפיננסי מתאים את עצמו לשלב של העסק, ומראה רק את מה שחשוב בו עכשיו.</p>
    <ol class="flex flex-col gap-2.5">
      ${STAGES.map(
        (s, k) => html`<li key=${s.id} class=${cx('rounded-[16px] bg-white p-3.5 ring-1', k === i ? 'ring-2 ring-brand-600' : 'ring-line')}>
          <div class="flex items-start gap-3">
            <span class=${cx('grid h-9 w-9 shrink-0 place-items-center rounded-xl border-2 font-display text-[16px] font-extrabold', k === i ? 'border-brand-600 bg-brand-600 text-white' : k < i ? 'border-ink' : 'border-line text-muted')}>${s.n}</span>
            <div class="min-w-0 flex-1">
              <p class="flex flex-wrap items-center gap-2"><b class="font-display text-[17px]">${s.label}</b>${k === i && html`<${Tag} tone="due">השלב שלך<//>`}</p>
              <p class="text-[13px] font-bold text-muted">${s.who}</p>
              <p class="mt-1 text-[14px] leading-relaxed">${s.shows}</p>
              ${s.next && html`<p class="mt-1 text-[13px] text-sky-text">${s.next}</p>`}
            </div>
          </div>
          ${k !== i && html`<div class="mt-2 flex justify-end"><${Button} variant="text" class="!h-9" onClick=${() => onPick(s.id)}>מעבר לשלב הזה<//></div>`}
        </li>`,
      )}
    </ol>
  <//>`;
}

// Moving to stage 3: the real bank balance and a safety cushion, then the full cash flow.
export function MoveToActiveSheet({ state, onClose, onSave }) {
  const calc = balanceOn(state, TODAY);
  const [bal, setBal] = useState(calc);
  const two = Math.round(monthlyFixed(state) * 2);
  const [cushion, setCushion] = useState(two);
  return html`<${Sheet}
    title="מעבר לניהול תזרים"
    onClose=${onClose}
    footer=${html`<${Button} variant="secondary" onClick=${onClose}>לא עכשיו<//><${Button} disabled=${bal == null} onClick=${() => onSave({ bal, cushion })}>מעבר לשלב 3<${Icon} name="arrow-left" size=${20} /><//>`}
  >
    <p class="mb-4 text-[15px] leading-relaxed">שלושה חודשים ברציפות עם הכנסה. מעכשיו נראה גם את הקופה הצפויה בחודשים הבאים, ונתריע לפני שהיא יורדת מתחת לכרית. שתי שאלות:</p>
    <${Field} label="1. כמה יש היום בחשבון העסק?" hint=${`לפי החישוב: ${fmt(calc)}. אפשר לבדוק באפליקציה של הבנק.`}><${MoneyInput} value=${bal} onInput=${setBal} big autofocus /><//>
    <${Field} label="2. כרית ביטחון" hint="מתחת לסכום הזה הכריש מתריע.">
      <${MoneyInput} value=${cushion} onInput=${setCushion} />
      <span class="mt-1.5 inline-flex"><${Tag} tone="due">הצעה: שני חודשי הוצאות, ${fmt(two)}<//></span>
    <//>
  <//>`;
}
