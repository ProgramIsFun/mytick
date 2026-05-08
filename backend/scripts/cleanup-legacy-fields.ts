/**
 * Cleanup Script: Remove legacy vaultId fields from Account and Database collections
 * 
 * This removes the old vaultId/secretRefs fields after migration to Secret collection is complete.
 * 
 * WARNING: This is destructive! Only run after confirming:
 * 1. All vault items have been migrated to Secret collection
 * 2. All Database/Account records reference Secret IDs
 * 3. Backup Lambda works with new Secret abstraction
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function cleanupLegacyFields() {
  console.log('🧹 Starting cleanup: Removing legacy vaultId fields\n');

  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mytick';
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const db = mongoose.connection.db!;

  // Step 1: Check if any accounts have vaultId in credentials
  console.log('📊 Step 1: Checking Account.credentials for vaultId...');
  const accountsWithVaultId = await db.collection('accounts').aggregate([
    { $unwind: { path: '$credentials', preserveNullAndEmptyArrays: true } },
    { $match: { 'credentials.vaultId': { $exists: true, $ne: null } } },
    { $group: { _id: '$userId', count: { $sum: 1 } } }
  ]).toArray();

  if (accountsWithVaultId.length > 0) {
    console.log(`  ⚠️  Found ${accountsWithVaultId.length} users with accounts containing vaultId:`);
    for (const user of accountsWithVaultId) {
      console.log(`    - User ${user._id}: ${user.count} credentials with vaultId`);
    }
  } else {
    console.log('  ✅ No vaultId found in Account.credentials\n');
  }

  // Step 2: Check if any databases have secretRefs
  console.log('📊 Step 2: Checking Database.secretRefs...');
  const databasesWithSecretRefs = await db.collection('databases').aggregate([
    { $match: { secretRefs: { $exists: true, $ne: [], $not: { $size: 0 } } } },
    { $group: { _id: '$userId', count: { $sum: 1 } } }
  ]).toArray();

  if (databasesWithSecretRefs.length > 0) {
    console.log(`  ⚠️  Found ${databasesWithSecretRefs.length} users with databases containing secretRefs:`);
    for (const user of databasesWithSecretRefs) {
      console.log(`    - User ${user._id}: ${user.count} databases with secretRefs`);
    }
  } else {
    console.log('  ✅ No secretRefs found in Database\n');
  }

  // Step 3: Remove legacy fields from accounts
  console.log('🧹 Step 3: Removing legacy vaultId from Account.credentials...');
  const accountUpdateResult = await db.collection('accounts').updateMany(
    { credentials: { $exists: true, $ne: [] } },
    { $unset: { 'credentials.$[].vaultId': '' } }
  );
  console.log(`  Removed vaultId from ${accountUpdateResult.modifiedCount} accounts\n`);

  // Step 4: Remove legacy fields from databases
  console.log('🧹 Step 4: Removing legacy secretRefs from Database...');
  const databaseUpdateResult = await db.collection('databases').updateMany(
    {},
    { $unset: { secretRefs: '' } }
  );
  console.log(`  Removed secretRefs from ${databaseUpdateResult.modifiedCount} databases\n`);

  console.log('✅ Cleanup complete!\n');
  console.log('📝 Summary:');
  console.log(`  - Removed vaultId from ${accountUpdateResult.modifiedCount} accounts`);
  console.log(`  - Removed secretRefs from ${databaseUpdateResult.modifiedCount} databases`);
  console.log('\n✅ New Schema:');
  console.log('  - Account.credentials[].secretId (reference to Secret)');
  console.log('  - Database.secretId (reference to Secret)');

  await mongoose.disconnect();
}

// Run cleanup
if (require.main === module) {
  cleanupLegacyFields().catch(err => {
    console.error('❌ Cleanup failed:', err);
    process.exit(1);
  });
}

export default cleanupLegacyFields;
