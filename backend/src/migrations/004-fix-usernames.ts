import { Db } from 'mongodb';

export async function up(db: Db) {
  const users = db.collection('users');
  const invalid = await users.find({ username: { $not: /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/ } }).toArray();
  console.log(`  Found ${invalid.length} users with invalid usernames`);

  for (const user of invalid) {
    const base = (user.email as string).split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16);
    let username = base || 'user';
    let i = 1;
    while (await users.findOne({ username, _id: { $ne: user._id } })) { username = `${base}-${i++}`; }
    await users.updateOne({ _id: user._id }, { $set: { username } });
    console.log(`  ${user.email}: @${user.username} → @${username}`);
  }
}
