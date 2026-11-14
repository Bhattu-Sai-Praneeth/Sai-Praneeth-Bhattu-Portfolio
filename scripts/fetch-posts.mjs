// Fetches your latest Hashnode posts (public GraphQL API, no token / premium needed)
// and writes assets/data/posts.json, which the home page uses as a fallback.
import { writeFile } from 'node:fs/promises';

const HOST = 'saipraneethbhattu.hashnode.dev';
const query = `query Posts($host:String!,$n:Int!){publication(host:$host){posts(first:$n){edges{node{title brief url publishedAt readTimeInMinutes}}}}}`;

const res = await fetch('https://gql.hashnode.com', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query, variables: { host: HOST, n: 6 } }),
});
if (!res.ok) throw new Error(`Hashnode API returned HTTP ${res.status}`);
const json = await res.json();
const pub = json?.data?.publication;
if (!pub) throw new Error('Publication not found: ' + JSON.stringify(json.errors ?? json));

const posts = pub.posts.edges.map((e) => e.node);
await writeFile(
  'assets/data/posts.json',
  JSON.stringify({ updated: new Date().toISOString(), posts }, null, 2) + '\n'
);
console.log(`Saved ${posts.length} posts`);
