// Fetches your latest Hashnode posts and writes assets/data/posts.json,
// which the home page reads. Runs on GitHub Actions (server side, so no CORS).
// Source 1: Hashnode public GraphQL API.  Source 2 (backup): your blog's RSS feed.
import { writeFile } from 'node:fs/promises';

const HOST = 'saipraneethbhattu.hashnode.dev';
const COUNT = 6;
const query = `query Posts($host:String!,$n:Int!){publication(host:$host){posts(first:$n){edges{node{title brief url publishedAt readTimeInMinutes}}}}}`;

async function viaGraphQL() {
  const res = await fetch('https://gql.hashnode.com/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { host: HOST, n: COUNT } }),
  });
  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}`);
  const json = await res.json();
  const pub = json?.data?.publication;
  if (!pub) throw new Error('GraphQL: publication not found ' + JSON.stringify(json.errors ?? json));
  return pub.posts.edges.map((e) => e.node);
}

const decode = (s) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
   .replace(/<[^>]+>/g, '')
   .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
   .trim();

async function viaRss() {
  const res = await fetch(`https://${HOST}/rss.xml`);
  if (!res.ok) throw new Error(`RSS HTTP ${res.status}`);
  const xml = await res.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, COUNT);
  const tag = (block, name) => (block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`)) || [])[1] || '';
  return items.map(([, b]) => {
    const brief = decode(tag(b, 'description')).slice(0, 220);
    const date = new Date(decode(tag(b, 'pubDate')));
    return {
      title: decode(tag(b, 'title')),
      brief,
      url: decode(tag(b, 'link')),
      publishedAt: isNaN(date) ? null : date.toISOString(),
      readTimeInMinutes: null,
    };
  });
}

let posts, source;
try { posts = await viaGraphQL(); source = 'GraphQL'; }
catch (e1) {
  console.warn('GraphQL failed:', e1.message, '→ trying RSS');
  posts = await viaRss(); source = 'RSS';
}
if (!posts.length) throw new Error('No posts found. Check HOST in scripts/fetch-posts.mjs');

await writeFile('assets/data/posts.json', JSON.stringify({ updated: new Date().toISOString(), posts }, null, 2) + '\n');
console.log(`Saved ${posts.length} posts via ${source}`);
