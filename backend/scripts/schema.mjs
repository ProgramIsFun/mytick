// npm run schema
// Infers the Neo4j graph schema directly from your running database
// (local or production — uses NEO4J_URI env var)
// Outputs a Mermaid ER diagram you can paste into README.md

import neo4j from 'neo4j-driver';

const URI = process.env.NEO4J_URI;
const USER = process.env.NEO4J_USER;
const PASS = process.env.NEO4J_PASSWORD;

if (!URI || !USER || !PASS) {
  console.error('Set NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD');
  process.exit(1);
}

const driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASS));
const session = driver.session();

try {
  const result = await session.run(`
    MATCH (a)-[r]->(b)
    RETURN DISTINCT labels(a) AS src, type(r) AS rel, labels(b) AS dst
    ORDER BY src, rel
  `);

  const map = {};
  result.records.forEach(rec => {
    const src = rec.get('src').join(':');
    const rel = rec.get('rel');
    const dst = rec.get('dst').join(':');
    if (!map[rel]) map[rel] = { rel, pairs: new Set() };
    map[rel].pairs.add([src, dst]);
  });

  console.log('```mermaid');
  console.log('erDiagram');
  for (const m of Object.values(map)) {
    for (const [src, dst] of [...m.pairs].sort()) {
      console.log(`  ${src} ||--o{ ${dst} : ${m.rel}`);
    }
  }
  console.log('```');
} finally {
  await session.close();
  await driver.close();
}
