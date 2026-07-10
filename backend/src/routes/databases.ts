import { Router, Response } from 'express';
import { databaseRepo, backupHistoryRepo } from '../repositories';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { notFound, parseBackupHistoryLimit, forbidden } from '../utils/routeHelpers';
import { validate, createDatabaseSchema, updateDatabaseSchema, backupCompletedSchema } from '../utils/validation';

const router = Router();

router.use(auth);

/**
 * @openapi
 * /databases:
 *   get:
 *     tags: [Databases]
 *     summary: List databases for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [mongodb, postgres, mysql, redis, sqlite, other]
 *       - in: query
 *         name: backupEnabled
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *     responses:
 *       200:
 *         description: List of databases
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Database'
 */
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { search, type, backupEnabled } = req.query;
  const dbs = await databaseRepo.findByUser(req.userId!, {
    search: search as string,
    type: type as string,
    backupEnabled: backupEnabled !== undefined ? backupEnabled === 'true' : undefined,
  });
  res.json(dbs);
}));

/**
 * @openapi
 * /databases/backupable:
 *   get:
 *     tags: [Databases]
 *     summary: List databases that have backup enabled
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Backupable databases
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   type:
 *                     type: string
 *                   secretId:
 *                     type: string
 *                   retentionDays:
 *                     type: integer
 *                   frequency:
 *                     type: string
 *                   lastBackupAt:
 *                     type: string
 *                     format: date-time
 *                     nullable: true
 */
router.get('/backupable', asyncHandler(async (req: AuthRequest, res: Response) => {
  const databases = await databaseRepo.findBackupable(req.userId!);
  res.json(databases.map(db => ({
    id: db.id, name: db.name, type: db.type,
    secretId: db.secretId,
    retentionDays: db.backupRetentionDays,
    frequency: db.backupFrequency,
    lastBackupAt: db.lastBackupAt,
  })));
}));

/**
 * @openapi
 * /databases/backup-history:
 *   get:
 *     tags: [Databases]
 *     summary: Get backup history across all databases
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [success, failed, partial]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Backup history list
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/BackupHistory'
 */
router.get('/backup-history', asyncHandler(async (req: AuthRequest, res: Response) => {
  const limit = parseBackupHistoryLimit(req.query);
  const filter: any = { userId: req.userId };
  if (req.query.status) filter.status = req.query.status;
  const history = await backupHistoryRepo.findByUser(req.userId!, {
    status: req.query.status as string,
    limit,
  });
  res.json(history);
}));

/**
 * @openapi
 * /databases/{id}:
 *   get:
 *     tags: [Databases]
 *     summary: Get a database by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Database details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Database'
 *       404:
 *         description: Database not found
 */
router.get('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const database = await databaseRepo.findById(req.params.id as string, req.userId);
  if (!database) return notFound(res);
  res.json(database);
}));

/**
 * @openapi
 * /databases/{id}/backup-completed:
 *   post:
 *     tags: [Databases]
 *     summary: Record a completed backup for a database
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status, startedAt, completedAt]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [success, failed, partial]
 *               startedAt:
 *                 type: string
 *                 format: date-time
 *               completedAt:
 *                 type: string
 *                 format: date-time
 *               sizeBytes:
 *                 type: integer
 *               s3Path:
 *                 type: string
 *               s3Bucket:
 *                 type: string
 *               errorMessage:
 *                 type: string
 *               metadata:
 *                 type: object
 *               triggeredBy:
 *                 type: string
 *                 default: scheduled
 *               lambdaRequestId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Backup recorded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 backupId:
 *                   type: string
 *                 databaseId:
 *                   type: string
 *                 status:
 *                   type: string
 *       404:
 *         description: Database not found
 */
router.post('/:id/backup-completed', validate(backupCompletedSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  const db = await databaseRepo.findById(req.params.id as string);
  console.log('backup-completed findById:', req.params.id, '->', db ? 'found' : 'null');
  if (!db) return notFound(res, 'Database not found');

  const { status, startedAt, completedAt, sizeBytes, s3Path, s3Bucket, errorMessage, metadata, triggeredBy, lambdaRequestId } = req.body;

  const start = new Date(startedAt);
  const end = new Date(completedAt);
  const durationMs = end.getTime() - start.getTime();

  const backupHistory = await backupHistoryRepo.create({
    databaseId: db.id,
    userId: db.userId,
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
  console.log('backupHistoryRepo.create succeeded:', backupHistory?.id);

  if (status === 'success') {
    await databaseRepo.markBackupSuccess(db.id);
  }

  res.json({
    message: 'Backup recorded',
    backupId: backupHistory.id,
    databaseId: db.id,
    status,
  });
}));

/**
 * @openapi
 * /databases:
 *   post:
 *     tags: [Databases]
 *     summary: Register a new database
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, type]
 *             properties:
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [mongodb, postgres, mysql, redis, sqlite, other]
 *               secretId:
 *                 type: string
 *               host:
 *                 type: string
 *               port:
 *                 type: integer
 *               database:
 *                 type: string
 *               backupEnabled:
 *                 type: boolean
 *                 default: false
 *               backupRetentionDays:
 *                 type: integer
 *                 default: 30
 *               backupFrequency:
 *                 type: string
 *                 enum: [hourly, 6hours, daily, weekly]
 *                 default: daily
 *               accountId:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Database created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Database'
 */
router.post('/', validate(createDatabaseSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, type, secretId, host, port, database, backupEnabled, backupRetentionDays, backupFrequency, accountId, tags, notes } = req.body;
  const db = await databaseRepo.create({
    userId: req.userId, name, type, secretId: secretId || null,
    host: host || '', port: port || null, databaseName: database || '',
    backupEnabled: backupEnabled || false, backupRetentionDays: backupRetentionDays || 30,
    backupFrequency: backupFrequency || 'daily', accountId: accountId || null,
    tags: tags || [], notes: notes || '',
  });
  res.status(201).json(db);
}));

/**
 * @openapi
 * /databases/{id}:
 *   patch:
 *     tags: [Databases]
 *     summary: Update a database
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *               secretId:
 *                 type: string
 *               host:
 *                 type: string
 *               port:
 *                 type: integer
 *               database:
 *                 type: string
 *               backupEnabled:
 *                 type: boolean
 *               backupRetentionDays:
 *                 type: integer
 *               backupFrequency:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated database
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Database'
 *       404:
 *         description: Database not found
 */
router.patch('/:id', validate(updateDatabaseSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  const database = await databaseRepo.update(req.params.id as string, req.body);
  if (!database) return notFound(res);
  res.json(database);
}));

/**
 * @openapi
 * /databases/{id}:
 *   delete:
 *     tags: [Databases]
 *     summary: Delete a database
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       404:
 *         description: Database not found
 */
router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const deleted = await databaseRepo.delete(req.params.id as string, req.userId!);
  if (!deleted) return notFound(res);
  res.json({ message: 'Deleted' });
}));

/**
 * @openapi
 * /databases/{id}/backup-success:
 *   post:
 *     tags: [Databases]
 *     summary: Mark a database backup as successful
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Updated database
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Database'
 *       404:
 *         description: Database not found
 */
router.post('/:id/backup-success', asyncHandler(async (req: AuthRequest, res: Response) => {
  const database = await databaseRepo.markBackupSuccess(req.params.id as string);
  if (!database) return notFound(res);
  res.json(database);
}));

/**
 * @openapi
 * /databases/{id}/backup-history:
 *   get:
 *     tags: [Databases]
 *     summary: Get backup history for a specific database
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [success, failed, partial]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Backup history list
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/BackupHistory'
 *       404:
 *         description: Database not found
 */
router.get('/:id/backup-history', asyncHandler(async (req: AuthRequest, res: Response) => {
  const database = await databaseRepo.findById(req.params.id as string);
  if (!database) return notFound(res, 'Database not found');
  if (database.userId !== req.userId) return forbidden(res);
  const limit = parseBackupHistoryLimit(req.query);
  const history = await backupHistoryRepo.findByDatabase(req.params.id as string, req.userId!, {
    status: req.query.status as string,
    limit,
  });
  res.json(history);
}));

export default router;
