import { Router, Response } from 'express';
import { envFileRepo, envVarRepo, secretRepo } from '../repositories';
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
 * /env-reconstruct:
 *   get:
 *     tags: [EnvReconstruct]
 *     summary: Reconstruct all env files for the authenticated user
 *     description: Assembles the full .env content for each file. Direct secrets are decrypted; vault secrets use a placeholder format.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of reconstructed env files
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/EnvReconstructResult'
 */
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const files = await envFileRepo.findByUser(req.userId!);
  const result: { repoId: string; envFileId: string; path: string; content: string }[] = [];

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
      repoId: file.repoId,
      envFileId: file.id,
      path: file.path,
      content: lines.join('\n'),
    });
  }

  res.json(result);
}));

/**
 * @openapi
 * /env-reconstruct/{id}:
 *   get:
 *     tags: [EnvReconstruct]
 *     summary: Reconstruct a single env file
 *     description: Assembles the full .env content for a specific file. Direct secrets are decrypted; vault secrets use a placeholder format.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: EnvFile ID
 *     responses:
 *       200:
 *         description: Reconstructed env file content
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvReconstructResult'
 *       404:
 *         description: Env file not found
 */
router.get('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const file = await envFileRepo.findById(req.params.id as string, req.userId);
  if (!file) return res.status(404).json({ error: 'EnvFile not found' });

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

  res.json({ repoId: file.repoId, envFileId: file.id, path: file.path, content: lines.join('\n') });
}));

export default router;
