/* Sai Praneeth Bhattu — portfolio interactions (no dependencies) */
(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- mobile navigation ---------- */
  var toggle = document.getElementById('navToggle');
  var links = document.getElementById('navLinks');
  function setMenu(open) {
    if (!toggle || !links) return;
    links.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    var label = toggle.querySelector('.t');
    if (label) label.textContent = open ? 'CLOSE' : 'MENU';
  }
  if (toggle && links) {
    toggle.addEventListener('click', function () { setMenu(!links.classList.contains('open')); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
    document.addEventListener('click', function (e) {
      if (!links.contains(e.target) && !toggle.contains(e.target)) setMenu(false);
    });
    window.addEventListener('resize', function () { if (window.innerWidth > 860) setMenu(false); });
  }

  /* ---------- page transitions between routes ---------- */
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    var url;
    try { url = new URL(a.href, location.href); } catch (_) { return; }
    if (url.origin !== location.origin) return;
    if (!/\.html?$|\/$/.test(url.pathname)) return;           // only HTML routes (not PDFs)
    if (url.pathname === location.pathname && url.hash) return; // same-page anchor
    if (url.pathname === location.pathname && !url.hash) { e.preventDefault(); return; }
    if (reduce) return;
    e.preventDefault();
    document.body.classList.add('leaving');
    setTimeout(function () { location.href = url.href; }, 190);
  });
  window.addEventListener('pageshow', function (ev) {
    if (ev.persisted) document.body.classList.remove('leaving');
  });

  /* ---------- gentle bubble parallax (home) ---------- */
  var bubbles = document.querySelectorAll('.bubble');
  var hero = document.querySelector('.hero');
  if (bubbles.length && hero && !reduce && window.matchMedia('(hover:hover)').matches) {
    var raf = null, mx = 0, my = 0;
    hero.addEventListener('mousemove', function (e) {
      var r = hero.getBoundingClientRect();
      mx = (e.clientX - r.left) / r.width - 0.5;
      my = (e.clientY - r.top) / r.height - 0.5;
      if (!raf) raf = requestAnimationFrame(apply);
    });
    hero.addEventListener('mouseleave', function () { mx = my = 0; if (!raf) raf = requestAnimationFrame(apply); });
    function apply() {
      raf = null;
      bubbles.forEach(function (b, i) {
        var depth = 10 + (i % 4) * 7;
        b.style.setProperty('--px', (-mx * depth).toFixed(1) + 'px');
        b.style.setProperty('--py', (-my * depth).toFixed(1) + 'px');
      });
    }
  }

  /* ---------- project filters ---------- */
  var filterBar = document.getElementById('filters');
  if (filterBar) {
    var cards = Array.prototype.slice.call(document.querySelectorAll('.proj'));
    var buttons = Array.prototype.slice.call(filterBar.querySelectorAll('button'));
    buttons.forEach(function (btn) {
      var f = btn.dataset.filter;
      var n = f === 'all' ? cards.length : cards.filter(function (c) { return c.dataset.cat.split(' ').indexOf(f) > -1; }).length;
      btn.insertAdjacentHTML('beforeend', '<span class="count">' + n + '</span>');
      btn.addEventListener('click', function () {
        buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
        cards.forEach(function (c) {
          c.hidden = !(f === 'all' || c.dataset.cat.split(' ').indexOf(f) > -1);
        });
        if (history.replaceState) history.replaceState(null, '', f === 'all' ? location.pathname : '#' + f);
      });
    });
    var initial = location.hash.replace('#', '');
    var start = buttons.filter(function (b) { return b.dataset.filter === initial; })[0];
    if (start) start.click();
  }

  /* ---------- footer year ---------- */
  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();
