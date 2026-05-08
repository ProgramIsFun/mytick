/**
 * Check Script: Find any documents still using legacy vaultId fields
 * 
 * Run this before and after migration to verify cleanup is complete.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Account from '../src/models/Account';
import Database from '../src/models/Database';

dotenv.config({ path: '.env' });

async function checkLegacyVaultId() {
  console.log('🔍 Checking for legacy vaultId references across all users...\n');

  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mytick';
  console.log(`Connecting to: ${MONGODB_URI}\n`);
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB');
    console.error('   Make sure MongoDB is running and MONGODB_URI is set correctly');
    throw err;
  }

  let hasLegacy = false;

  // Check accounts for vaultId in credentials
  console.log('📊 Checking Account.credentials for vaultId...');
  const accountsWithVaultId = await Account.aggregate([
    { $unwind: { path: '$credentials', preserveNullAndEmptyArrays: true } },
    { $match: { 'credentials.vaultId': { $exists: true, $ne: null } } },
    { $group: { _id: '$userId', accounts: { $push: '$$ROOT' }, count: { $sum: 1 } } },
    { $limit: 10 } // Show first 10 users
  ]);

  if (accountsWithVaultId.length > 0) {
    hasLegacy = true;
    console.log(`  ⚠️  Found ${accountsWithVaultId.length} users with accounts containing vaultId:`);
    for (const user of accountsWithVaultId) {
      console.log(`    - User ${user._id}: ${user.count} credentials with vaultId`);
    }
  } else {
    console.log('  ✅ No vaultId found in Account.credentials\n');
  }

  // Check databases for secretRefs
  console.log('📊 Checking Database.secretRefs...');
  const databasesWithSecretRefs = await Database.aggregate([
    { $match: { secretRefs: { $exists: true, $ne: [], $not: { $size: 0 } } } },
    { $group: { _id: '$userId', databases: { $push: '$$ROOT' }, count: { $sum: 1 } } },
    { $limit: 10 } // Show first 10 users
  ]);

  if (databasesWithSecretRefs.length > 0) {
    hasLegacy = true;
    console.log(`  ⚠️  Found ${databasesWithSecretRefs.length} users with databases containing secretRefs:`);
    for (const user of databasesWithSecretRefs) {
      console.log(`    - User ${user._id}: ${user.count} databases with secretRefs`);
    }
  } else {
    console.log('  ✅ No secretRefs found in Database\n');
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  if (hasLegacy) {
    console.log('❌ LEGACY DATA FOUND - Run cleanup-legacy-fields.ts to remove');
  } else {
    console.log('✅ CLEAN - No legacy vaultId or secretRefs found');
  }
  console.log('='.repeat(50));

  await mongoose.disconnect();
}

// Run check
if (require.main === module) {
  checkLegacyVaultId().catch(err => {
    console.error('❌ Check failed:', err);
    process.exit(1);
  });
}

export default checkLegacyVaultId;
