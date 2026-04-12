import { Db } from 'mongodb';

export async function up(db: Db) {
  const users = db.collection('users');

  // Drop old non-sparse email index and recreate as sparse
  try {
    await users.dropIndex('email_1');
    console.log('  Dropped old email index');
  } catch { console.log('  No existing email index to drop'); }

  await users.createIndex({ email: 1 }, { unique: true, sparse: true });
  console.log('  Created sparse unique email index');
}
