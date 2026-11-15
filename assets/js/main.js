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

  /* ---------- theme (light default; choice is remembered) ---------- */
  var root = document.documentElement;
  var metaTheme = document.querySelector('meta[name="theme-color"]');
  var themeBtn = document.getElementById('themeToggle');
  function getTheme() { return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }
  function setTheme(t, persist) {
    root.setAttribute('data-theme', t);
    if (metaTheme) metaTheme.setAttribute('content', t === 'dark' ? '#0d0d0d' : '#0a0a0a');
    if (themeBtn) {
      var next = t === 'dark' ? 'light' : 'dark';
      themeBtn.setAttribute('aria-label', 'Switch to ' + next + ' theme');
      themeBtn.title = 'Switch to ' + next + ' theme';
    }
    if (persist) { try { localStorage.setItem('theme', t); } catch (_) {} }
  }
  function toggleTheme() { setTheme(getTheme() === 'dark' ? 'light' : 'dark', true); }
  setTheme(getTheme(), false);
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  /* ---------- command palette (Ctrl/Cmd + K) ---------- */
  var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
  Array.prototype.forEach.call(document.querySelectorAll('.kbd-hint'), function (el) {
    el.textContent = isMac ? '⌘K' : 'Ctrl K';
  });
  var brand = document.querySelector('.brand');
  var base = brand ? (brand.getAttribute('href') || '').replace(/index\.html$/, '') : '';
  var RESUME = base + 'Sai%20Praneeth%20Resume.pdf';

  function goFilter(f) {
    var onProjects = /\/projects\.html$/.test(location.pathname);
    var btn = onProjects && document.querySelector('#filters button[data-filter="' + f + '"]');
    if (btn) btn.click(); else location.href = base + 'projects.html#' + f;
  }
  function openTerminal() {
    var t = document.getElementById('term');
    if (t && t.offsetParent !== null) {
      t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      var i = t.querySelector('input');
      if (i) setTimeout(function () { i.focus({ preventScroll: true }); }, reduce ? 0 : 350);
    } else {
      location.href = base + 'index.html#terminal';
    }
  }
  function copyLink() {
    var done = function () { toast('Link copied'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(location.href).then(done, function () {});
  }
  var toastEl = null, toastTimer = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.setAttribute('role', 'status');
      toastEl.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:400;background:var(--ink);color:var(--paper);font:13px/1.4 var(--font-mono);padding:8px 14px';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg; toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 1800);
  }

  var ITEMS = [
    { g: 'Pages', t: 'Home', h: 'index', k: 'start landing', href: base + 'index.html' },
    { g: 'Pages', t: 'About', h: 'education certifications', k: 'bio paper research', href: base + 'about.html' },
    { g: 'Pages', t: 'Experience', h: 'internships', k: 'work jobs', href: base + 'experience.html' },
    { g: 'Pages', t: 'Projects', h: 'all', k: 'work portfolio', href: base + 'projects.html' },
    { g: 'Pages', t: 'Skills', h: 'tech stack', k: 'tools aws docker kubernetes terraform', href: base + 'skills.html' },
    { g: 'Pages', t: 'Contact', h: 'get in touch', k: 'email hire message', href: base + 'contact.html' },
    { g: 'Projects', t: 'DevOps projects', h: 'filter', k: 'ci cd jenkins argocd pipeline', run: function () { goFilter('devops'); } },
    { g: 'Projects', t: 'Cloud projects', h: 'filter', k: 'aws terraform ansible', run: function () { goFilter('cloud'); } },
    { g: 'Projects', t: 'Web projects', h: 'filter', k: 'frontend javascript', run: function () { goFilter('web'); } },
    { g: 'Projects', t: 'Machine learning projects', h: 'filter', k: 'ml lstm python stock', run: function () { goFilter('ml'); } },
    { g: 'Links', t: 'Resume (PDF)', h: 'opens new tab', k: 'cv', href: RESUME, ext: true },
    { g: 'Links', t: 'Research paper (PDF)', h: 'ICACIT 2025', k: 'publication lstm', href: base + 'UN-C%20Paper.pdf', ext: true },
    { g: 'Links', t: 'GitHub', h: 'Bhattu-Sai-Praneeth', k: 'code repos', href: 'https://github.com/Bhattu-Sai-Praneeth', ext: true },
    { g: 'Links', t: 'LinkedIn', h: 'saipraneethbhattu', k: 'connect', href: 'https://www.linkedin.com/in/saipraneethbhattu', ext: true },
    { g: 'Links', t: 'AWS Builder Center', h: 'bhattu', k: 'aws articles posts community', href: 'https://builder.aws.com/community/@bhattu', ext: true },
    { g: 'Links', t: 'Blog', h: 'Hashnode', k: 'articles posts writing', href: 'https://saipraneethbhattu.hashnode.dev/', ext: true },
    { g: 'Actions', t: 'Toggle dark / light theme', h: '', k: 'theme mode dark light', run: toggleTheme },
    { g: 'Actions', t: 'Open the terminal', h: 'home page', k: 'shell cli console', run: openTerminal },
    { g: 'Actions', t: 'Copy link to this page', h: '', k: 'share url', run: copyLink }
  ];

  var pal = null, palInput, palList, palItems = [], palActive = 0, palReturn = null;
  function buildPalette() {
    pal = document.createElement('div');
    pal.className = 'pal'; pal.hidden = true;
    pal.innerHTML =
      '<div class="pal-box" role="dialog" aria-modal="true" aria-label="Command palette">' +
      '<input class="pal-input" type="text" role="combobox" aria-expanded="true" aria-controls="palList" aria-autocomplete="list" ' +
      'placeholder="Type a command or search…" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Search commands">' +
      '<ul class="pal-list" id="palList" role="listbox"></ul>' +
      '<div class="pal-foot"><span><kbd>↑</kbd><kbd>↓</kbd>navigate</span><span><kbd>Enter</kbd>select</span><span><kbd>Esc</kbd>close</span></div></div>';
    document.body.appendChild(pal);
    palInput = pal.querySelector('input');
    palList = pal.querySelector('ul');
    pal.addEventListener('mousedown', function (e) { if (e.target === pal) closePalette(); });
    palInput.addEventListener('input', function () { renderPalette(palInput.value); });
    palList.addEventListener('mousemove', function (e) {
      var li = e.target.closest && e.target.closest('[data-i]');
      if (li && +li.dataset.i !== palActive) setActive(+li.dataset.i, false);
    });
    palList.addEventListener('click', function (e) {
      var li = e.target.closest && e.target.closest('[data-i]');
      if (li) runItem(palItems[+li.dataset.i]);
    });
    pal.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(palActive + 1, palItems.length - 1), true); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(palActive - 1, 0), true); }
      else if (e.key === 'Home' && palItems.length) { e.preventDefault(); setActive(0, true); }
      else if (e.key === 'End' && palItems.length) { e.preventDefault(); setActive(palItems.length - 1, true); }
      else if (e.key === 'Enter') { e.preventDefault(); if (palItems[palActive]) runItem(palItems[palActive]); }
      else if (e.key === 'Tab') { e.preventDefault(); }   // keep focus inside the dialog
    });
  }
  function matches(item, q) {
    if (!q) return 1;
    var hay = (item.t + ' ' + item.g + ' ' + (item.h || '') + ' ' + (item.k || '')).toLowerCase();
    var toks = q.toLowerCase().split(/\s+/).filter(Boolean), score = 1;
    for (var i = 0; i < toks.length; i++) {
      if (hay.indexOf(toks[i]) === -1) return 0;
      if (item.t.toLowerCase().indexOf(toks[i]) === 0) score += 2;
      else if (item.t.toLowerCase().indexOf(toks[i]) > -1) score += 1;
    }
    return score;
  }
  function renderPalette(q) {
    var scored = ITEMS.map(function (it, idx) { return { it: it, s: matches(it, q), idx: idx }; })
      .filter(function (x) { return x.s > 0; });
    if (q) scored.sort(function (a, b) { return b.s - a.s || a.idx - b.idx; });
    palItems = scored.map(function (x) { return x.it; });
    palList.textContent = '';
    if (!palItems.length) {
      var empty = document.createElement('li');
      empty.className = 'pal-empty'; empty.setAttribute('role', 'presentation');
      empty.textContent = 'No matches for “' + q + '”';
      palList.appendChild(empty);
      palInput.removeAttribute('aria-activedescendant');
      return;
    }
    var lastG = null;
    palItems.forEach(function (it, i) {
      if (!q && it.g !== lastG) {
        var gh = document.createElement('li');
        gh.className = 'pal-group'; gh.setAttribute('role', 'presentation'); gh.textContent = it.g;
        palList.appendChild(gh); lastG = it.g;
      }
      var li = document.createElement('li');
      li.className = 'pal-item'; li.id = 'pal-o' + i; li.dataset.i = i; li.setAttribute('role', 'option');
      var a = document.createElement('span'); a.textContent = it.t;
      var b = document.createElement('small'); b.textContent = q ? it.g + (it.h ? ' · ' + it.h : '') : (it.h || '');
      li.appendChild(a); li.appendChild(b);
      palList.appendChild(li);
    });
    setActive(0, true);
  }
  function setActive(i, scroll) {
    palActive = i;
    Array.prototype.forEach.call(palList.querySelectorAll('.pal-item'), function (el) {
      var on = +el.dataset.i === i;
      el.setAttribute('aria-selected', String(on));
      if (on) {
        palInput.setAttribute('aria-activedescendant', el.id);
        if (scroll && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
      }
    });
  }
  function runItem(it) {
    if (!it) return;
    closePalette();
    if (it.run) { it.run(); return; }
    if (it.ext) window.open(it.href, '_blank', 'noopener');
    else location.href = it.href;
  }
  function openPalette() {
    if (!pal) buildPalette();
    if (!pal.hidden) return;
    palReturn = document.activeElement;
    setMenu(false);
    pal.hidden = false; root.classList.add('pal-open');
    palInput.value = ''; renderPalette('');
    palInput.focus();
  }
  function closePalette() {
    if (!pal || pal.hidden) return;
    pal.hidden = true; root.classList.remove('pal-open');
    if (palReturn && palReturn.focus) { try { palReturn.focus({ preventScroll: true }); } catch (_) {} }
  }
  var palBtn = document.getElementById('paletteBtn');
  if (palBtn) palBtn.addEventListener('click', openPalette);
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      if (pal && !pal.hidden) closePalette(); else openPalette();
    }
  });

  /* tiny API for page-specific scripts (home.js) */
  window.siteUI = { getTheme: getTheme, setTheme: function (t) { setTheme(t, true); }, toggleTheme: toggleTheme, openPalette: openPalette, base: base, toast: toast };

  /* ---------- footer year ---------- */
  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();
