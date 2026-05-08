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
import Account from '../src/models/Account';
import Database from '../src/models/Database';

dotenv.config();

async function cleanupLegacyFields() {
  console.log('🧹 Starting cleanup: Removing legacy vaultId fields\n');

  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mytick';
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const userId = process.env.USER_ID;
  if (!userId) {
    throw new Error('USER_ID environment variable required');
  }

  // Step 1: Check if all accounts have secretId in credentials
  console.log('📊 Step 1: Checking Account credentials...');
  const accounts = await Account.find({ userId });
  console.log(`  Found ${accounts.length} accounts\n`);

  let accountsWithLegacy = 0;
  for (const account of accounts) {
    const hasLegacy = account.credentials.some(c => c.vaultId && !c.secretId);
    if (hasLegacy) {
      accountsWithLegacy++;
      console.log(`  ⚠️  Account ${account.name} has legacy vaultId without secretId`);
    }
  }
  console.log(`  ${accountsWithLegacy} accounts have legacy fields\n`);

  if (accountsWithLegacy > 0) {
    console.log('❌ Cannot proceed: Some accounts still have legacy vaultId fields');
    console.log('   Run migrate-vault-to-secrets.ts first to migrate all vault items\n');
    process.exit(1);
  }

  // Step 2: Check if all databases have secretId
  console.log('📊 Step 2: Checking Database secretRefs...');
  const databases = await Database.find({ userId });
  console.log(`  Found ${databases.length} databases\n`);

  let databasesWithLegacy = 0;
  for (const db of databases) {
    if (db.secretRefs.length > 0 && !db.secretId) {
      databasesWithLegacy++;
      console.log(`  ⚠️  Database ${db.name} has legacy secretRefs without secretId`);
    }
  }
  console.log(`  ${databasesWithLegacy} databases have legacy fields\n`);

  if (databasesWithLegacy > 0) {
    console.log('❌ Cannot proceed: Some databases still have legacy secretRefs');
    console.log('   Run migrate-vault-to-secrets.ts first to migrate all vault items\n');
    process.exit(1);
  }

  // Step 3: Remove legacy fields from accounts
  console.log('🧹 Step 3: Removing legacy vaultId from Account.credentials...');
  const accountUpdateResult = await Account.updateMany(
    { userId },
    { $unset: { 'credentials.$[].vaultId': '' } }
  );
  console.log(`  Removed vaultId from ${accountUpdateResult.modifiedCount} accounts\n`);

  // Step 4: Remove legacy fields from databases
  console.log('🧹 Step 4: Removing legacy secretRefs from Database...');
  const databaseUpdateResult = await Database.updateMany(
    { userId },
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
  console.log('\n⚠️  Note: Schema files still have legacy fields for now.');
  console.log('    Update models/Account.ts and models/Database.ts to remove them.');

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
