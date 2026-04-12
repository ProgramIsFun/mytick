import { Db } from 'mongodb';
import { nanoid } from 'nanoid';

export async function up(db: Db) {
  const users = db.collection('users');

  const noUsername = await users.find({ username: { $exists: false } }).toArray();
  console.log(`  Found ${noUsername.length} users without username`);

  for (const user of noUsername) {
    let username = `user_${nanoid(8).toLowerCase()}`;
    while (await users.findOne({ username })) { username = `user_${nanoid(8).toLowerCase()}`; }
    await users.updateOne({ _id: user._id }, { $set: { username } });
    console.log(`  ${user.email} → @${username}`);
  }
}
