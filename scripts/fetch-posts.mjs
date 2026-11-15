// Builds assets/data/posts.json for the home page "Latest writing" section.
// Runs on GitHub Actions (server side, so no CORS). Sources:
//   1. Hashnode  - public GraphQL API, with the blog's RSS feed as a backup
//   2. AWS Builder Center - each URL listed in assets/data/builder-urls.txt
//      (post pages are server-rendered; we read their og:/article: meta tags)
// If a source fails, the previously saved posts for that source are kept.
import { readFile, writeFile } from 'node:fs/promises';

const HOST = 'saipraneethbhattu.hashnode.dev';
const MAX_SAVED = 12;
const OUT = 'assets/data/posts.json';
const URLS_FILE = 'assets/data/builder-urls.txt';
const UA = 'Mozilla/5.0 (compatible; portfolio-feed-bot; +https://saipraneethbhattu.me)';
const query = `query Posts($host:String!,$n:Int!){publication(host:$host){posts(first:$n){edges{node{title brief url publishedAt readTimeInMinutes}}}}}`;

const decode = (s = '') =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
   .replace(/<[^>]+>/g, '')
   .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
   .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#x27;/g, "'")
   .trim();

/* ---------------- Hashnode ---------------- */
async function hashnodeGraphQL() {
  const res = await fetch('https://gql.hashnode.com/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { host: HOST, n: MAX_SAVED } }),
  });
  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}`);
  const json = await res.json();
  const pub = json?.data?.publication;
  if (!pub) throw new Error('publication not found ' + JSON.stringify(json.errors ?? json));
  return pub.posts.edges.map((e) => e.node);
}
async function hashnodeRss() {
  const res = await fetch(`https://${HOST}/rss.xml`);
  if (!res.ok) throw new Error(`RSS HTTP ${res.status}`);
  const xml = await res.text();
  const tag = (b, n) => (b.match(new RegExp(`<${n}[^>]*>([\\s\\S]*?)</${n}>`)) || [])[1] || '';
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, MAX_SAVED).map(([, b]) => {
    const d = new Date(decode(tag(b, 'pubDate')));
    return { title: decode(tag(b, 'title')), brief: decode(tag(b, 'description')).slice(0, 220),
             url: decode(tag(b, 'link')), publishedAt: isNaN(d) ? null : d.toISOString(), readTimeInMinutes: null };
  });
}
async function getHashnode() {
  let posts;
  try { posts = await hashnodeGraphQL(); console.log('Hashnode: GraphQL ok'); }
  catch (e) { console.warn('Hashnode GraphQL failed:', e.message, '-> RSS'); posts = await hashnodeRss(); console.log('Hashnode: RSS ok'); }
  return posts.map((p) => ({ ...p, source: 'hashnode' }));
}

/* ---------------- AWS Builder Center ---------------- */
export function parseMeta(html) {
  const meta = {};
  for (const m of html.matchAll(/<meta\s+([^>]*?)\/?>/gi)) {
    const attrs = {};
    for (const a of m[1].matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[a[1].toLowerCase()] = a[2] ?? a[3];
    const key = (attrs.property || attrs.name || '').toLowerCase();
    if (key && attrs.content !== undefined && !(key in meta)) meta[key] = decode(attrs.content);
  }
  return meta;
}
export function builderPost(url, html) {
  const m = parseMeta(html);
  const title = (m['og:title'] || m['twitter:title'] || '').replace(/\s*\|\s*AWS Builder Center\s*$/i, '').trim();
  if (!title) throw new Error('no title meta tag found');
  const d = new Date(m['article:published_time'] || '');
  return { title, brief: m['og:description'] || m['description'] || '', url: m['og:url'] || url,
           publishedAt: isNaN(d) ? null : d.toISOString(), readTimeInMinutes: null, source: 'aws' };
}
async function getBuilder(previous) {
  let raw = '';
  try { raw = await readFile(URLS_FILE, 'utf8'); } catch { return previous; }
  const urls = raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  const out = [];
  for (const url of urls) {
    try {
      if (!/^https:\/\/builder\.aws\.com\/content\//.test(url)) throw new Error('not a builder.aws.com/content URL');
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      out.push(builderPost(url, await res.text()));
      console.log('Builder Center ok:', url);
    } catch (e) {
      console.warn('Builder Center failed:', url, '-', e.message);
      const old = previous.find((p) => p.url.startsWith(url.split('/').slice(0, 5).join('/')));   // same content id
      if (old) out.push(old);
    }
  }
  return out;
}

/* ---------------- main ---------------- */
let existing = [];
try { existing = JSON.parse(await readFile(OUT, 'utf8')).posts || []; } catch {}
const prevHashnode = existing.filter((p) => p.source !== 'aws');
const prevAws = existing.filter((p) => p.source === 'aws');

let hashnode;
try { hashnode = await getHashnode(); }
catch (e) { console.warn('Hashnode unavailable, keeping saved posts:', e.message); hashnode = prevHashnode; }
const aws = await getBuilder(prevAws);

const posts = [...hashnode, ...aws]
  .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
  .slice(0, MAX_SAVED);
if (!posts.length) throw new Error('No posts found from any source');

await writeFile(OUT, JSON.stringify({ updated: new Date().toISOString(), posts }, null, 2) + '\n');
console.log(`Saved ${posts.length} posts (${hashnode.length} Hashnode, ${aws.length} AWS Builder Center)`);
