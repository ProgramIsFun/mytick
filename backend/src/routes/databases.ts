import { Router, Response } from 'express';
import Database from '../models/Database';
import BackupHistory from '../models/BackupHistory';
import { auth, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(auth);

/**
 * @swagger
 * /databases:
 *   get:
 *     summary: List all databases
 *     tags: [Databases]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: type, schema: { type: string } }
 *       - { in: query, name: backupEnabled, schema: { type: boolean } }
 *     responses:
 *       200: { description: List of databases }
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { search, type, backupEnabled } = req.query;
    const filter: any = { userId: req.userId };
    
    if (search) filter.name = { $regex: search, $options: 'i' };
    if (type) filter.type = type;
    if (backupEnabled !== undefined) filter.backupEnabled = backupEnabled === 'true';
    
    const databases = await Database.find(filter)
      .populate('accountId', 'name provider')
      .sort({ createdAt: -1 });
    
    res.json(databases);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @swagger
 * /databases/backupable:
 *   get:
 *     summary: Get all databases that need backup (for backup scripts)
 *     tags: [Databases]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of databases with backup enabled }
 */
router.get('/backupable', async (req: AuthRequest, res: Response) => {
  try {
    const databases = await Database.find({
      userId: req.userId,
      backupEnabled: true,
    })
    .select('name type secretRefs secretId backupRetentionDays backupFrequency lastBackupAt')
    .populate('secretId'); // Populate Secret reference
    
    res.json(databases.map(db => {
      const secret = db.secretId as any;
      
      return {
        id: db._id,
        name: db.name,
        type: db.type,
        
        // New: Secret abstraction (if secretId exists)
        secret: secret ? {
          provider: secret.provider,
          providerSecretId: secret.providerSecretId,
        } : null,
        
        // Legacy: For backward compatibility
        secretRefs: db.secretRefs,
        
        retentionDays: db.backupRetentionDays,
        frequency: db.backupFrequency,
        lastBackupAt: db.lastBackupAt,
      };
    }));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @swagger
 * /databases/{id}:
 *   get:
 *     summary: Get a single database
 *     tags: [Databases]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Database details }
 *       404: { description: Not found }
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const database = await Database.findOne({
      _id: req.params.id,
      userId: req.userId,
    }).populate('accountId', 'name provider');
    
    if (!database) return res.status(404).json({ error: 'Not found' });
    res.json(database);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @swagger
 * /databases/{id}/backup-completed:
 *   post:
 *     summary: Record backup completion (called by Lambda after EACH database)
 *     description: |
 *       Lambda reports results immediately after each database backup completes.
 *       
 *       **Design Decision: Per-Database Reporting (not batched)**
 *       - Provides real-time progress tracking
 *       - Protects against Lambda timeout (15min limit)
 *       - Ensures partial progress saved if Lambda crashes
 *       - Better debugging with exact timestamps per database
 *       
 *       Trade-off: More API calls, but better production resilience.
 *     tags: [Databases]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status, startedAt, completedAt, s3Path, s3Bucket]
 *             properties:
 *               status: { type: string, enum: [success, failed, partial] }
 *               startedAt: { type: string, format: date-time }
 *               completedAt: { type: string, format: date-time }
 *               sizeBytes: { type: number }
 *               s3Path: { type: string }
 *               s3Bucket: { type: string }
 *               errorMessage: { type: string }
 *               metadata: { type: object }
 *               triggeredBy: { type: string, enum: [scheduled, manual] }
 *               lambdaRequestId: { type: string }
 *     responses:
 *       200: { description: Backup recorded }
 *       404: { description: Database not found }
 */
router.post('/:id/backup-completed', async (req: AuthRequest, res: Response) => {
  try {
    const database = await Database.findById(req.params.id);
    if (!database) return res.status(404).json({ error: 'Database not found' });

    const { status, startedAt, completedAt, sizeBytes, s3Path, s3Bucket, errorMessage, metadata, triggeredBy, lambdaRequestId } = req.body;

    // Calculate duration
    const start = new Date(startedAt);
    const end = new Date(completedAt);
    const durationMs = end.getTime() - start.getTime();

    // Create backup history record
    const backupHistory = await BackupHistory.create({
      databaseId: database._id,
      userId: database.userId,
      status,
      startedAt: start,
      completedAt: end,
      durationMs,
      sizeBytes: sizeBytes || 0,
      s3Path,
      s3Bucket,
      errorMessage,
      metadata: metadata || {},
      triggeredBy: triggeredBy || 'scheduled',
      lambdaRequestId,
    });

    // Update database lastBackupAt only on success
    if (status === 'success') {
      await Database.findByIdAndUpdate(database._id, {
        lastBackupAt: end,
        $inc: { __v: 1 },
      });
    }

    res.json({
      message: 'Backup recorded',
      backupId: backupHistory._id,
      databaseId: database._id,
      status,
    });
  } catch (err) {
    console.error('Error recording backup:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @swagger
 * /databases:
 *   post:
 *     summary: Create a database entry
 *     tags: [Databases]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, type]
 *             properties:
 *               name: { type: string }
 *               type: { type: string, enum: [mongodb, postgres, mysql, redis, sqlite, other] }
 *               secretRefs: { type: array, items: { type: object, properties: { provider: { type: string }, itemId: { type: string }, field: { type: string } } } }
 *               host: { type: string }
 *               port: { type: number }
 *               database: { type: string }
 *               backupEnabled: { type: boolean }
 *               backupRetentionDays: { type: number }
 *               backupFrequency: { type: string, enum: [daily, weekly] }
 *               accountId: { type: string }
 *               tags: { type: array, items: { type: string } }
 *               notes: { type: string }
 *     responses:
 *       201: { description: Database created }
 *       400: { description: Validation error }
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, type, secretRefs, host, port, database, backupEnabled, backupRetentionDays, backupFrequency, accountId, tags, notes } = req.body;
    
    if (!name || !type) {
      return res.status(400).json({ error: 'name and type are required' });
    }
    
    const db = await Database.create({
      userId: req.userId,
      name,
      type,
      secretRefs: secretRefs || [],
      host: host || '',
      port: port || null,
      database: database || '',
      backupEnabled: backupEnabled || false,
      backupRetentionDays: backupRetentionDays || 30,
      backupFrequency: backupFrequency || 'daily',
      accountId: accountId || null,
      tags: tags || [],
      notes: notes || '',
    });
    
    res.status(201).json(db);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @swagger
 * /databases/{id}:
 *   patch:
 *     summary: Update a database
 *     tags: [Databases]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Database updated }
 *       404: { description: Not found }
 */
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const database = await Database.findOne({
      _id: req.params.id,
      userId: req.userId,
    });
    
    if (!database) return res.status(404).json({ error: 'Not found' });
    
    const allowed = ['name', 'type', 'secretRefs', 'host', 'port', 'database', 'backupEnabled', 'backupRetentionDays', 'backupFrequency', 'accountId', 'tags', 'notes'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) (database as any)[key] = req.body[key];
    }
    
    await database.save();
    res.json(database);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @swagger
 * /databases/{id}:
 *   delete:
 *     summary: Delete a database
 *     tags: [Databases]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Deleted }
 *       404: { description: Not found }
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const database = await Database.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
    });
    
    if (!database) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @swagger
 * /databases/{id}/backup-success:
 *   post:
 *     summary: Mark database as successfully backed up (called by backup script)
 *     tags: [Databases]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Updated }
 */
router.post('/:id/backup-success', async (req: AuthRequest, res: Response) => {
  try {
    const database = await Database.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { lastBackupAt: new Date() },
      { new: true }
    );
    
    if (!database) return res.status(404).json({ error: 'Not found' });
    res.json(database);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @swagger
 * /databases/{id}/backup-history:
 *   get:
 *     summary: Get backup history for a database
 *     tags: [Databases]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *       - { in: query, name: limit, schema: { type: number, default: 50 } }
 *       - { in: query, name: status, schema: { type: string, enum: [success, failed, partial] } }
 *     responses:
 *       200: { description: Backup history list }
 *       404: { description: Database not found }
 */
router.get('/:id/backup-history', async (req: AuthRequest, res: Response) => {
  try {
    const database = await Database.findById(req.params.id);
    if (!database) return res.status(404).json({ error: 'Database not found' });

    // Verify ownership
    if (database.userId.toString() !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const filter: any = { databaseId: database._id };
    
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const history = await BackupHistory.find(filter)
      .sort({ completedAt: -1 })
      .limit(limit)
      .lean();

    res.json(history);
  } catch (err) {
    console.error('Error fetching backup history:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
