#!/usr/bin/env node
const { MongoClient } = require("mongodb");
const fs = require("fs");
const path = require("path");

const uri = "mongodb+srv://hihi:pqF4p3GsYoMbQg8d@clustername71.g9ry4na.mongodb.net/?appName=Clustername71";
const date = new Date().toISOString().slice(0, 10);
const outDir = path.join(process.env.HOME, "Desktop", "mytick-backup-" + date);

(async () => {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("test");
  const collections = await db.listCollections().toArray();
  fs.mkdirSync(outDir, { recursive: true });

  let total = 0;
  for (const col of collections) {
    const docs = await db.collection(col.name).find({}).toArray();
    fs.writeFileSync(path.join(outDir, col.name + ".json"), JSON.stringify(docs, null, 2));
    total += docs.length;
    console.log("  " + col.name + ": " + docs.length + " docs");
  }
  await client.close();
  console.log("\nBacked up " + total + " docs to " + outDir);
})();
