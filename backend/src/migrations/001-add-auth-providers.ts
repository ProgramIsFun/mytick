import { Db } from 'mongodb';

export async function up(db: Db) {
  const users = db.collection('users');

  const oldUsers = await users.find({ password: { $exists: true }, providers: { $exists: false } }).toArray();
  console.log(`  Found ${oldUsers.length} users to migrate`);

  for (const user of oldUsers) {
    await users.updateOne({ _id: user._id }, {
      $set: {
        providers: [{ type: 'local', providerId: user.email, passwordHash: user.password }],
      },
      $unset: { password: '' },
    });
    console.log(`  Migrated: ${user.email}`);
  }
}
