/* System Design Lab: the shared animation player.
   Classic script (no modules) so pages work when opened straight from disk (file://).

   A page describes a scene as an ordered list of steps:
     Kit.lab({
       stage: '#stage',                 // an <svg> with a viewBox
       intro: { title, say },           // shown before step 1
       setup(ctx) { ... },              // draws the starting picture; runs on every reset
       steps: [{ title, say, async run(ctx) { ... } }, ...],
     });
   Prev works by resetting and replaying the earlier steps instantly, so run() must only
   use ctx helpers (and ctx.state) and never depend on wall-clock time. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function store(key, value) {
    try {
      if (value === undefined) return window.localStorage.getItem(key);
      if (value === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, value);
    } catch (e) { /* storage unavailable: fine */ }
    return null;
  }

  function el(tag, attrs, parent) {
    var node = document.createElementNS(NS, tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      if (k === 'text') node.textContent = attrs[k];
      else if (attrs[k] !== undefined && attrs[k] !== null) node.setAttribute(k, attrs[k]);
    });
    if (parent) parent.appendChild(node);
    return node;
  }

  function html(tag, attrs, parent) {
    var node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      if (k === 'text') node.textContent = attrs[k];
      else if (k === 'html') node.innerHTML = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    if (parent) parent.appendChild(node);
    return node;
  }

  var ease = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };

  function lerp(a, b, t) { return a + (b - a) * t; }

  function pointAlong(points, t) {
    var lens = [], total = 0;
    for (var i = 1; i < points.length; i++) {
      var d = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
      lens.push(d); total += d;
    }
    if (total === 0) return points[0];
    var target = t * total;
    for (var j = 0; j < lens.length; j++) {
      if (target <= lens[j] || j === lens.length - 1) {
        var local = lens[j] === 0 ? 1 : Math.min(1, target / lens[j]);
        return [lerp(points[j][0], points[j + 1][0], local), lerp(points[j][1], points[j + 1][1], local)];
      }
      target -= lens[j];
    }
    return points[points.length - 1];
  }

  function themeButton(btn) {
    var order = ['system', 'light', 'dark'];
    var current = store('sdlab-theme') || 'system';
    function apply() {
      if (current === 'system') document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', current);
      btn.textContent = 'Theme: ' + current;
    }
    btn.addEventListener('click', function () {
      current = order[(order.indexOf(current) + 1) % order.length];
      store('sdlab-theme', current === 'system' ? null : current);
      apply();
    });
    apply();
  }

  function lab(opts) {
    var svg = typeof opts.stage === 'string' ? document.querySelector(opts.stage) : opts.stage;
    var steps = opts.steps || [];
    var controls = document.querySelector(opts.controls || '#controls');
    var narration = document.querySelector(opts.narration || '#narration');

    // ---- build controls ----
    var bPrev = html('button', { class: 'btn', type: 'button', id: 'kit-prev', title: 'Previous step (←)', text: '◀ Prev' }, controls);
    var bPlay = html('button', { class: 'btn primary', type: 'button', id: 'kit-play', title: 'Play / pause (space)', text: '▶ Play' }, controls);
    var bNext = html('button', { class: 'btn', type: 'button', id: 'kit-next', title: 'Next step (→)', text: 'Next ▶' }, controls);
    var bReset = html('button', { class: 'btn', type: 'button', id: 'kit-reset', title: 'Reset (r)', text: '↺ Reset' }, controls);
    var speedLabel = html('label', { for: 'kit-speed', text: 'Speed' }, controls);
    var speedSel = html('select', { id: 'kit-speed' }, speedLabel);
    [['0.5', '0.5×'], ['1', '1×'], ['2', '2×'], ['4', '4×']].forEach(function (o) {
      var opt = html('option', { value: o[0], text: o[1] }, speedSel);
      if (o[0] === '1') opt.selected = true;
    });
    html('span', { class: 'grow' }, controls);
    var progress = html('span', { class: 'progress', id: 'kit-progress' }, controls);

    // ---- build narration ----
    var now = html('section', { class: 'now', 'aria-live': 'polite' }, narration);
    var stepNo = html('div', { class: 'step-no' }, now);
    var stepTitle = html('h2', {}, now);
    var stepSay = html('p', {}, now);
    var logBox = html('section', { class: 'log' }, narration);
    html('h3', { text: 'Event log' }, logBox);
    var logList = html('ol', {}, logBox);

    var speed = 1;
    var current = 0;      // number of steps completed
    var busy = false;
    var playing = false;
    var instant = false;
    var generation = 0;   // bumps on reset to cancel in-flight tweens

    var ctx = {
      svg: svg,
      state: {},
      get instant() { return instant || reducedMotion; },
      el: function (tag, attrs, parent) { return el(tag, attrs, parent || svg); },
      group: function (attrs, parent) { return el('g', attrs, parent || svg); },
      // After a reset, tweens and waits from the old run never resolve, so the rest of
      // that run() simply stops instead of drawing into the new scene.
      tween: function (ms, fn) {
        var gen = generation;
        if (ctx.instant || ms <= 0) { fn(1); return Promise.resolve(); }
        var dur = ms / speed;
        return new Promise(function (resolve) {
          var start = performance.now();
          function frame(t) {
            if (gen !== generation) return;
            var p = Math.min(1, (t - start) / dur);
            fn(ease(p));
            if (p < 1) requestAnimationFrame(frame); else resolve();
          }
          requestAnimationFrame(frame);
        });
      },
      wait: function (ms) {
        var gen = generation;
        if (ctx.instant) return Promise.resolve();
        return new Promise(function (resolve) {
          setTimeout(function () { if (gen === generation) resolve(); }, ms / speed);
        });
      },
      // Move a <g> (or any element) to x,y using transform. Remembers its position.
      place: function (node, x, y) {
        node._x = x; node._y = y;
        node.setAttribute('transform', 'translate(' + x + ',' + y + ')');
        return node;
      },
      move: function (node, x, y, ms) {
        var fx = node._x || 0, fy = node._y || 0;
        return ctx.tween(ms === undefined ? 600 : ms, function (t) { ctx.place(node, lerp(fx, x, t), lerp(fy, y, t)); });
      },
      // Interpolate numeric attributes, e.g. ctx.animate(rect, { width: 120 }, 400)
      animate: function (node, attrs, ms) {
        var from = {};
        Object.keys(attrs).forEach(function (k) { from[k] = parseFloat(node.getAttribute(k)) || 0; });
        return ctx.tween(ms === undefined ? 500 : ms, function (t) {
          Object.keys(attrs).forEach(function (k) { node.setAttribute(k, lerp(from[k], attrs[k], t)); });
        });
      },
      fade: function (node, to, ms) {
        var from = parseFloat(node.getAttribute('opacity'));
        if (isNaN(from)) from = 1;
        return ctx.tween(ms === undefined ? 400 : ms, function (t) { node.setAttribute('opacity', lerp(from, to, t)); });
      },
      // A dot that travels along a polyline [[x,y],...] and is removed at the end (unless keep).
      packet: function (points, o) {
        o = o || {};
        var g = el('g', {}, svg);
        el('circle', { r: o.r || 7, class: 'packet ' + (o.cls || '') }, g);
        if (o.label) el('text', { x: 10, y: 4, class: 'mono small', text: o.label }, g);
        ctx.place(g, points[0][0], points[0][1]);
        return ctx.tween(o.ms || 900, function (t) {
          var p = pointAlong(points, t);
          ctx.place(g, p[0], p[1]);
        }).then(function () { if (!o.keep) g.remove(); return g; });
      },
      flash: function (node) {
        if (ctx.instant) return;
        node.classList.remove('flash');
        void node.getBoundingClientRect();
        node.classList.add('flash');
      },
      log: function (msg, kind) {
        html('li', { class: kind || '', text: msg }, logList);
        logBox.scrollTop = logBox.scrollHeight;
      },
      say: function (text) { stepSay.innerHTML = text; },
      clear: function () { while (svg.firstChild) svg.removeChild(svg.firstChild); },
    };

    function showNarration() {
      var s = current === 0 ? opts.intro || { title: 'Ready', say: 'Press Play, or step through with Next.' } : steps[current - 1];
      stepNo.textContent = current === 0 ? 'Start · ' + steps.length + ' steps' : 'Step ' + current + ' of ' + steps.length;
      stepTitle.textContent = s.title || '';
      stepSay.innerHTML = s.say || '';
    }

    function refresh() {
      progress.textContent = current + ' / ' + steps.length;
      bPrev.disabled = busy || current === 0;
      bNext.disabled = busy || current >= steps.length;
      bReset.disabled = false;
      bPlay.textContent = playing ? '❚❚ Pause' : current >= steps.length ? '↺ Replay' : '▶ Play';
    }

    function reset() {
      generation++;
      playing = false;
      busy = false;
      current = 0;
      ctx.state = {};
      ctx.clear();
      logList.innerHTML = '';
      if (opts.setup) opts.setup(ctx);
      showNarration();
      refresh();
    }

    function runStep() {
      if (current >= steps.length) return Promise.resolve(false);
      var gen = generation;
      busy = true;
      var s = steps[current];
      stepNo.textContent = 'Step ' + (current + 1) + ' of ' + steps.length;
      stepTitle.textContent = s.title || '';
      stepSay.innerHTML = s.say || '';
      refresh();
      return Promise.resolve(s.run ? s.run(ctx) : null).then(function () {
        if (gen !== generation) return false;
        current++;
        busy = false;
        refresh();
        return true;
      });
    }

    function play() {
      if (current >= steps.length) reset();
      playing = true;
      refresh();
      (function loop() {
        if (!playing) { refresh(); return; }
        runStep().then(function (ok) {
          if (!ok || current >= steps.length) { playing = false; refresh(); return; }
          ctx.wait(450).then(loop);
        });
      })();
    }

    function goTo(target) {
      reset();
      instant = true;
      var chain = Promise.resolve();
      for (var i = 0; i < target; i++) chain = chain.then(runStep);
      return chain.then(function () { instant = false; showNarration(); refresh(); });
    }

    bPlay.addEventListener('click', function () {
      if (playing) { playing = false; refresh(); } else if (!busy) play();
    });
    bNext.addEventListener('click', function () { if (!busy) { playing = false; runStep(); } });
    bPrev.addEventListener('click', function () { if (!busy && current > 0) goTo(current - 1); });
    bReset.addEventListener('click', reset);
    speedSel.addEventListener('change', function () { speed = parseFloat(speedSel.value) || 1; });

    document.addEventListener('keydown', function (e) {
      var t = e.target && e.target.tagName;
      if (t === 'INPUT' || t === 'SELECT' || t === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return;
      // Space on a focused page button (e.g. a "Try it" panel) should press that button.
      if (e.key === ' ' && t === 'BUTTON' && !/^kit-/.test(e.target.id)) return;
      if (e.key === ' ') { e.preventDefault(); bPlay.click(); }
      else if (e.key === 'ArrowRight') bNext.click();
      else if (e.key === 'ArrowLeft') bPrev.click();
      else if (e.key === 'r' || e.key === 'R') bReset.click();
    });

    reset();
    // Open a page with #end to see the finished picture, or #step-3 to land after step 3.
    var hash = window.location.hash;
    var m = /^#step-(\d+)$/.exec(hash);
    if (hash === '#end') goTo(steps.length);
    else if (m) goTo(Math.min(steps.length, parseInt(m[1], 10)));
    return { ctx: ctx, reset: reset, play: play, goTo: goTo, get current() { return current; } };
  }

  // Wire up the theme button on every page that has one.
  document.addEventListener('DOMContentLoaded', function () {
    var b = document.getElementById('theme-btn');
    if (b) themeButton(b);
    // Links to repo files (README.md, demo.ts, …) only work when opened from disk.
    // Anywhere else, show them as plain paths so nothing leads to a 404.
    if (window.location.protocol !== 'file:') {
      Array.prototype.forEach.call(document.querySelectorAll('a[href$=".md"], a[href$=".ts"]'), function (a) {
        var code = document.createElement('code');
        code.textContent = a.getAttribute('href').replace(/^(\.\.\/)+/, '');
        code.title = a.textContent;
        a.replaceWith(code);
      });
    }
  });

  window.Kit = { lab: lab, el: el, html: html, pointAlong: pointAlong, lerp: lerp, store: store };
})();
