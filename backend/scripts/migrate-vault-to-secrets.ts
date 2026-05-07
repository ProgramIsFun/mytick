/**
 * PHASE 1 Migration Script: Vault Items → Secret Collection
 * 
 * This creates the Secret abstraction layer while KEEPING existing vault items.
 * No Bitwarden Secrets Manager setup needed yet!
 * 
 * What it does:
 * 1. Scans Database and Account collections for vault references
 * 2. Creates Secret records pointing to EXISTING vault items
 * 3. Updates Database/Account to reference Secret IDs
 * 4. Keeps old fields (secretRefs, vaultId) for rollback safety
 * 
 * After this: Test everything, then Phase 2 moves to Secrets Manager
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Secret from '../src/models/Secret';
import Database from '../src/models/Database';
import Account from '../src/models/Account';

// Load environment variables
dotenv.config();

interface VaultItem {
  vaultId: string;
  usedBy: {
    collection: string;
    itemId: mongoose.Types.ObjectId;
    itemName: string;
  }[];
}

async function migrateVaultToSecrets() {
  console.log('🔄 Starting migration: Vault Items → Secret Collection\n');

  // Connect to database
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mytick';
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const userId = process.env.USER_ID;
  if (!userId) {
    throw new Error('USER_ID environment variable required');
  }

  // Step 1: Collect all vault items from databases
  console.log('📊 Step 1: Scanning Database collection...');
  const databases = await Database.find({ 
    userId,
    secretRefs: { $exists: true, $ne: [] }
  });

  const vaultMap = new Map<string, VaultItem>();

  for (const db of databases) {
    for (const ref of db.secretRefs) {
      if (ref.provider === 'bitwarden' && ref.itemId) {
        if (!vaultMap.has(ref.itemId)) {
          vaultMap.set(ref.itemId, {
            vaultId: ref.itemId,
            usedBy: []
          });
        }
        vaultMap.get(ref.itemId)!.usedBy.push({
          collection: 'databases',
          itemId: db._id,
          itemName: db.name
        });
      }
    }
  }
  console.log(`  Found ${databases.length} databases with ${vaultMap.size} unique vault items\n`);

  // Step 2: Collect all vault items from accounts
  console.log('📊 Step 2: Scanning Account collection...');
  const accounts = await Account.find({
    userId,
    credentials: { $exists: true, $ne: [] }
  });

  for (const account of accounts) {
    for (const cred of account.credentials) {
      if (cred.vaultId) {
        if (!vaultMap.has(cred.vaultId)) {
          vaultMap.set(cred.vaultId, {
            vaultId: cred.vaultId,
            usedBy: []
          });
        }
        vaultMap.get(cred.vaultId)!.usedBy.push({
          collection: 'accounts',
          itemId: account._id,
          itemName: account.name
        });
      }
    }
  }
  console.log(`  Found ${accounts.length} accounts with ${vaultMap.size} total unique vault items\n`);

  // Step 3: Create Secret records
  console.log('🔐 Step 3: Creating Secret records...');
  const secretMapping = new Map<string, mongoose.Types.ObjectId>(); // vaultId → secretId

  for (const [vaultId, item] of vaultMap) {
    console.log(`  Creating secret for vault item: ${vaultId}`);
    console.log(`    Used by: ${item.usedBy.map(u => `${u.collection}/${u.itemName}`).join(', ')}`);

    // Determine type based on usage
    let type: any = 'other';
    let name = `Vault Item ${vaultId.substring(0, 8)}`;
    
    if (item.usedBy.some(u => u.collection === 'databases')) {
      type = 'connection_string';
      const dbUsage = item.usedBy.find(u => u.collection === 'databases');
      name = `${dbUsage?.itemName} Connection`;
    } else if (item.usedBy.some(u => u.itemName.toLowerCase().includes('password'))) {
      type = 'password';
      name = `${item.usedBy[0].itemName} Password`;
    }

    const secret = await Secret.create({
      userId,
      name,
      description: `PHASE 1: Using vault item ${vaultId}. Later migrate to Secrets Manager.`,
      provider: 'bitwarden',
      providerSecretId: vaultId, // PHASE 1: This is vault item ID (works with current Lambda)
      type,
      tags: ['phase1-migration', 'vault-item'],
      usedBy: item.usedBy
    });

    secretMapping.set(vaultId, secret._id);
    console.log(`    ✅ Created secret: ${secret._id} (vault: ${vaultId})\n`);
  }

  console.log(`✅ Created ${secretMapping.size} secret records\n`);

  // Step 4: Update Database records to reference Secret IDs
  console.log('🔄 Step 4: Updating Database records...');
  for (const db of databases) {
    let updated = false;
    for (const ref of db.secretRefs) {
      if (ref.provider === 'bitwarden' && ref.itemId) {
        const secretId = secretMapping.get(ref.itemId);
        if (secretId) {
          // Add secretId field to database (will need to update schema)
          (db as any).secretId = secretId;
          updated = true;
        }
      }
    }
    if (updated) {
      await db.save();
      console.log(`  ✅ Updated database: ${db.name}`);
    }
  }

  // Step 5: Update Account records to reference Secret IDs  
  console.log('\n🔄 Step 5: Updating Account records...');
  for (const account of accounts) {
    let updated = false;
    for (const cred of account.credentials) {
      if (cred.vaultId) {
        const secretId = secretMapping.get(cred.vaultId);
        if (secretId) {
          // Add secretId to credential (will need to update schema)
          (cred as any).secretId = secretId;
          updated = true;
        }
      }
    }
    if (updated) {
      await account.save();
      console.log(`  ✅ Updated account: ${account.name}`);
    }
  }

  console.log('\n✅ PHASE 1 Migration complete!\n');
  console.log('📝 Summary:');
  console.log(`  - Created ${secretMapping.size} Secret records (pointing to vault items)`);
  console.log(`  - Updated ${databases.length} Database records`);
  console.log(`  - Updated ${accounts.length} Account records`);
  console.log('\n✅ What Changed:');
  console.log('  - Database/Account now reference Secret collection');
  console.log('  - Secrets still use vault items (no Secrets Manager needed yet)');
  console.log('  - Old fields (secretRefs, vaultId) kept for rollback safety');
  console.log('\n🧪 Test Now:');
  console.log('  1. Test MyTick API with new Secret abstraction');
  console.log('  2. Test backup Lambda (should work with current setup)');
  console.log('  3. Verify all secrets are accessible');
  console.log('\n📅 PHASE 2 (Later):');
  console.log('  1. Create secrets in Bitwarden Secrets Manager');
  console.log('  2. Update Secret.providerSecretId to Secrets Manager IDs');
  console.log('  3. Lambda automatically uses Secrets Manager (no code changes!)');

  await mongoose.disconnect();
}

// Run migration
if (require.main === module) {
  migrateVaultToSecrets().catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });
}

export default migrateVaultToSecrets;
