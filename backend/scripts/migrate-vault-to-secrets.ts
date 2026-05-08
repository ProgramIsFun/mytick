/**
 * Migration Script: Vault Items → Secret Collection
 * 
 * This creates the Secret abstraction layer from existing vault references.
 * 
 * What it does:
 * 1. Scans Database and Account collections for vault references
 * 2. Creates Secret records pointing to EXISTING vault items
 * 3. Updates Database/Account to reference Secret IDs
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

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

  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mytick';
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const db = mongoose.connection.db!;
  const secretCollection = db.collection('secrets');

  // Step 1: Collect all vault items from databases
  console.log('📊 Step 1: Scanning Database collection...');
  const databases = await db.collection('databases').find({
    secretRefs: { $exists: true, $ne: [] }
  }).toArray();

  const vaultMap = new Map<string, VaultItem>();

  for (const dbDoc of databases) {
    for (const ref of dbDoc.secretRefs as any[]) {
      if (ref.provider === 'bitwarden' && ref.itemId) {
        if (!vaultMap.has(ref.itemId)) {
          vaultMap.set(ref.itemId, {
            vaultId: ref.itemId,
            usedBy: []
          });
        }
        vaultMap.get(ref.itemId)!.usedBy.push({
          collection: 'databases',
          itemId: dbDoc._id,
          itemName: dbDoc.name
        });
      }
    }
  }
  console.log(`  Found ${databases.length} databases with ${vaultMap.size} unique vault items\n`);

  // Step 2: Collect all vault items from accounts
  console.log('📊 Step 2: Scanning Account collection...');
  const accounts = await db.collection('accounts').find({
    credentials: { $exists: true, $ne: [] }
  }).toArray();

  for (const account of accounts) {
    for (const cred of account.credentials as any[]) {
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

    // Get userId from the account/database document
    const collection = item.usedBy[0].collection;
    const itemId = item.usedBy[0].itemId;
    const doc = collection === 'databases' 
      ? databases.find(d => d._id.toString() === itemId.toString())
      : accounts.find(a => a._id.toString() === itemId.toString());
    const userId = doc?.userId;

    if (!userId) {
      console.log(`  ⚠️  Skipping ${vaultId}: could not find userId`);
      continue;
    }

    const secret = await secretCollection.insertOne({
      userId,
      name,
      description: `PHASE 1: Using vault item ${vaultId}. Later migrate to Secrets Manager.`,
      provider: 'bitwarden',
      providerSecretId: vaultId,
      type,
      tags: ['phase1-migration', 'vault-item'],
      usedBy: item.usedBy,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    secretMapping.set(vaultId, secret.insertedId);
    console.log(`    ✅ Created secret: ${secret.insertedId} (vault: ${vaultId})\n`);
  }

  console.log(`✅ Created ${secretMapping.size} secret records\n`);

  // Step 4: Update Database records to reference Secret IDs
  console.log('🔄 Step 4: Updating Database records...');
  for (const dbDoc of databases) {
    for (const ref of dbDoc.secretRefs as any[]) {
      if (ref.provider === 'bitwarden' && ref.itemId) {
        const secretId = secretMapping.get(ref.itemId);
        if (secretId) {
          await db.collection('databases').updateOne(
            { _id: dbDoc._id },
            { $set: { secretId } }
          );
          console.log(`  ✅ Updated database: ${dbDoc.name}`);
        }
      }
    }
  }

  // Step 5: Update Account records to reference Secret IDs  
  console.log('\n🔄 Step 5: Updating Account records...');
  for (const account of accounts) {
    for (const cred of account.credentials as any[]) {
      if (cred.vaultId) {
        const secretId = secretMapping.get(cred.vaultId);
        if (secretId) {
          // Update the specific credential in the array using arrayFilters
          await db.collection('accounts').updateOne(
            { _id: account._id },
            { $set: { 'credentials.$[c].secretId': secretId } },
            { arrayFilters: [{ 'c.vaultId': cred.vaultId }] }
          );
          console.log(`  ✅ Updated account: ${account.name}`);
        }
      }
    }
  }

  console.log('\n✅ Migration complete!\n');
  console.log('📝 Summary:');
  console.log(`  - Created ${secretMapping.size} Secret records (pointing to vault items)`);
  console.log(`  - Updated ${databases.length} Database records`);
  console.log(`  - Updated ${accounts.length} Account records`);
  console.log('\n✅ What Changed:');
  console.log('  - Database/Account now reference Secret collection');
  console.log('  - Secrets still use vault items (no Secrets Manager needed yet)');

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
