// "הקופה": the balance from the opening date to the end of the range.
//   solid line   - the real balance, up to today
//   dashed line  - the expected balance, from scheduled payments and expenses only
//   sky band     - what the open deals would add if they close (a range, never the forecast)
//   warn line    - the safety cushion
// Hover (or tap) a day to see its balance and what moved it.
import { html, useState, useRef } from './lib.js';
import { TODAY } from './data.js';
import { dm, fmt, signed, monthName } from './finance.js';

const W = 760;
const H = 300;
const PAD = { top: 18, right: 14, bottom: 30, left: 54 };

function niceStep(range) {
  const raw = range / 4;
  const p = 10 ** Math.floor(Math.log10(raw || 1));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw) || p * 10;
}

export function CashChart({ data, cushion, compact = false }) {
  const [hover, setHover] = useState(null);
  const svg = useRef();
  if (!data.length) return null;
  const h = compact ? 230 : H;
  const lo = Math.min(0, cushion, ...data.map((d) => d.bal));
  const hiRaw = Math.max(cushion, ...data.map((d) => d.maybe));
  const step = niceStep(hiRaw - lo);
  const yMin = Math.floor(lo / step) * step;
  const yMax = Math.ceil((hiRaw * 1.04) / step) * step;
  const iw = W - PAD.left - PAD.right;
  const ih = h - PAD.top - PAD.bottom;
  // RTL page, but time runs left to right like every chart the user knows from a bank.
  const x = (i) => PAD.left + (i / (data.length - 1)) * iw;
  const y = (v) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * ih;
  const ti = Math.max(0, data.findIndex((d) => d.date === TODAY));
  const path = (pts) => pts.map((p, k) => `${k ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const actual = data.slice(0, ti + 1).map((d, i) => [x(i), y(d.bal)]);
  const future = data.slice(ti).map((d, i) => [x(ti + i), y(d.bal)]);
  const band = data.slice(ti);
  const bandPath =
    path(band.map((d, i) => [x(ti + i), y(d.maybe)])) +
    ' ' +
    band
      .slice()
      .reverse()
      .map((d, i) => `L${x(ti + band.length - 1 - i).toFixed(1)} ${y(d.bal).toFixed(1)}`)
      .join(' ') +
    ' Z';
  const hasBand = band.some((d) => d.maybe > d.bal);
  const ticks = [];
  for (let v = yMin; v <= yMax + 1; v += step) ticks.push(v);
  const months = data.map((d, i) => [d, i]).filter(([d]) => d.date.endsWith('-01'));

  const pick = (e) => {
    const r = svg.current.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - PAD.left) / iw) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };
  const hd = hover != null ? data[hover] : null;
  const end = data[data.length - 1];

  return html`<div class="relative" dir="ltr">
    <svg
      ref=${svg}
      viewBox=${`0 0 ${W} ${h}`}
      class="block w-full touch-pan-y select-none"
      role="img"
      aria-label=${`הקופה מ-${dm(data[0].date)} עד ${dm(end.date)}: היום ${fmt(data[ti].bal)}, בסוף התקופה צפוי ${fmt(end.bal)}`}
      onPointerMove=${pick}
      onPointerDown=${pick}
      onPointerLeave=${() => setHover(null)}
    >
      ${ticks.map(
        (v) => html`<g key=${v}>
          <line x1=${PAD.left} x2=${W - PAD.right} y1=${y(v)} y2=${y(v)} stroke=${v === 0 ? '#a0a6af' : '#e7e1d5'} stroke-width=${v === 0 ? 1.2 : 1} />
          <text x=${PAD.left - 8} y=${y(v) + 4} text-anchor="end" font-size="12" font-weight="600" fill="#5f6775" font-family="Assistant">${v >= 1000 || v <= -1000 ? `${v / 1000}K` : v}</text>
        </g>`,
      )}
      ${months.map(
        ([d, i]) => html`<g key=${d.date}>
          <line x1=${x(i)} x2=${x(i)} y1=${PAD.top} y2=${h - PAD.bottom} stroke="#e7e1d5" stroke-dasharray="2 4" />
          <text x=${x(i) + 4} y=${h - 10} font-size="12" font-weight="700" fill="#5f6775" font-family="Assistant">${monthName(d.date)}</text>
        </g>`,
      )}
      <line x1=${PAD.left} x2=${W - PAD.right} y1=${y(cushion)} y2=${y(cushion)} stroke="#a8670f" stroke-width="1.6" stroke-dasharray="6 5" />
      <text x=${W - PAD.right - 2} y=${y(cushion) - 6} text-anchor="end" font-size="12" font-weight="700" fill="#a8670f" font-family="Assistant">כרית ביטחון ${fmt(cushion)}</text>
      ${hasBand && html`<path d=${bandPath} fill="#8fb3ef" opacity="0.28" />`}
      <path d=${path(future)} fill="none" stroke="#0038b8" stroke-width="2.6" stroke-dasharray="7 6" stroke-linecap="round" />
      <path d=${path(actual)} fill="none" stroke="#0038b8" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round" style="filter:url(#pencil-rough)" />
      <line x1=${x(ti)} x2=${x(ti)} y1=${PAD.top - 4} y2=${h - PAD.bottom} stroke="#2d3e66" stroke-width="1.4" />
      <circle cx=${x(ti)} cy=${y(data[ti].bal)} r="5.5" fill="#fff" stroke="#0038b8" stroke-width="3" />
      <text x=${x(ti) + 7} y=${PAD.top + 8} font-size="22" font-weight="700" fill="#2f5fc4" font-family="Amatic SC">היום</text>
      ${hd &&
      html`<g pointer-events="none">
        <line x1=${x(hover)} x2=${x(hover)} y1=${PAD.top} y2=${h - PAD.bottom} stroke="#2d3e66" stroke-width="1" stroke-dasharray="3 3" />
        <circle cx=${x(hover)} cy=${y(hd.bal)} r="4.5" fill="#0038b8" />
      </g>`}
    </svg>
    ${hd &&
    html`<div
      dir="rtl"
      class="pointer-events-none absolute top-1 z-10 w-[210px] rounded-xl bg-ink px-3 py-2 text-white shadow-xl"
      style=${{ left: `${Math.min(Math.max((x(hover) / W) * 100, 2), 70)}%` }}
    >
      <p class="text-[12px] font-bold text-brand-300">${dm(hd.date)} · ${hd.date <= TODAY ? 'בפועל' : 'צפוי'}</p>
      <p class="font-display text-[18px] font-extrabold tabular-nums">${fmt(hd.bal)}</p>
      ${hd.ev.map((e) => html`<p class="flex justify-between gap-2 text-[12px]"><span class="truncate">${e.label}</span><span class="tabular-nums">${signed(e.amount)}</span></p>`)}
      ${hd.maybe > hd.bal && html`<p class="mt-0.5 text-[12px] text-brand-300">עם העסקאות הפתוחות: עד ${fmt(hd.maybe)}</p>`}
    </div>`}
  </div>`;
}

export function ChartLegend({ hasBand }) {
  const item = (mark, label) => html`<li class="flex items-center gap-1.5">${mark}${label}</li>`;
  return html`<ul class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] font-semibold text-muted" aria-label="מקרא">
    ${item(html`<span class="h-[3px] w-5 rounded bg-brand-600"></span>`, 'בפועל')}
    ${item(html`<span class="w-5 border-t-[2.5px] border-dashed border-brand-600"></span>`, 'צפוי מתשלומים שנקבעו')}
    ${hasBand && item(html`<span class="h-3 w-5 rounded-sm bg-brand-300/50"></span>`, 'אם העסקאות הפתוחות ייסגרו')}
    ${item(html`<span class="w-5 border-t-2 border-dashed border-warn"></span>`, 'כרית ביטחון')}
  </ul>`;
}
