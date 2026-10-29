// "הקופה": the balance from the opening date to the end of the range. A precise chart,
// not a sketch: crisp lines, real amounts on the axis, and each day drawn as a step
// (the balance moves on the day money comes in or goes out, not in between).
//   solid line + fill - the real balance, up to today
//   dashed line       - the expected balance, from scheduled payments and expenses only
//   sky band          - what the open deals would add if they close (a range, never the forecast)
//   amber line        - the safety cushion
// Labels only where they matter: today, the lowest point ahead, the end of the range.
// Hover, tap or the arrow keys show any day's balance and what moved it.
import { html, useState, useRef, useEffect } from './lib.js';
import { TODAY } from './data.js';
import { dm, fmt, signed, monthName } from './finance.js';

const INK = '#2d3e66';
const MUTED = '#5f6775';
const GRID = '#ebe6dc';
const BRAND = '#0038b8';
const WARN = '#a8670f';
const FONT = 'Assistant, sans-serif';

function niceStep(range, n) {
  const raw = range / n;
  const p = 10 ** Math.floor(Math.log10(raw || 1));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw) || p * 10;
}

// The width of the box the chart sits in, so text is drawn at its real size.
function useWidth(ref, fallback) {
  const [w, setW] = useState(fallback);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return w;
}

export function CashChart({ data, cushion }) {
  const box = useRef();
  const W = useWidth(box, 760);
  const [hover, setHover] = useState(null);
  if (!data.length) return html`<div ref=${box}></div>`;
  const small = W < 520;
  const H = small ? 240 : 300;
  const PAD = { top: 30, right: small ? 12 : 16, bottom: 30, left: small ? 52 : 64 };
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;

  const lo = Math.min(0, cushion, ...data.map((d) => d.bal));
  const hiRaw = Math.max(cushion, ...data.map((d) => d.maybe));
  const step = niceStep(hiRaw - lo, small ? 4 : 6);
  const yMin = Math.floor(lo / step) * step;
  const yMax = Math.ceil((hiRaw * 1.05) / step) * step;
  // RTL page, but time runs left to right like every chart the user knows from a bank.
  const x = (i) => PAD.left + (i / (data.length - 1)) * iw;
  const y = (v) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * ih;
  const ti = Math.max(0, data.findIndex((d) => d.date === TODAY));

  // A step path: flat through the day, then up or down on the day of the change.
  const steps = (from, to, key = 'bal') => {
    let d = `M${x(from).toFixed(1)} ${y(data[from][key]).toFixed(1)}`;
    for (let i = from + 1; i <= to; i++) {
      if (data[i][key] !== data[i - 1][key]) d += ` L${x(i).toFixed(1)} ${y(data[i - 1][key]).toFixed(1)}`;
      d += ` L${x(i).toFixed(1)} ${y(data[i][key]).toFixed(1)}`;
    }
    return d;
  };
  const last = data.length - 1;
  const actual = steps(0, ti);
  const base = y(Math.max(yMin, 0)).toFixed(1);
  const actualFill = `${actual} L${x(ti).toFixed(1)} ${base} L${x(0).toFixed(1)} ${base} Z`;
  const future = steps(ti, last);
  const hasBand = data.slice(ti).some((d) => d.maybe > d.bal);
  const band = hasBand
    ? `${steps(ti, last, 'maybe')} ${data
        .slice(ti)
        .map((_, k) => last - k)
        .map((i) => `L${x(i).toFixed(1)} ${y(data[i].bal).toFixed(1)}`)
        .join(' ')} Z`
    : null;

  const ticks = [];
  for (let v = yMin; v <= yMax + 1; v += step) ticks.push(v);
  // Months: a tick where each month starts, the name in the middle of its span.
  const starts = data.map((d, i) => [d, i]).filter(([d, i]) => i === 0 || d.date.endsWith('-01'));
  const months = starts.map(([d, i], k) => ({ date: d.date, from: i, to: k < starts.length - 1 ? starts[k + 1][1] : last }));

  // The lowest point from today on (when it is lower than today).
  let li = ti;
  for (let i = ti; i <= last; i++) if (data[i].bal < data[li].bal) li = i;
  const today = data[ti];
  const end = data[last];
  const tick = (v) => (small && Math.abs(v) >= 1000 ? `${v / 1000}K ₪` : fmt(v));

  const pick = (clientX) => {
    const r = box.current.getBoundingClientRect();
    const i = Math.round(((clientX - r.left - PAD.left) / iw) * last);
    setHover(Math.max(0, Math.min(last, i)));
  };
  const hd = hover != null ? data[hover] : null;
  const tipLeft = hd ? Math.min(Math.max(x(hover) - 110, 4), W - 224) : 0;

  // A value label with a white halo, so it stays readable over the lines. Labels with
  // Hebrew words are laid out right to left (the svg itself runs left to right), so
  // 'start' and 'end' keep meaning "text begins at x" and "text ends at x".
  const label = (lx, ly, text, anchor = 'middle', weight = 800, color = INK, rtl = false) =>
    html`<text x=${lx} y=${ly} direction=${rtl ? 'rtl' : 'ltr'} text-anchor=${rtl ? { start: 'end', end: 'start' }[anchor] || anchor : anchor} font-size="13" font-weight=${weight} fill=${color} font-family=${FONT} paint-order="stroke" stroke="#fff" stroke-width="4" stroke-linejoin="round">${text}</text>`;
  const side = (px, room) => (px > W - room ? 'end' : px < PAD.left + room ? 'start' : 'middle');

  return html`<div ref=${box} class="relative" dir="ltr">
    <svg
      width=${W}
      height=${H}
      viewBox=${`0 0 ${W} ${H}`}
      class="block touch-pan-y select-none rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
      role="img"
      tabindex="0"
      aria-label=${`הקופה מ-${dm(data[0].date)} עד ${dm(end.date)}: היום ${fmt(today.bal)}, ב-${dm(end.date)} צפוי ${fmt(end.bal)}. החיצים מראים כל יום.`}
      onPointerMove=${(e) => pick(e.clientX)}
      onPointerDown=${(e) => pick(e.clientX)}
      onPointerLeave=${() => setHover(null)}
      onBlur=${() => setHover(null)}
      onKeyDown=${(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          setHover((h) => Math.max(0, Math.min(last, (h ?? ti) + (e.key === 'ArrowRight' ? 1 : -1))));
        }
      }}
    >
      <defs>
        <linearGradient id="cash-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color=${BRAND} stop-opacity="0.16" />
          <stop offset="1" stop-color=${BRAND} stop-opacity="0.02" />
        </linearGradient>
      </defs>
      ${ticks.map(
        (v) => html`<g key=${v}>
          <line x1=${PAD.left} x2=${W - PAD.right} y1=${y(v)} y2=${y(v)} stroke=${v === 0 ? '#9aa1ab' : GRID} stroke-width="1" />
          <text x=${PAD.left - 8} y=${y(v) + 4} text-anchor="end" font-size="12" font-weight="600" fill=${MUTED} font-family=${FONT} style="font-variant-numeric: tabular-nums">${tick(v)}</text>
        </g>`,
      )}
      <line x1=${PAD.left} x2=${W - PAD.right} y1=${H - PAD.bottom} y2=${H - PAD.bottom} stroke="#cfc8bb" stroke-width="1" />
      ${months.map(
        (m) => html`<g key=${m.date}>
          ${m.from > 0 && html`<line x1=${x(m.from)} x2=${x(m.from)} y1=${H - PAD.bottom} y2=${H - PAD.bottom + 6} stroke="#cfc8bb" />`}
          ${x(m.to) - x(m.from) > 34 && html`<text x=${(x(m.from) + x(m.to)) / 2} y=${H - 9} text-anchor="middle" font-size="12" font-weight="700" fill=${MUTED} font-family=${FONT}>${monthName(m.date)}</text>`}
        </g>`,
      )}

      <line x1=${PAD.left} x2=${W - PAD.right} y1=${y(cushion)} y2=${y(cushion)} stroke=${WARN} stroke-width="1.5" stroke-dasharray="6 4" />
      ${label(PAD.left + 6, y(cushion) + 17 > H - PAD.bottom - 4 ? y(cushion) - 7 : y(cushion) + 17, `כרית ביטחון ${fmt(cushion)}`, 'start', 700, MUTED, true)}

      ${band && html`<path d=${band} fill="#8fb3ef" opacity="0.3" />`}
      <path d=${actualFill} fill="url(#cash-fill)" />
      <path d=${future} fill="none" stroke=${BRAND} stroke-width="2" stroke-dasharray="6 5" stroke-linejoin="round" />
      <path d=${actual} fill="none" stroke=${BRAND} stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />

      <line x1=${x(ti)} x2=${x(ti)} y1=${PAD.top - 6} y2=${H - PAD.bottom} stroke=${INK} stroke-width="1" />
      <rect x=${x(ti) - 20} y=${PAD.top - 27} width="40" height="20" rx="10" fill=${INK} />
      <text x=${x(ti)} y=${PAD.top - 13} text-anchor="middle" font-size="12" font-weight="800" fill="#fff" font-family=${FONT}>היום</text>

      ${li !== ti &&
      li !== last &&
      html`<g>
        <circle cx=${x(li)} cy=${y(data[li].bal)} r="4.5" fill="#fff" stroke=${data[li].bal < cushion ? WARN : BRAND} stroke-width="2.5" />
        ${label(x(li), y(data[li].bal) + 21, `הכי נמוך ${fmt(data[li].bal)} · ${dm(data[li].date)}`, side(x(li), 110), 700, INK, true)}
      </g>`}
      <circle cx=${x(ti)} cy=${y(today.bal)} r="5.5" fill="#fff" stroke=${BRAND} stroke-width="3" />
      ${label(x(ti) + (x(ti) > W - 120 ? -10 : 10), y(today.bal) - 11, fmt(today.bal), x(ti) > W - 120 ? 'end' : 'start')}
      <circle cx=${x(last)} cy=${y(end.bal)} r="4.5" fill=${BRAND} stroke="#fff" stroke-width="2" />
      ${label(x(last), y(end.bal) - 12, fmt(end.bal), 'end')}

      ${hd &&
      html`<g pointer-events="none">
        <line x1=${x(hover)} x2=${x(hover)} y1=${PAD.top} y2=${H - PAD.bottom} stroke=${INK} stroke-width="1" />
        <circle cx=${x(hover)} cy=${y(hd.bal)} r="5" fill=${BRAND} stroke="#fff" stroke-width="2" />
      </g>`}
    </svg>
    ${hd &&
    html`<div dir="rtl" class="pointer-events-none absolute top-0 z-10 w-[220px] rounded-xl bg-ink px-3 py-2 text-white shadow-xl" style=${{ left: `${tipLeft}px` }}>
      <p class="text-[12px] font-bold text-brand-300">${dm(hd.date)} · ${hd.date <= TODAY ? 'בפועל' : 'צפוי'}</p>
      <p class="font-display text-[18px] font-extrabold">${fmt(hd.bal)}</p>
      ${hd.ev.map((e) => html`<p class="flex justify-between gap-2 text-[12px]"><span class="truncate">${e.label}</span><span class="tabular-nums">${signed(e.amount)}</span></p>`)}
      ${hd.maybe > hd.bal && html`<p class="mt-0.5 text-[12px] text-brand-300">עם העסקאות הפתוחות: עד ${fmt(hd.maybe)}</p>`}
    </div>`}
  </div>`;
}

export function ChartLegend({ hasBand }) {
  const item = (mark, label) => html`<li class="flex items-center gap-1.5">${mark}${label}</li>`;
  return html`<ul class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] font-semibold text-muted" aria-label="מקרא">
    ${item(html`<span class="h-[3px] w-5 rounded bg-brand-600"></span>`, 'בפועל')}
    ${item(html`<span class="w-5 border-t-2 border-dashed border-brand-600"></span>`, 'צפוי, מתשלומים שנקבעו')}
    ${hasBand && item(html`<span class="h-3 w-5 rounded-sm bg-[#8fb3ef]/50"></span>`, 'אם העסקאות הפתוחות ייסגרו')}
    ${item(html`<span class="w-5 border-t-2 border-dashed border-warn"></span>`, 'כרית ביטחון')}
  </ul>`;
}

// The same numbers as a table: today, and the balance at the end of each month.
export function ChartTable({ data }) {
  const rows = data.filter((d, i) => d.date === TODAY || (d.date > TODAY && (i === data.length - 1 || data[i + 1].date.endsWith('-01'))));
  return html`<table class="w-full text-[14px]">
    <thead><tr class="text-[12px] font-bold text-muted"><th class="pb-1.5 text-start">מתי</th><th class="pb-1.5 text-start">בקופה</th><th class="pb-1.5 text-start">אם העסקאות הפתוחות ייסגרו</th></tr></thead>
    <tbody>
      ${rows.map(
        (d) => html`<tr key=${d.date} class="border-t border-line">
          <td class="py-2 font-bold">${d.date === TODAY ? `היום, ${dm(d.date)}` : `סוף ${monthName(d.date)}`}</td>
          <td class="py-2 font-display font-extrabold tabular-nums">${fmt(d.bal)}${d.date > TODAY && html`<span class="ms-1.5 text-[12px] font-semibold text-muted">צפוי</span>`}</td>
          <td class="py-2 tabular-nums text-muted">${d.maybe > d.bal ? fmt(d.maybe) : '—'}</td>
        </tr>`,
      )}
    </tbody>
  </table>`;
}
