import { Router, Response } from 'express';
import { envFileRepo, envVarRepo, secretRepo, repoRepo } from '../repositories';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { decrypt } from '../services/encryption';

const router = Router();
router.use(auth);

async function resolveSecretValue(secretId: string): Promise<string> {
  const secret = await secretRepo.findById(secretId);
  if (!secret) return '';
  if (secret.provider === 'direct') {
    return decrypt(secret.secretValue);
  }
  return `[${secret.provider}:${secret.name}]`;
}

/**
 * @openapi
 * /repos/{repoId}/env-files/raw:
 *   get:
 *     tags: [Repos]
 *     summary: Get assembled .env file content for a repo
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: repoId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Assembled env files
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 files:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       envFileId:
 *                         type: string
 *                       path:
 *                         type: string
 *                       content:
 *                         type: string
 *       404:
 *         description: Repo not found
 */
router.get('/:repoId/env-files/raw', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { repoId } = req.params;
  const repo = await repoRepo.findById(repoId as string, req.userId);
  if (!repo) return res.status(404).json({ error: 'Repo not found' });

  const files = await envFileRepo.findByRepo(repoId as string, req.userId!);
  const result: { envFileId: string; path: string; content: string }[] = [];

  for (const file of files) {
    const vars = await envVarRepo.findByEnvFile(file.id, req.userId!);
    const lines: string[] = [];

    for (const v of vars.sort((a, b) => a.order - b.order)) {
      if (v.comment) lines.push(`# ${v.comment}`);

      let value = '';
      if (v.isSecret && v.secretId) {
        value = await resolveSecretValue(v.secretId);
      } else {
        value = v.value || '';
      }
      lines.push(`${v.key}=${value}`);
    }

    result.push({
      envFileId: file.id,
      path: file.path,
      content: lines.join('\n'),
    });
  }

  res.json({ files: result });
}));

export default router;
