import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function updateDbSecret() {
  console.log('Updating database secretId...\n');

  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mytick';
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const db = mongoose.connection.db!;

  // Update the database secretId
  const result = await db.collection('databases').updateOne(
    { name: 'MyTick Production' },
    { $set: { secretId: new mongoose.Types.ObjectId('69fc1e5c92f3eb0d2e7222d5') } }
  );

  console.log(`Updated ${result.modifiedCount} database(s)\n`);

  // Verify
  const databases = await db.collection('databases').find({ name: 'MyTick Production' }).toArray();
  console.log('Updated database:');
  databases.forEach(d => {
    console.log(`  - ${d.name}: secretId=${d.secretId}`);
  });

  await mongoose.disconnect();
}

if (require.main === module) {
  updateDbSecret().catch(err => {
    console.error('❌ Update failed:', err);
    process.exit(1);
  });
}

export default updateDbSecret;
