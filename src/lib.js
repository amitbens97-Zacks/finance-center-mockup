// Preact + htm from CDN: React-like components with no build step.
import {
  h,
  html,
  render,
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from 'https://cdn.jsdelivr.net/npm/htm@3.1.1/preact/standalone.module.js';

export { h, html, render, useState, useEffect, useRef, useMemo, useCallback };

const toPascal = (name) =>
  name
    .split('-')
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join('');

// Closed parts of an icon (boxes, circles, closed outlines) get coloured in.
const isClosed = ([tag, a]) =>
  tag === 'rect' || tag === 'circle' || tag === 'ellipse' || tag === 'polygon' || (tag === 'path' && /z/i.test(a.d || ''));

// Renders a lucide icon from the UMD bundle loaded in index.html as a small
// colored-pencil illustration (the design system's V3 icon style):
//   1. the closed shapes are coloured in (a soft tint of the icon colour plus
//      sky-blue pencil hatching), slightly off the lines like real colouring;
//   2. a faint second pass of the outline, offset and turned a touch;
//   3. the main outline, with a light grain on its edge.
export function Icon({ name, size = 18, class: cls = '', strokeWidth = 2 }) {
  const lib = window.lucide || {};
  let node = (lib.icons && lib.icons[toPascal(name)]) || lib[toPascal(name)];
  if (!node) {
    return html`<span class=${cls} style=${{ width: size, height: size, display: 'inline-block' }}></span>`;
  }
  if (node[0] === 'svg') node = node[2];
  const shapes = (list = node) => list.map(([tag, attrs]) => h(tag, attrs));
  const closed = node.filter(isClosed);
  return html`<svg
    xmlns="http://www.w3.org/2000/svg"
    width=${size}
    height=${size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width=${strokeWidth * 1.08}
    stroke-linecap="round"
    stroke-linejoin="round"
    class=${'shrink-0 overflow-visible ' + cls}
    aria-hidden="true"
  >
    ${closed.length > 0 &&
    html`<g stroke="none" transform="translate(1.1 1.2)">
      <g fill="currentColor" fill-opacity="0.16">${shapes(closed)}</g>
      <g fill="url(#pencil-hatch)" opacity="0.8">${shapes(closed)}</g>
    </g>`}
    ${closed.length === 0 &&
    size >= 18 &&
    html`<g stroke="none">
      <ellipse cx="13.2" cy="13.4" rx="8.2" ry="7.4" transform="rotate(-12 13.2 13.4)" fill="currentColor" fill-opacity="0.12" />
      <ellipse cx="13.2" cy="13.4" rx="8.2" ry="7.4" transform="rotate(-12 13.2 13.4)" fill="url(#pencil-hatch)" opacity="0.6" />
    </g>`}
    <g opacity="0.3" stroke-width=${strokeWidth * 0.6} transform="translate(0.9 0.7) rotate(-2.5 12 12)">${shapes()}</g>
    <g filter="url(#pencil-rough)">${shapes()}</g>
  </svg>`;
}

// A check mark written in pencil: draws itself on mount, with a lighter
// second stroke and a slight grain on the edge.
export function PencilCheck({ size = 18, color = 'currentColor', weight = 3, delay = 0 }) {
  const d1 = 'M4.2 12.9 C6.1 14.1 7.7 15.9 9.4 18.3 C12.3 12.9 15.6 8.9 19.9 5.3';
  const d2 = 'M5 13.8 C6.8 14.9 8.2 16.5 9.7 18.8 C12.7 13.5 15.9 9.5 20.3 6.3';
  return html`<svg width=${size} height=${size} viewBox="0 0 24 24" fill="none" class="shrink-0 overflow-visible" aria-hidden="true" style=${{ filter: 'url(#pencil-rough)' }}>
    <path class="pencil-draw" pathLength="1" d=${d2} stroke=${color} stroke-width=${weight * 0.45} stroke-linecap="round" stroke-linejoin="round" opacity="0.45" style=${{ animationDelay: `${delay + 85}ms` }} />
    <path class="pencil-draw" pathLength="1" d=${d1} stroke=${color} stroke-width=${weight} stroke-linecap="round" stroke-linejoin="round" style=${{ animationDelay: `${delay}ms` }} />
  </svg>`;
}

// A hand-drawn pencil line under a word or an amount (stretches to its box).
export function PencilLine({ color = '#2f5fc4', class: cls = '' }) {
  return html`<svg viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden="true" class=${cls} style=${{ filter: 'url(#pencil-rough)', overflow: 'visible' }}>
    <path d="M2 7 C 20 3, 35 10, 52 6 S 84 3, 98 8" fill="none" stroke=${color} stroke-width="3.2" stroke-linecap="round" />
    <path d="M6 10 C 30 6, 60 11, 94 7" fill="none" stroke=${color} stroke-width="1.6" stroke-linecap="round" opacity=".55" />
  </svg>`;
}

// Notebook confetti in the brand colors (paper scraps, punched holes, pencil squiggles).
// Step finish: one burst and a 1s trickle (confetti-step). Chapter finish adds gold, 2s.
export function confetti(kind = 'step') {
  const fire = window.confetti;
  if (!fire || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const brand = ['#2d3e66', '#0038b8', '#8fb3ef', '#ffffff', '#dde9fc'];
  const colors = kind === 'chapter' ? [...brand, '#e8b44a', '#f2cf7a'] : brand;
  const shapes = ['square', 'circle'];
  try {
    shapes.push(fire.shapeFromPath({ path: 'M0 1.2 C3 -0.6 6 3 9 1.2 C12 -0.6 15 3 18 1.2 L18 3 C15 4.8 12 1.2 9 3 C6 4.8 3 1.2 0 3 Z' }));
  } catch {}
  fire({ particleCount: kind === 'chapter' ? 200 : 100, spread: 70, origin: { y: 0.55 }, colors, shapes, scalar: 1.15 });
  const end = Date.now() + (kind === 'chapter' ? 2000 : 1000);
  (function frame() {
    fire({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors, shapes, scalar: 1.1 });
    fire({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors, shapes, scalar: 1.1 });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

const nf = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 });
export const money = (n) => (n == null || Number.isNaN(n) ? '—' : `${nf.format(n)} ₪`);
export const pct = (n) => `${Math.round(n)}%`;

export const cx = (...parts) => parts.filter(Boolean).join(' ');

export const parseNum = (v) => (v === '' || v == null ? null : Math.max(0, Number(v)));

// Effective cost of a product: fixed amount or hours x hourly rate.
export function productCost(p) {
  if (p.costMode === 'hours') {
    if (p.hours == null) return null;
    return p.hours * (p.hourlyRate ?? 0);
  }
  return p.cost;
}

// Gross profit and margin for a product; null when not enough data.
export function profitOf(p) {
  const cost = productCost(p);
  if (p.price == null || cost == null) return null;
  const profit = p.price - cost;
  const margin = p.price > 0 ? (profit / p.price) * 100 : null;
  return { cost, profit, margin, free: p.price === 0 };
}

// Messages already "typed" once are shown instantly on revisit.
export const seenMessages = new Set();
