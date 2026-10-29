/* @ds-bundle: {"format":4,"namespace":"FlowBiz","components":[]} */
/* FlowBiz helpers: V3 colored-pencil icons (from the lucide library), the pencil check,
   the pencil underline, and the draggable partner that never sits on anything clickable. */
(function () {
  var NS = 'http://www.w3.org/2000/svg';

  function ensureDefs() {
    if (document.getElementById('fb-pencil-defs')) return;
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('id', 'fb-pencil-defs');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.position = 'absolute';
    svg.innerHTML =
      '<filter id="fb-pencil-rough" x="-20%" y="-20%" width="140%" height="140%">' +
      '<feTurbulence type="fractalNoise" baseFrequency="1.5" numOctaves="2" seed="7" result="grain"></feTurbulence>' +
      '<feDisplacementMap in="SourceGraphic" in2="grain" scale="0.9" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap></filter>' +
      '<pattern id="fb-pencil-hatch" width="2.6" height="2.6" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">' +
      '<line x1="0" y1="0" x2="0" y2="2.6" stroke="#6f9be8" stroke-width="1" stroke-linecap="round"></line></pattern>';
    document.body.appendChild(svg);
  }

  function toPascal(n) { return n.split('-').map(function (s) { return s.charAt(0).toUpperCase() + s.slice(1); }).join(''); }
  function isClosed(node) { var t = node[0], a = node[1] || {}; return t === 'rect' || t === 'circle' || t === 'ellipse' || t === 'polygon' || (t === 'path' && /z/i.test(a.d || '')); }
  function shape(node) { var el = document.createElementNS(NS, node[0]); var a = node[1] || {}; Object.keys(a).forEach(function (k) { if (k !== 'key') el.setAttribute(k, a[k]); }); return el; }
  function group(attrs, nodes) { var g = document.createElementNS(NS, 'g'); Object.keys(attrs).forEach(function (k) { g.setAttribute(k, attrs[k]); }); nodes.forEach(function (n) { g.appendChild(shape(n)); }); return g; }

  /* A lucide icon drawn as a small colored-pencil illustration (V3):
     closed shapes coloured in with a tint and sky hatching, a faint offset second pass,
     and the outline with a light grain. */
  function pencilIcon(name, size) {
    ensureDefs();
    size = size || 18;
    var lib = window.lucide || {};
    var node = (lib.icons && lib.icons[toPascal(name)]) || lib[toPascal(name)];
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', size); svg.setAttribute('height', size); svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '2.16');
    svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round'); svg.setAttribute('aria-hidden', 'true');
    if (!node) return svg;
    if (node[0] === 'svg') node = node[2];
    var closed = node.filter(isClosed);
    if (closed.length) {
      var fill = document.createElementNS(NS, 'g'); fill.setAttribute('stroke', 'none'); fill.setAttribute('transform', 'translate(1.1 1.2)');
      fill.appendChild(group({ fill: 'currentColor', 'fill-opacity': '0.16' }, closed));
      fill.appendChild(group({ fill: 'url(#fb-pencil-hatch)', opacity: '0.8' }, closed));
      svg.appendChild(fill);
    } else if (size >= 18) {
      var bg = document.createElementNS(NS, 'g'); bg.setAttribute('stroke', 'none');
      [['currentColor', '0.12', null], ['url(#fb-pencil-hatch)', null, '0.6']].forEach(function (f) {
        var e = document.createElementNS(NS, 'ellipse');
        e.setAttribute('cx', '13.2'); e.setAttribute('cy', '13.4'); e.setAttribute('rx', '8.2'); e.setAttribute('ry', '7.4');
        e.setAttribute('transform', 'rotate(-12 13.2 13.4)'); e.setAttribute('fill', f[0]);
        if (f[1]) e.setAttribute('fill-opacity', f[1]);
        if (f[2]) e.setAttribute('opacity', f[2]);
        bg.appendChild(e);
      });
      svg.appendChild(bg);
    }
    svg.appendChild(group({ opacity: '0.3', 'stroke-width': '1.2', transform: 'translate(0.9 0.7) rotate(-2.5 12 12)' }, node));
    svg.appendChild(group({ filter: 'url(#fb-pencil-rough)' }, node));
    return svg;
  }

  /* A check mark written in pencil. */
  function pencilCheck(size, color) {
    ensureDefs();
    size = size || 18; color = color || '#0038b8';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', size); svg.setAttribute('height', size); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none');
    svg.setAttribute('aria-hidden', 'true'); svg.style.filter = 'url(#fb-pencil-rough)'; svg.style.overflow = 'visible';
    [['M5 13.8 C6.8 14.9 8.2 16.5 9.7 18.8 C12.7 13.5 15.9 9.5 20.3 6.3', 1.35, '0.45'], ['M4.2 12.9 C6.1 14.1 7.7 15.9 9.4 18.3 C12.3 12.9 15.6 8.9 19.9 5.3', 3, '1']].forEach(function (p) {
      var path = document.createElementNS(NS, 'path');
      path.setAttribute('d', p[0]); path.setAttribute('stroke', color); path.setAttribute('stroke-width', p[1]);
      path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round'); path.setAttribute('opacity', p[2]);
      svg.appendChild(path);
    });
    return svg;
  }

  /* A hand-drawn pencil line under a word or an amount. */
  function pencilLine(color) {
    ensureDefs();
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 12'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = '<path d="M2 7 C 20 3, 35 10, 52 6 S 84 3, 98 8" fill="none" stroke="' + (color || '#2f5fc4') + '" stroke-width="3.2" stroke-linecap="round" filter="url(#fb-pencil-rough)"></path>' +
      '<path d="M6 10 C 30 6, 60 11, 94 7" fill="none" stroke="' + (color || '#2f5fc4') + '" stroke-width="1.6" stroke-linecap="round" opacity=".55" filter="url(#fb-pencil-rough)"></path>';
    return svg;
  }

  /* Fill every placeholder in a root: <i data-fb-icon="name" data-size="22">, <span data-fb-check>, <span data-fb-line>. */
  function mount(root) {
    root = root || document;
    root.querySelectorAll('[data-fb-icon]').forEach(function (el) {
      if (el.firstChild) return;
      el.classList.add('fb-icon');
      el.appendChild(pencilIcon(el.getAttribute('data-fb-icon'), Number(el.getAttribute('data-size') || 18)));
    });
    root.querySelectorAll('[data-fb-check]').forEach(function (el) {
      if (!el.querySelector('svg')) el.appendChild(pencilCheck(Number(el.getAttribute('data-size') || 18), el.getAttribute('data-color') || undefined));
    });
    root.querySelectorAll('[data-fb-line]').forEach(function (el) {
      if (!el.querySelector('svg')) el.appendChild(pencilLine(el.getAttribute('data-color') || undefined));
    });
  }

  /* The partner bubble: drag anywhere inside its container, but never onto anything clickable.
     Dropped on a button, field, card or note, it returns to the last free spot. */
  var HIT = 'button, a, input, textarea, select, [role="button"], .fb-btn, .fb-chip, .fb-tile, .fb-field, .fb-field-big, .fb-note, .fb-home';
  function makeDraggable(el) {
    var box = el.parentElement, sx = 0, sy = 0, sl = 0, st = 0, last = null;
    function rel(node) { var r = node.getBoundingClientRect(), b = box.getBoundingClientRect(); return { l: r.left - b.left, t: r.top - b.top, w: r.width, h: r.height }; }
    function overlaps(a, b) { return a.l < b.l + b.w && a.l + a.w > b.l && a.t < b.t + b.h && a.t + a.h > b.t; }
    function blocked(l, t) {
      var me = { l: l, t: t, w: el.offsetWidth, h: el.offsetHeight };
      return Array.prototype.some.call(box.querySelectorAll(HIT), function (h) { return h !== el && !el.contains(h) && overlaps(me, rel(h)); });
    }
    el.addEventListener('pointerdown', function (e) {
      var r = rel(el); sx = e.clientX; sy = e.clientY; sl = r.l; st = r.t; last = { l: r.l, t: r.t };
      el.style.right = 'auto'; el.style.bottom = 'auto'; el.style.left = sl + 'px'; el.style.top = st + 'px';
      el.classList.add('is-dragging'); el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', function (e) {
      if (!el.hasPointerCapture(e.pointerId)) return;
      var l = Math.max(0, Math.min(box.clientWidth - el.offsetWidth, sl + e.clientX - sx));
      var t = Math.max(0, Math.min(box.clientHeight - el.offsetHeight, st + e.clientY - sy));
      el.style.left = l + 'px'; el.style.top = t + 'px';
      var bad = blocked(l, t); el.classList.toggle('is-blocked', bad);
      if (!bad) last = { l: l, t: t };
    });
    el.addEventListener('pointerup', function () {
      el.classList.remove('is-dragging');
      if (el.classList.contains('is-blocked') && last) { el.style.left = last.l + 'px'; el.style.top = last.t + 'px'; }
      el.classList.remove('is-blocked');
    });
  }

  window.FlowBiz = { pencilIcon: pencilIcon, pencilCheck: pencilCheck, pencilLine: pencilLine, mount: mount, makeDraggable: makeDraggable };
})();
