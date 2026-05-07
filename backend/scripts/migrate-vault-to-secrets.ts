/**
 * Migration Script: Vault Items → Secret Collection
 * 
 * This script:
 * 1. Scans Database and Account collections for vault references
 * 2. Creates Secret records for each unique vault item
 * 3. Updates Database/Account records to reference Secret IDs
 * 4. Tracks usage in Secret.usedBy[]
 */

import mongoose from 'mongoose';
import Secret from '../models/Secret';
import Database from '../models/Database';
import Account from '../models/Account';

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
      description: `Migrated from vault item ${vaultId}`,
      provider: 'bitwarden',
      providerSecretId: vaultId, // Note: This is still vault item ID, needs manual update to Secret Manager ID
      type,
      tags: ['migrated', 'vault-legacy'],
      usedBy: item.usedBy
    });

    secretMapping.set(vaultId, secret._id);
    console.log(`    ✅ Created secret: ${secret._id}\n`);
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

  console.log('\n✅ Migration complete!\n');
  console.log('📝 Summary:');
  console.log(`  - Created ${secretMapping.size} Secret records`);
  console.log(`  - Updated ${databases.length} Database records`);
  console.log(`  - Updated ${accounts.length} Account records`);
  console.log('\n⚠️  IMPORTANT NEXT STEPS:');
  console.log('  1. Create these secrets in Bitwarden Secrets Manager');
  console.log('  2. Update Secret.providerSecretId with new Secrets Manager IDs');
  console.log('  3. Update Database/Account schemas to add secretId field');
  console.log('  4. Test backup Lambda with new Secret abstraction');

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
