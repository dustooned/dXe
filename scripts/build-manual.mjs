#!/usr/bin/env node
// Renders docs/*.md into a single self-contained HTML manual with a grouped
// sidebar, per-document contents, and client-side search.
//
// Output: public/manual/index.html — which means it is served by the dev
// server at /manual/, copied into dist/ by the Vite build, and also opens
// directly from disk via file:// (everything is inlined; nothing is fetched).
//
// Usage: node scripts/build-manual.mjs           (build)
//        node scripts/build-manual.mjs --open    (build, then open it)
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { marked } from 'marked';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS_DIR = join(ROOT, 'docs');
const OUT_DIR = join(ROOT, 'public', 'manual');
const OUT_FILE = join(OUT_DIR, 'index.html');

// Grouping is editorial, not alphabetical — a newcomer should be able to read
// down the first group and stop, without wading through shelved concept docs.
// Any .md not listed here still gets included, under "Unsorted", so adding a
// doc never silently drops it from the manual.
const GROUPS = [
  {
    name: 'Start here',
    blurb: 'The working documentation for what is actually built.',
    docs: [
      ['HANDOFF.md', 'Handoff / Project Status'],
      ['ARCHITECTURE.md', 'Architecture'],
      ['SCENE_TYPES.md', 'Scene Types'],
      ['ASSET_GUIDELINES.md', 'Asset Guidelines'],
    ],
  },
  {
    name: 'Authoring',
    blurb: 'Writing dialog and understanding the numbers behind it.',
    docs: [
      ['SCRIPT_FORMAT.md', 'Script Format'],
      ['CONTENT_SCHEMA.md', 'Content Schema'],
      ['STAT_MATH.md', 'Stat Math'],
    ],
  },
  {
    name: 'Planning',
    blurb: 'Backlog, unbuilt feature designs, and the GameMaker port reference.',
    docs: [
      ['JOBS.md', 'Jobs Backlog'],
      ['IT_DESIGN.md', 'IT — Design Document'],
      ['GM_BUILD.md', 'GameMaker Beta Reference'],
    ],
  },
  {
    name: 'Source & legacy',
    blurb: 'Original design documents. Much of this describes the larger shelved concept — see the Handoff for what was cut.',
    docs: [
      ['DX Bible.md', 'DX Bible'],
      ['DX_DEMO_BUILD_SPEC.md', 'Demo Build Spec'],
      ['DX MECHANICS.md', 'DX Mechanics'],
      ['DreamXtreme Game Development Demo Doc.md', 'Game Development Demo Doc'],
    ],
  },
  {
    name: 'Reference',
    blurb: 'Code removed from the build, kept in case a decision needs reversing.',
    docs: [['ATTIC.md', 'Attic']],
  },
];

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60) || 'section';
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Every .md in docs/, so a new file can't go missing from the manual.
function collectDocs() {
  const listed = new Set(GROUPS.flatMap(g => g.docs.map(([file]) => file)));
  const onDisk = readdirSync(DOCS_DIR).filter(f => f.toLowerCase().endsWith('.md'));
  const groups = GROUPS.map(g => ({ ...g, docs: g.docs.filter(([f]) => onDisk.includes(f)) }))
    .filter(g => g.docs.length > 0);

  const unsorted = onDisk.filter(f => !listed.has(f));
  if (unsorted.length) {
    console.warn(`  note: ${unsorted.length} doc(s) not in GROUPS, filing under "Unsorted": ${unsorted.join(', ')}`);
    groups.push({
      name: 'Unsorted',
      blurb: 'Not yet placed in a group in scripts/build-manual.mjs.',
      docs: unsorted.map(f => [f, f.replace(/\.md$/i, '')]),
    });
  }
  return groups;
}

// marked leaves headings bare; add stable ids so the contents list and search
// can link into them. Post-processing the HTML keeps this independent of
// whichever renderer API version marked is on.
function addHeadingIds(html, docId) {
  const seen = new Map();
  const headings = [];
  const out = html.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (_m, level, inner) => {
    const text = inner.replace(/<[^>]+>/g, '').trim();
    let slug = `${docId}--${slugify(text)}`;
    const n = seen.get(slug) ?? 0;
    seen.set(slug, n + 1);
    if (n) slug = `${slug}-${n + 1}`;
    headings.push({ level: Number(level), text, id: slug });
    return `<h${level} id="${slug}"><a class="anchor" href="#${slug}" aria-label="Link to this section">#</a>${inner}</h${level}>`;
  });
  return { html: out, headings };
}

// Cross-document markdown links (ARCHITECTURE.md, ./SCENE_TYPES.md#foo) become
// in-manual navigation instead of dead links to raw files.
function rewriteDocLinks(html, fileToId) {
  return html.replace(/href="([^"]+\.md)(#[^"]*)?"/gi, (match, file) => {
    const bare = decodeURIComponent(file.replace(/^\.\//, '').split('/').pop());
    const id = fileToId.get(bare);
    return id ? `href="#${id}" data-doc="${id}"` : match;
  });
}

// The docs mostly name each other in backticks ("see `ARCHITECTURE.md`") rather
// than as markdown links, so those would be dead ends in a manual whose whole
// point is navigation. Turn them into links — but never inside a <pre>, where
// a filename is sample content rather than a reference.
function linkDocMentions(html, fileToId, selfId) {
  const parts = html.split(/(<pre[\s\S]*?<\/pre>)/g);
  return parts.map((part, i) => {
    if (i % 2 === 1) return part;
    return part.replace(/<code>([^<]+\.md)<\/code>/gi, (match, name) => {
      const id = fileToId.get(name.trim());
      if (!id || id === selfId) return match;
      return `<a class="doc-ref" href="#${id}" data-doc="${id}"><code>${name}</code></a>`;
    });
  }).join('');
}

function build() {
  const groups = collectDocs();
  const fileToId = new Map();
  for (const g of groups) {
    for (const [file] of g.docs) fileToId.set(file, `doc-${slugify(file.replace(/\.md$/i, ''))}`);
  }

  const rendered = [];
  for (const group of groups) {
    for (const [file, title] of group.docs) {
      const id = fileToId.get(file);
      const md = readFileSync(join(DOCS_DIR, file), 'utf8');
      let html = marked.parse(md, { mangle: false, headerIds: false });
      html = rewriteDocLinks(html, fileToId);
      html = linkDocMentions(html, fileToId, id);
      const withIds = addHeadingIds(html, id);
      rendered.push({ id, file, title, group: group.name, html: withIds.html, headings: withIds.headings });
    }
  }

  const order = rendered.map(d => d.id);

  const sidebar = groups.map(group => {
    const items = group.docs.map(([file, title]) => {
      const id = fileToId.get(file);
      return `<li><a class="nav-doc" href="#${id}" data-doc="${id}">${escapeHtml(title)}</a></li>`;
    }).join('');
    return `<div class="nav-group">
        <h2>${escapeHtml(group.name)}</h2>
        <p class="nav-blurb">${escapeHtml(group.blurb)}</p>
        <ul>${items}</ul>
      </div>`;
  }).join('');

  const articles = rendered.map((doc, i) => {
    const prev = i > 0 ? rendered[i - 1] : null;
    const next = i < rendered.length - 1 ? rendered[i + 1] : null;
    const toc = doc.headings.filter(h => h.level === 2);
    const tocHtml = toc.length > 1
      ? `<nav class="doc-toc"><p class="doc-toc-label">On this page</p><ul>${
          toc.map(h => `<li><a href="#${h.id}">${escapeHtml(h.text)}</a></li>`).join('')
        }</ul></nav>`
      : '';
    const pager = `<nav class="pager">
        ${prev ? `<a href="#${prev.id}" data-doc="${prev.id}"><span>Previous</span>${escapeHtml(prev.title)}</a>` : '<span></span>'}
        ${next ? `<a class="next" href="#${next.id}" data-doc="${next.id}"><span>Next</span>${escapeHtml(next.title)}</a>` : '<span></span>'}
      </nav>`;
    return `<article class="doc" id="${doc.id}" data-title="${escapeHtml(doc.title)}" data-file="${escapeHtml(doc.file)}" hidden>
      <p class="doc-source">${escapeHtml(doc.group)} · <code>docs/${escapeHtml(doc.file)}</code></p>
      ${tocHtml}
      ${doc.html}
      ${pager}
    </article>`;
  }).join('\n');

  const html = page({ sidebar, articles, order, count: rendered.length });

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, html, 'utf8');

  const kb = Math.round(Buffer.byteLength(html, 'utf8') / 1024);
  console.log(`built manual: ${rendered.length} documents -> public/manual/index.html (${kb}KB)`);

  if (process.argv.includes('--open')) openInBrowser(OUT_FILE);
}

// The manual inlines everything, so file:// works — no dev server needed.
function openInBrowser(file) {
  const url = pathToFileURL(file).href;
  const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : process.platform === 'darwin' ? ['open', [url]]
    : ['xdg-open', [url]];
  spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
  console.log(`opening ${url}`);
}

function page({ sidebar, articles, order, count }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dream Xtreme — Manual</title>
<style>
:root {
  --bg: #0b0b0b; --panel: #121212; --fg: #e8e8e8; --dim: #9a9a9a;
  --line: #2c2c2c; --accent: #ffffff; --code-bg: #1a1a1a; --mark: #4a4a00;
}
@media (prefers-color-scheme: light) {
  :root {
    --bg: #ffffff; --panel: #f6f6f6; --fg: #16161a; --dim: #5d5d66;
    --line: #dcdce0; --accent: #000000; --code-bg: #f0f0f2; --mark: #fff3a3;
  }
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--bg); color: var(--fg);
  font: 16px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  display: grid; grid-template-columns: 300px minmax(0, 1fr); min-height: 100vh;
}
a { color: var(--fg); text-decoration-color: var(--dim); text-underline-offset: 2px; }
a:hover { text-decoration-color: var(--fg); }

/* Sidebar */
.sidebar {
  background: var(--panel); border-right: 1px solid var(--line);
  padding: 20px 0 40px; position: sticky; top: 0; height: 100vh; overflow-y: auto;
}
.brand { padding: 0 20px 14px; border-bottom: 1px solid var(--line); margin-bottom: 14px; }
.brand h1 { font-size: 15px; margin: 0; letter-spacing: 0.02em; }
.brand p { margin: 4px 0 0; font-size: 12px; color: var(--dim); }
.search-wrap { padding: 0 20px 14px; }
#search {
  width: 100%; padding: 8px 10px; font: inherit; font-size: 13px;
  background: var(--bg); color: var(--fg); border: 1px solid var(--line);
}
#search:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
.search-hint { font-size: 11px; color: var(--dim); margin: 6px 0 0; }
.nav-group { padding: 0 20px; margin-bottom: 20px; }
.nav-group h2 {
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.09em;
  color: var(--dim); margin: 0 0 4px;
}
.nav-blurb { font-size: 11px; color: var(--dim); margin: 0 0 8px; line-height: 1.45; }
.nav-group ul { list-style: none; margin: 0; padding: 0; }
.nav-doc {
  display: block; padding: 5px 8px; margin-left: -8px; font-size: 13.5px;
  text-decoration: none; border-left: 2px solid transparent;
}
.nav-doc:hover { background: var(--code-bg); }
.nav-doc.active { border-left-color: var(--accent); background: var(--code-bg); font-weight: 600; }

/* Search results */
#results { padding: 0 20px; }
#results.empty { display: none; }
.result { display: block; padding: 8px; margin: 0 -8px 2px; text-decoration: none; font-size: 13px; }
.result:hover { background: var(--code-bg); }
.result b { display: block; font-size: 11px; color: var(--dim); font-weight: 400; text-transform: uppercase; letter-spacing: 0.06em; }
.no-results { font-size: 12px; color: var(--dim); padding: 8px 0; }

/* Content */
main { padding: 40px 48px 96px; max-width: 860px; }
.doc-source { font-size: 11px; color: var(--dim); text-transform: uppercase; letter-spacing: 0.07em; margin: 0 0 20px; }
.doc-source code { font-size: 11px; background: none; padding: 0; text-transform: none; }
h1, h2, h3, h4 { line-height: 1.25; scroll-margin-top: 20px; }
h1 { font-size: 28px; margin: 0 0 20px; }
h2 { font-size: 20px; margin: 38px 0 12px; padding-bottom: 6px; border-bottom: 1px solid var(--line); }
h3 { font-size: 16px; margin: 26px 0 8px; }
h4 { font-size: 14px; margin: 20px 0 6px; color: var(--dim); }
.anchor {
  float: left; margin-left: -1.1em; padding-right: 0.35em; color: var(--dim);
  text-decoration: none; opacity: 0; font-weight: 400;
}
h1:hover .anchor, h2:hover .anchor, h3:hover .anchor, h4:hover .anchor { opacity: 1; }
p, li { overflow-wrap: break-word; }
code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.875em; background: var(--code-bg); padding: 1px 5px; border-radius: 2px;
}
pre {
  background: var(--code-bg); border: 1px solid var(--line); padding: 14px 16px;
  overflow-x: auto; font-size: 13px; line-height: 1.5;
}
pre code { background: none; padding: 0; font-size: inherit; }
blockquote {
  margin: 18px 0; padding: 2px 18px; border-left: 3px solid var(--accent); color: var(--fg);
}
table { border-collapse: collapse; width: 100%; font-size: 14px; margin: 16px 0; display: block; overflow-x: auto; }
th, td { border: 1px solid var(--line); padding: 7px 11px; text-align: left; vertical-align: top; }
th { background: var(--code-bg); font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
img { max-width: 100%; height: auto; border: 1px solid var(--line); }
hr { border: none; border-top: 1px solid var(--line); margin: 32px 0; }
del { color: var(--dim); }

.doc-toc { background: var(--panel); border: 1px solid var(--line); padding: 14px 18px; margin: 0 0 28px; }
.doc-toc-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--dim); margin: 0 0 8px; }
.doc-toc ul { margin: 0; padding-left: 18px; font-size: 13.5px; }
.doc-toc li { margin: 3px 0; }

.pager { display: flex; justify-content: space-between; gap: 16px; margin-top: 56px; padding-top: 20px; border-top: 1px solid var(--line); }
.pager a { flex: 1; padding: 12px 14px; border: 1px solid var(--line); text-decoration: none; font-size: 14px; }
.pager a:hover { background: var(--code-bg); }
.pager a.next { text-align: right; }
.pager span { display: block; font-size: 11px; color: var(--dim); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 3px; }

mark { background: var(--mark); color: var(--fg); }

/* Backtick mentions of other docs, made navigable at build time. */
.doc-ref { text-decoration: none; border-bottom: 1px solid var(--dim); }
.doc-ref:hover { border-bottom-color: var(--accent); }
.doc-ref code { background: var(--code-bg); }
.doc-ref::after { content: " ↗"; font-size: 0.75em; color: var(--dim); }

.menu-toggle { display: none; }
@media (max-width: 860px) {
  body { grid-template-columns: 1fr; }
  .sidebar { position: static; height: auto; max-height: none; }
  .sidebar[data-collapsed="true"] .nav-group,
  .sidebar[data-collapsed="true"] #results,
  .sidebar[data-collapsed="true"] .search-wrap { display: none; }
  main { padding: 24px 20px 64px; }
  .menu-toggle {
    display: block; margin: 0 20px 12px; padding: 7px 12px; font: inherit; font-size: 13px;
    background: var(--bg); color: var(--fg); border: 1px solid var(--line); cursor: pointer;
  }
  .pager { flex-direction: column; }
}
</style>
</head>
<body>
<nav class="sidebar" id="sidebar">
  <div class="brand">
    <h1>Dream Xtreme</h1>
    <p>Project manual · ${count} documents</p>
  </div>
  <button class="menu-toggle" id="menuToggle" aria-expanded="true">Menu</button>
  <div class="search-wrap">
    <input id="search" type="search" placeholder="Search the manual…" autocomplete="off" spellcheck="false" aria-label="Search">
    <p class="search-hint">Press <kbd>/</kbd> to focus · <kbd>Esc</kbd> to clear</p>
  </div>
  <div id="results" class="empty"></div>
  <div id="nav">${sidebar}</div>
</nav>
<main id="main">${articles}</main>

<script>
(function () {
  var ORDER = ${JSON.stringify(order)};
  var docs = ORDER.map(function (id) { return document.getElementById(id); }).filter(Boolean);
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav-doc'));
  var search = document.getElementById('search');
  var results = document.getElementById('results');
  var navList = document.getElementById('nav');
  var sidebar = document.getElementById('sidebar');
  var toggle = document.getElementById('menuToggle');

  // Search index is built from the rendered DOM rather than emitted alongside
  // it — duplicating every doc's text into a JSON blob would roughly double
  // the file for no gain.
  var index = [];
  docs.forEach(function (doc) {
    var title = doc.dataset.title;
    var heads = doc.querySelectorAll('h1, h2, h3');
    heads.forEach(function (h) {
      var text = '';
      var n = h.nextElementSibling;
      while (n && !/^H[1-3]$/.test(n.tagName)) { text += ' ' + n.textContent; n = n.nextElementSibling; }
      index.push({
        docId: doc.id,
        id: h.id,
        docTitle: title,
        heading: h.textContent.replace(/^#/, '').trim(),
        hay: (title + ' ' + h.textContent + ' ' + text).toLowerCase()
      });
    });
  });

  function show(id, hash) {
    if (ORDER.indexOf(id) === -1) return;
    docs.forEach(function (d) { d.hidden = d.id !== id; });
    navLinks.forEach(function (a) { a.classList.toggle('active', a.dataset.doc === id); });
    if (hash && hash !== id) {
      var el = document.getElementById(hash);
      if (el) { el.scrollIntoView(); return; }
    }
    window.scrollTo(0, 0);
    if (window.innerWidth <= 860) collapse(true);
  }

  function fromHash() {
    var raw = location.hash.replace(/^#/, '');
    if (!raw) { show(ORDER[0]); return; }
    // Heading ids are prefixed with their document's id, so a prefix test
    // would match them too — check actual membership instead.
    if (ORDER.indexOf(raw) !== -1) { show(raw); return; }
    var el = document.getElementById(raw);
    var host = el && el.closest ? el.closest('.doc') : null;
    if (host) { show(host.id, raw); return; }
    show(ORDER[0]);
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;
    var raw = a.getAttribute('href').slice(1);
    var el = document.getElementById(raw);
    if (!el) return;
    e.preventDefault();
    if (location.hash.slice(1) === raw) fromHash();
    else location.hash = raw;
  });

  window.addEventListener('hashchange', fromHash);

  function collapse(state) {
    sidebar.dataset.collapsed = state ? 'true' : 'false';
    toggle.setAttribute('aria-expanded', state ? 'false' : 'true');
  }
  toggle.addEventListener('click', function () {
    collapse(sidebar.dataset.collapsed !== 'true' ? true : false);
  });

  var timer;
  search.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(runSearch, 90);
  });
  search.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { search.value = ''; runSearch(); search.blur(); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement !== search) { e.preventDefault(); search.focus(); }
  });

  function runSearch() {
    var q = search.value.trim().toLowerCase();
    if (q.length < 2) {
      results.className = 'empty';
      results.innerHTML = '';
      navList.style.display = '';
      return;
    }
    var terms = q.split(/\\s+/);
    var hits = index.filter(function (row) {
      return terms.every(function (t) { return row.hay.indexOf(t) !== -1; });
    }).slice(0, 40);

    navList.style.display = 'none';
    results.className = '';
    if (!hits.length) {
      results.innerHTML = '<p class="no-results">No matches for “' + esc(q) + '”.</p>';
      return;
    }
    results.innerHTML = hits.map(function (h) {
      return '<a class="result" href="#' + h.id + '"><b>' + esc(h.docTitle) + '</b>' + esc(h.heading) + '</a>';
    }).join('');
  }

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  fromHash();
})();
</script>
</body>
</html>`;
}

build();
