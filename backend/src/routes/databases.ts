import { Router, Response } from 'express';
import { databaseRepo, backupHistoryRepo } from '../repositories';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { notFound, badRequest, parseBackupHistoryLimit, forbidden } from '../utils/routeHelpers';

const router = Router();

router.use(auth);

router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { search, type, backupEnabled } = req.query;
  const dbs = await databaseRepo.findByUser(req.userId!, {
    search: search as string,
    type: type as string,
    backupEnabled: backupEnabled !== undefined ? backupEnabled === 'true' : undefined,
  });
  res.json(dbs);
}));

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

router.get('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const database = await databaseRepo.findById(req.params.id as string, req.userId);
  if (!database) return notFound(res);
  res.json(database);
}));

router.post('/:id/backup-completed', asyncHandler(async (req: AuthRequest, res: Response) => {
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

router.post('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, type, secretId, host, port, database, backupEnabled, backupRetentionDays, backupFrequency, accountId, tags, notes } = req.body;
  if (!name || !type) return badRequest(res, 'name and type are required');
  const db = await databaseRepo.create({
    userId: req.userId, name, type, secretId: secretId || null,
    host: host || '', port: port || null, databaseName: database || '',
    backupEnabled: backupEnabled || false, backupRetentionDays: backupRetentionDays || 30,
    backupFrequency: backupFrequency || 'daily', accountId: accountId || null,
    tags: tags || [], notes: notes || '',
  });
  res.status(201).json(db);
}));

router.patch('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const database = await databaseRepo.update(req.params.id as string, req.body);
  if (!database) return notFound(res);
  res.json(database);
}));

router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const deleted = await databaseRepo.delete(req.params.id as string, req.userId!);
  if (!deleted) return notFound(res);
  res.json({ message: 'Deleted' });
}));

router.post('/:id/backup-success', asyncHandler(async (req: AuthRequest, res: Response) => {
  const database = await databaseRepo.markBackupSuccess(req.params.id as string);
  if (!database) return notFound(res);
  res.json(database);
}));

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
