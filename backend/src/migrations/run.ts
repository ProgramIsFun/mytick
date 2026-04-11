import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;
  const migrations = db.collection('_migrations');

  const dir = path.join(__dirname);
  const files = fs.readdirSync(dir)
    .filter(f => f.match(/^\d{3}-.*\.ts$/) && f !== 'run.ts')
    .sort();

  for (const file of files) {
    const exists = await migrations.findOne({ name: file });
    if (exists) {
      console.log(`SKIP: ${file} (already ran at ${exists.executedAt})`);
      continue;
    }

    console.log(`RUN: ${file}`);
    const migration = require(path.join(dir, file));
    await migration.up(db);
    await migrations.insertOne({ name: file, executedAt: new Date() });
    console.log(`DONE: ${file}`);
  }

  console.log('All migrations complete');
  await mongoose.disconnect();
}

run().catch(console.error);
