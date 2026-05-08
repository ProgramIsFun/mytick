import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function fixSecrets() {
  console.log('🔧 Fixing secrets with wrong userIds...\n');

  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mytick';
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const db = mongoose.connection.db!;

  // Delete duplicate secrets with wrong userIds (created in second run)
  const wrongIds = [
    '69fd6a8d0a945c4f390da20d',
    '69fd6a8d0a945c4f390da20e',
    '69fd6a8d0a945c4f390da20f',
    '69fd6a8d0a945c4f390da210',
    '69fd6ace13acb5c1db614802',
    '69fd6ace13acb5c1db614803',
    '69fd6ace13acb5c1db614804',
    '69fd6ace13acb5c1db614805'
  ];

  const result = await db.collection('secrets').deleteMany({
    _id: { $in: wrongIds.map(id => new mongoose.Types.ObjectId(id)) }
  });

  console.log(`✅ Deleted ${result.deletedCount} duplicate secrets with wrong userIds\n`);

  // Verify remaining secrets
  const secrets = await db.collection('secrets').find({}).toArray();
  console.log(`📊 Remaining secrets: ${secrets.length}`);
  for (const s of secrets) {
    console.log(`  - ${s.name}: userId=${s.userId}, providerSecretId=${s.providerSecretId}`);
  }

  await mongoose.disconnect();
}

if (require.main === module) {
  fixSecrets().catch(err => {
    console.error('❌ Fix failed:', err);
    process.exit(1);
  });
}

export default fixSecrets;
