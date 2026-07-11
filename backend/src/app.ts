import express from 'express';
import cors from 'cors';
import { logger } from './utils/logger';
import { globalLimiter, authLimiter } from './middleware/rateLimiter';
import authRoutes from './routes/auth';
import taskRoutes from './routes/tasks';
import groupRoutes from './routes/groups';
import accountRoutes from './routes/accounts';
import domainRoutes from './routes/domains';
import contextRoutes from './routes/context';
import databaseRoutes from './routes/databases';
import secretRoutes from './routes/secrets';
import subscriptionRoutes from './routes/subscriptions';
import knowledgeRoutes from './routes/knowledge';
import repoRoutes from './routes/repos';

const app = express();
app.use(cors());
app.use(express.json());

if (process.env.NODE_ENV !== 'production') {
  import('./swagger').then(({ default: spec }) => {
    import('swagger-ui-express').then(swaggerUi => {
      app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec));
      logger.info('Swagger docs available at /api/docs');
    });
  });
}

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const fullPath = req.baseUrl + req.path;
    logger.info({ method: req.method, path: fullPath, status: res.statusCode, ms: Date.now() - start }, 'request');
  });
  next();
});

if (process.env.NODE_ENV !== 'test') {
  app.use('/api', globalLimiter);
  app.use('/api/auth', authLimiter, authRoutes);
} else {
  app.use('/api/auth', authRoutes);
}
app.use('/api/tasks', taskRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/domains', domainRoutes);
app.use('/api/context', contextRoutes);
app.use('/api/databases', databaseRoutes);
app.use('/api/secrets', secretRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/repos', repoRoutes);
app.get('/api/version', (_req, res) => res.json({ version: '1.1.0' }));
app.get('/api/health', async (_req, res) => {
  try {
    const { getDriver } = await import('./neo4j');
    await getDriver().verifyConnectivity();
    res.json({ status: 'ok', engine: 'neo4j', db: true });
  } catch {
    res.status(503).json({ status: 'unhealthy', engine: 'neo4j', db: false });
  }
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err, stack: err.stack }, 'Unhandled error');
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

export default app;
