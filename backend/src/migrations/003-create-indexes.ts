import { Db } from 'mongodb';

export async function up(db: Db) {
  const users = db.collection('users');
  const tasks = db.collection('tasks');

  // User indexes
  await users.createIndex({ email: 1 }, { unique: true });
  console.log('  Created index: users.email (unique)');

  await users.createIndex({ username: 1 }, { unique: true, sparse: true });
  console.log('  Created index: users.username (unique, sparse)');

  await users.createIndex({ 'providers.type': 1, 'providers.providerId': 1 }, { unique: true, sparse: true });
  console.log('  Created index: users.providers (unique, sparse)');

  // Task indexes
  await tasks.createIndex({ userId: 1, createdAt: -1 });
  console.log('  Created index: tasks.userId+createdAt');

  await tasks.createIndex({ shareToken: 1 }, { unique: true });
  console.log('  Created index: tasks.shareToken (unique)');

  await tasks.createIndex({ blockedBy: 1 });
  console.log('  Created index: tasks.blockedBy');

  await tasks.createIndex({ visibility: 1, userId: 1 });
  console.log('  Created index: tasks.visibility+userId');
}
