/* Sai Praneeth Bhattu — home page extras: interactive terminal, Hashnode feed, resume preview.
   No dependencies. Loaded only by index.html. */
(function () {
  'use strict';

  /* ======================================================================
     CONFIG — edit these to change what the home page shows
     ====================================================================== */
  var BLOG_HOST = 'saipraneethbhattu.hashnode.dev';   // your Hashnode publication
  var BLOG_URL = 'https://saipraneethbhattu.hashnode.dev/';
  var BUILDER_URL = 'https://builder.aws.com/community/@bhattu';
  var SOURCES = { hashnode: 'Hashnode', aws: 'AWS Builder Center' };
  function srcName(p) { return SOURCES[p.source] || SOURCES.hashnode; }
  var POST_COUNT = 6;
  var CACHE_KEY = 'sp-posts-v1';
  var CACHE_TTL = 60 * 60 * 1000;                     // 1 hour
  var STATIC_POSTS = 'assets/data/posts.json';        // fallback, refreshed by the GitHub Action
  var RESUME_PATH = 'Sai%20Praneeth%20Resume.pdf';
  var RESUME_UPDATED = 'May 2026';

  var ui = window.siteUI || {};
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ======================================================================
     BLOG FEED — Hashnode's public GraphQL API (free, no token, no premium)
     ====================================================================== */
  var QUERY = 'query Posts($host:String!,$n:Int!){publication(host:$host){posts(first:$n){edges{node{title brief url publishedAt readTimeInMinutes}}}}}';

  function readCache() {
    try {
      var c = JSON.parse(localStorage.getItem(CACHE_KEY));
      if (c && Array.isArray(c.posts)) return c;
    } catch (_) {}
    return null;
  }
  function writeCache(posts) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), posts: posts })); } catch (_) {}
  }
  function clean(list) {
    return (list || []).filter(function (p) {
      return p && typeof p.title === 'string' && typeof p.url === 'string' && /^https:\/\//.test(p.url);
    }).slice(0, POST_COUNT);
  }
  function fromApi() {
    // GET request: a "simple" CORS request, so the browser sends no preflight (which Hashnode redirects).
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 7000);
    var url = 'https://gql.hashnode.com/?query=' + encodeURIComponent(QUERY) +
              '&variables=' + encodeURIComponent(JSON.stringify({ host: BLOG_HOST, n: POST_COUNT }));
    return fetch(url, { signal: ctrl ? ctrl.signal : undefined }).then(function (r) {
      clearTimeout(timer);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      var pub = j && j.data && j.data.publication;
      if (!pub || !pub.posts) throw new Error('no publication');
      return clean(pub.posts.edges.map(function (e) { return e.node; }));
    }).catch(function (err) { clearTimeout(timer); throw err; });
  }
  function fromStatic() {
    return fetch(STATIC_POSTS, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) { return clean(j && j.posts); });
  }
  var postsPromise = null;
  function loadPosts() {
    if (postsPromise) return postsPromise;
    var cached = readCache();
    if (cached && Date.now() - cached.t < CACHE_TTL && cached.posts.length) {
      postsPromise = Promise.resolve(clean(cached.posts));
    } else {
      postsPromise = fromStatic().catch(function () { return []; }).then(function (posts) {
        if (posts.length) return posts;                                          // 1. posts.json (GitHub Action)
        return fromApi().catch(function () { return []; });                     // 2. live API, best effort
      }).then(function (posts) {
        if (posts.length) { writeCache(posts); return posts; }
        return cached && cached.posts.length ? clean(cached.posts) : [];        // 3. stale cache
      });
    }
    return postsPromise;
  }
  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  var blogGrid = document.getElementById('blogGrid');
  if (blogGrid) {
    loadPosts().then(function (posts) {
      blogGrid.textContent = '';
      blogGrid.classList.remove('is-loading');
      if (!posts.length) {
        var note = document.createElement('div');
        note.className = 'card blog-note';
        note.style.gridColumn = '1 / -1';
        note.innerHTML = 'Posts couldn’t be loaded right now. ';
        var a = document.createElement('a');
        a.href = BLOG_URL; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Read the blog on Hashnode';
        note.appendChild(a);
        blogGrid.appendChild(note);
        return;
      }
      posts.forEach(function (p) {
        var a = document.createElement('a');
        a.className = 'card card--hover post';
        a.href = p.url; a.target = '_blank'; a.rel = 'noopener';
        var meta = document.createElement('div');
        meta.className = 'meta';
        var t = document.createElement('time'); t.style.margin = '0'; t.textContent = fmtDate(p.publishedAt);
        if (p.publishedAt) t.setAttribute('datetime', p.publishedAt);
        meta.appendChild(t);
        var rt = document.createElement('span');
        rt.textContent = (p.source === 'aws' ? 'AWS' : 'Hashnode') + (p.readTimeInMinutes ? ' \u00b7 ' + p.readTimeInMinutes + ' min read' : '');
        meta.appendChild(rt);
        var h = document.createElement('h3'); h.textContent = p.title;
        var d = document.createElement('p'); d.textContent = p.brief || '';
        var m = document.createElement('span'); m.className = 'more'; m.textContent = 'Read on ' + srcName(p);
        a.appendChild(meta); a.appendChild(h); a.appendChild(d); a.appendChild(m);
        blogGrid.appendChild(a);
      });
    });
  }

  /* ======================================================================
     RESUME PREVIEW
     ====================================================================== */
  var previewBtn = document.getElementById('resumePreview');
  var modal = null, modalReturn = null;
  function closeModal() {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.documentElement.classList.remove('modal-open');
    var f = modal.querySelector('iframe'); if (f) f.removeAttribute('src');   // stop loading in background
    if (modalReturn && modalReturn.focus) { try { modalReturn.focus({ preventScroll: true }); } catch (_) {} }
  }
  function openResume() {
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (coarse || navigator.pdfViewerEnabled === false) {            // phones & browsers without an inline PDF viewer
      window.open(RESUME_PATH, '_blank', 'noopener');
      return;
    }
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'modal'; modal.hidden = true;
      modal.innerHTML =
        '<div class="modal-box" role="dialog" aria-modal="true" aria-label="Resume preview">' +
        '<div class="modal-bar"><span>Sai Praneeth Resume.pdf · updated ' + RESUME_UPDATED + '</span>' +
        '<div class="actions"><a class="btn btn--sm" href="' + RESUME_PATH + '" download="Sai Praneeth Bhattu - Resume.pdf">Download</a>' +
        '<button type="button" class="btn btn--solid btn--sm" data-close>Close</button></div></div>' +
        '<iframe title="Resume (PDF preview)"></iframe></div>';
      document.body.appendChild(modal);
      modal.addEventListener('mousedown', function (e) { if (e.target === modal) closeModal(); });
      modal.querySelector('[data-close]').addEventListener('click', closeModal);
      modal.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.preventDefault(); closeModal(); }
        if (e.key === 'Tab') {                                       // keep focus inside the dialog
          var f = modal.querySelectorAll('a[href],button');
          var first = f[0], last = f[f.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      });
    }
    modalReturn = document.activeElement;
    modal.querySelector('iframe').src = RESUME_PATH + '#view=FitH';
    modal.hidden = false;
    document.documentElement.classList.add('modal-open');
    modal.querySelector('[data-close]').focus();
  }
  if (previewBtn) previewBtn.addEventListener('click', openResume);

  /* ======================================================================
     INTERACTIVE TERMINAL
     ====================================================================== */
  var term = document.getElementById('term');
  if (!term) return;
  var termSection = document.getElementById('terminal-section');
  if (termSection) termSection.hidden = false;        // hidden without JS

  var out = term.querySelector('.term-out');
  var form = term.querySelector('form');
  var input = term.querySelector('input');
  var hist = [], hpos = 0, draft = '';

  var PAGES = { home: 'index.html', about: 'about.html', experience: 'experience.html', projects: 'projects.html', skills: 'skills.html', contact: 'contact.html' };
  var EXTERNAL = {
    github: 'https://github.com/Bhattu-Sai-Praneeth',
    linkedin: 'https://www.linkedin.com/in/saipraneethbhattu',
    blog: BLOG_URL,
    resume: RESUME_PATH,
    paper: 'UN-C%20Paper.pdf'
  };
  var PROJECTS = [
    ['End-to-End CI/CD Pipeline', 'Jenkins · SonarQube · Trivy · Nexus · ArgoCD'],
    ['AWS Infrastructure with Terraform', 'VPC · EC2/ASG · ELB · RDS · Ansible'],
    ['Containerized Multi-Tier App', 'Docker · Helm · Kubernetes · HPA · Prometheus'],
    ['3-Tier Web Architecture', 'ALB · Nginx · Node.js · RDS MySQL · 2 AZs'],
    ['CI/CD Multi-Server Pipeline', 'GitHub · Jenkins · SonarQube · Ansible · Tomcat'],
    ['Health Elite', 'HTML/CSS/JS web app · GitHub Pages'],
    ['Stock Market Prediction', 'Multi-Filtered LSTM · Streamlit · ICACIT 2025'],
    ['Web Language Translator', 'JavaScript · MyMemory API · Vercel']
  ];
  var SKILLS = [
    ['cloud', 'AWS (EC2, S3, VPC, IAM, ALB, RDS, Lambda, CloudFront…), Azure, GCP'],
    ['devops', 'Jenkins, GitHub Actions, ArgoCD, SonarQube, Trivy, Nexus, Maven'],
    ['containers', 'Docker, Kubernetes, Helm'],
    ['iac', 'Terraform, Ansible'],
    ['observability', 'Prometheus, Grafana, CloudWatch'],
    ['languages', 'Python, JavaScript, C/C++, Shell'],
    ['ml', 'TensorFlow, Keras, Scikit-learn, time-series / LSTM']
  ];
  var FILES = ['about.txt', 'experience/', 'projects/', 'skills.json', 'resume.pdf', 'blog/', 'contact.txt'];
  var COMMANDS = ['help', 'whoami', 'about', 'ls', 'cat', 'projects', 'experience', 'education', 'skills', 'contact', 'blog', 'resume',
                  'open', 'cd', 'theme', 'history', 'date', 'echo', 'clear', 'sudo'];
  var ARGS = {
    ls: ['projects', 'skills'],
    cat: ['about', 'resume', 'contact', 'skills'],
    open: Object.keys(PAGES).concat(['resume', 'paper', 'github', 'linkedin', 'blog']),
    cd: Object.keys(PAGES),
    theme: ['dark', 'light', 'toggle'],
    sudo: ['hire-me']
  };

  /* ---- output helpers (textContent only, so user input can never inject HTML) ---- */
  function row(parts, cls) {
    var d = document.createElement('div');
    d.className = 'tl' + (cls ? ' ' + cls : '');
    (Array.isArray(parts) ? parts : [parts]).forEach(function (p) {
      if (typeof p === 'string') d.appendChild(document.createTextNode(p));
      else if (p.href) {
        var a = document.createElement('a');
        a.href = p.href; a.textContent = p.text || p.href;
        if (p.ext) { a.target = '_blank'; a.rel = 'noopener'; }
        d.appendChild(a);
      } else if (p.dim) {
        var s = document.createElement('span'); s.className = 'd'; s.textContent = p.dim; d.appendChild(s);
      }
    });
    out.appendChild(d);
    return d;
  }
  function rows(list) { list.forEach(function (r) { row(r); }); }
  function pad(s, n) { while (s.length < n) s += ' '; return s; }
  function scrollEnd() { out.scrollTop = out.scrollHeight; }
  function lnk(text, href, ext) { return { text: text, href: href, ext: !!ext }; }
  function dim(t) { return { dim: t }; }

  /* ---- commands ---- */
  var cmds = {
    help: function () {
      rows([
        'Available commands:',
        '',
        [dim('  whoami            '), 'who I am'],
        [dim('  about             '), 'short bio'],
        [dim('  ls [projects]     '), 'list files, or my projects'],
        [dim('  cat <file>        '), 'about | resume | contact | skills'],
        [dim('  projects          '), 'everything I’ve built'],
        [dim('  experience        '), 'internships'],
        [dim('  education         '), 'degrees'],
        [dim('  skills            '), 'tech stack'],
        [dim('  blog              '), 'latest posts'],
        [dim('  contact           '), 'ways to reach me'],
        [dim('  open <page|link>  '), 'about, projects, github, resume, …'],
        [dim('  theme <mode>      '), 'dark | light | toggle'],
        [dim('  history, clear    '), ''],
        '',
        [dim('Tip: Tab autocompletes, ↑/↓ browse history, Ctrl+L clears, Ctrl+K opens the palette.')]
      ]);
    },
    whoami: function () {
      rows([
        'Sai Praneeth Bhattu',
        [dim('role     '), 'DevOps & Cloud Engineer'],
        [dim('location '), 'Michigan, USA'],
        [dim('studying '), 'M.S. Computer & Information Science, UM-Dearborn'],
        [dim('focus    '), 'CI/CD · containers · IaC · AWS · observability']
      ]);
    },
    about: function () {
      rows([
        'Technology enthusiast focused on building resilient CI/CD pipelines,',
        'containerized infrastructure, and cloud-native solutions on AWS.',
        'I like automating everything from code to deployment, securing',
        'pipelines with DevSecOps practices, and building scalable infrastructure.',
        '',
        [dim('More: '), lnk('about.html', 'about.html')]
      ]);
    },
    ls: function (args) {
      var t = (args[0] || '').replace(/\/$/, '');
      if (!t) { row(FILES.join('   ')); return; }
      if (t === 'projects') { cmds.projects(); return; }
      if (t === 'skills') { cmds.skills(); return; }
      row('ls: cannot access ‘' + args[0] + '’: No such file or directory', 'err');
    },
    cat: function (args) {
      var f = (args[0] || '').toLowerCase().replace(/\.(txt|pdf|json)$/, '');
      if (!args[0]) { row('cat: missing file operand'); return; }
      if (f === 'about') cmds.about();
      else if (f === 'resume') cmds.resume();
      else if (f === 'contact') cmds.contact();
      else if (f === 'skills') cmds.skills();
      else row('cat: ' + args[0] + ': No such file or directory');
    },
    projects: function () {
      PROJECTS.forEach(function (p, i) { row([dim(pad(String(i + 1).length < 2 ? '0' + (i + 1) : String(i + 1), 4)), pad(p[0], 36), dim(p[1])]); });
      row('');
      row([dim('Details: '), lnk('projects.html', 'projects.html')]);
    },
    experience: function () {
      rows([
        [dim('May–Jul 2023  '), 'Cloud & ML Intern — AWS Academy (remote)'],
        [dim('                '), 'ML deployment pipelines on EC2/S3/IAM, Prometheus + Grafana monitoring'],
        [dim('Oct–Nov 2023  '), 'Frontend Developer Intern — Code Clause (remote)'],
        [dim('                '), '3 responsive front-end modules, CSS performance refactor'],
        '',
        [dim('More: '), lnk('experience.html', 'experience.html')]
      ]);
    },
    education: function () {
      rows([
        [dim('2026–2027  '), 'M.S. Computer & Information Science — University of Michigan-Dearborn'],
        [dim('2021–2025  '), 'B.Tech CSE (AIML) — CMR Engineering College, Hyderabad']
      ]);
    },
    skills: function () {
      SKILLS.forEach(function (s) { row([dim(pad(s[0], 15)), s[1]]); });
      row('');
      row([dim('Full inventory: '), lnk('skills.html', 'skills.html')]);
    },
    resume: function () {
      rows([
        'RESUME — Sai Praneeth Bhattu  ' ,
        [dim('Education   '), 'M.S. CIS, UM-Dearborn (2026–2027) · B.Tech CSE (AIML), CMR (2025)'],
        [dim('Experience  '), 'AWS Academy Cloud & ML Intern · Code Clause Frontend Intern'],
        [dim('Highlights  '), 'DevSecOps pipelines, Terraform on AWS, K8s + Helm, ICACIT 2025 paper'],
        [dim('Updated     '), RESUME_UPDATED],
        '',
        [lnk('→ open the full PDF', RESUME_PATH, true), dim('   (or run: open resume)')]
      ]);
    },
    contact: function () {
      rows([
        [dim('location '), 'Michigan, USA'],
        [dim('github   '), lnk('github.com/Bhattu-Sai-Praneeth', EXTERNAL.github, true)],
        [dim('linkedin '), lnk('in/saipraneethbhattu', EXTERNAL.linkedin, true)],
        [dim('blog     '), lnk('saipraneethbhattu.hashnode.dev', EXTERNAL.blog, true)],
        [dim('page     '), lnk('contact.html', 'contact.html')]
      ]);
    },
    blog: function () {
      var wait = row([dim('fetching latest posts…')]);
      return loadPosts().then(function (posts) {
        wait.remove();
        if (!posts.length) { row(['Couldn’t load posts right now. ', lnk('Read the blog on Hashnode', BLOG_URL, true)]); return; }
        posts.forEach(function (p, i) {
          row([dim(fmtDate(p.publishedAt) + '  '), lnk(p.title, p.url, true), dim('  [' + (p.source === 'aws' ? 'AWS' : 'Hashnode') + ']')]);
        });
        row(''); row([dim('All posts: '), lnk('Hashnode', BLOG_URL, true), dim('  \u00b7  '), lnk('AWS Builder Center', BUILDER_URL, true)]);
      });
    },
    open: function (args) {
      var t = (args[0] || '').toLowerCase().replace(/\.html$/, '').replace(/^\.?\/?/, '');
      if (!t) { row('usage: open <' + Object.keys(PAGES).concat(['resume', 'github', 'linkedin', 'blog']).join('|') + '>'); return; }
      if (PAGES[t]) { row(dim('opening ' + PAGES[t] + ' …')); setTimeout(function () { location.href = PAGES[t]; }, reduce ? 0 : 350); return; }
      if (EXTERNAL[t]) { row(dim('opening ' + t + ' …')); window.open(EXTERNAL[t], '_blank', 'noopener'); return; }
      row('open: ' + args[0] + ': not found. Try: ' + Object.keys(PAGES).concat(['resume', 'github', 'linkedin', 'blog']).join(', '));
    },
    cd: function (args) {
      var t = (args[0] || '~').toLowerCase().replace(/\/$/, '');
      if (t === '~' || t === '/' || t === '..' || t === 'home') { row(dim('already home')); return; }
      if (PAGES[t]) cmds.open([t]); else row('cd: ' + args[0] + ': No such file or directory');
    },
    theme: function (args) {
      var m = (args[0] || 'toggle').toLowerCase();
      if (!ui.setTheme) { row('theme switching is unavailable'); return; }
      if (m === 'toggle') ui.toggleTheme();
      else if (m === 'dark' || m === 'light') ui.setTheme(m);
      else { row('usage: theme [dark|light|toggle]'); return; }
      row(dim('theme → ' + ui.getTheme()));
    },
    history: function () {
      if (!hist.length) { row(dim('(empty)')); return; }
      hist.forEach(function (h, i) { row([dim(pad(String(i + 1), 4)), h]); });
    },
    date: function () { row(new Date().toString()); },
    echo: function (args) { row(args.join(' ')); },
    clear: function () { out.textContent = ''; },
    sudo: function (args) {
      if (args[0] === 'hire-me') {
        rows([
          [dim('[sudo] password for recruiter: '), '••••••••'],
          'Access granted. Excellent choice.',
          [dim('Next step: '), lnk('say hello on LinkedIn', EXTERNAL.linkedin, true), dim('  or  '), lnk('contact.html', 'contact.html')]
        ]);
      } else {
        row('recruiter is not in the sudoers file. This incident will be reported. (kidding)');
      }
    },
    exit: function () { row('There is no escape. Try ‘help’.'); }
  };

  function run(raw) {
    var line = raw.trim();
    row([dim('saipraneeth@devops:~$ '), raw], 'cmd');
    if (!line) return;
    if (hist[hist.length - 1] !== line) hist.push(line);
    hpos = hist.length; draft = '';
    var parts = line.split(/\s+/), name = parts[0].toLowerCase(), args = parts.slice(1);
    if (name === 'echo') args = line.replace(/^echo\s*/i, '').split(/\s+/).filter(Boolean);
    var fn = cmds[name];
    if (!fn) {
      var guess = COMMANDS.filter(function (c) { return c.indexOf(name) === 0; })[0];
      row('command not found: ' + name + (guess ? '  (did you mean ‘' + guess + '’?)' : '') + ' — type ‘help’');
      return;
    }
    return fn(args);
  }

  function submit(text) {
    var r = run(text);
    var done = function () { scrollEnd(); };
    if (r && r.then) r.then(done, done); else done();
  }

  /* ---- input handling ---- */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = input.value; input.value = '';
    submit(v);
  });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (hpos === hist.length) draft = input.value;
      if (hpos > 0) { hpos--; input.value = hist[hpos]; }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (hpos < hist.length) { hpos++; input.value = hpos === hist.length ? draft : hist[hpos]; }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault(); cmds.clear();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      var val = input.value, parts = val.split(/\s+/), pool, cur;
      if (parts.length === 1) { pool = COMMANDS; cur = parts[0]; }
      else if (parts.length === 2 && ARGS[parts[0].toLowerCase()]) { pool = ARGS[parts[0].toLowerCase()]; cur = parts[1]; }
      else return;
      var m = pool.filter(function (c) { return c.indexOf(cur.toLowerCase()) === 0; });
      if (m.length === 1) { parts[parts.length - 1] = m[0]; input.value = parts.join(' ') + ' '; }
      else if (m.length > 1) { row([dim('saipraneeth@devops:~$ '), val], 'cmd'); row(m.join('   ')); scrollEnd(); }
    }
  });
  term.addEventListener('click', function (e) {
    if (e.target.closest('a')) return;
    var sel = window.getSelection && String(window.getSelection());
    if (sel) return;                                   // don't steal focus while selecting text
    input.focus({ preventScroll: true });
  });

  /* suggestion chips under the terminal */
  Array.prototype.forEach.call(document.querySelectorAll('[data-cmd]'), function (b) {
    b.addEventListener('click', function () {
      submit(b.getAttribute('data-cmd'));
      input.focus({ preventScroll: true });
    });
  });

  /* boot message */
  rows([
    [dim('Welcome. This is a real (tiny) shell — type '), 'help', dim(' to see what it can do.')],
    [dim('Try: '), 'whoami', dim(', '), 'ls projects', dim(', '), 'cat resume', dim(', '), 'blog']
  ]);
  if (location.hash === '#terminal') setTimeout(function () { input.focus({ preventScroll: true }); }, 400);
})();
