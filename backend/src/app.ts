import express from 'express';
import cors from 'cors';
import { logger } from './utils/logger';
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

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/domains', domainRoutes);
app.use('/api/context', contextRoutes);
app.use('/api/databases', databaseRoutes);
app.use('/api/secrets', secretRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.get('/api/version', (_req, res) => res.json({ version: '1.1.0' }));
app.get('/api/health', async (_req, res) => {
  const engine = process.env.DB_ENGINE || 'neo4j';
  if (engine === 'neo4j') {
    try {
      const { getDriver } = await import('./neo4j');
      await getDriver().verifyConnectivity();
      res.json({ status: 'ok', engine: 'neo4j', db: true });
    } catch {
      res.status(503).json({ status: 'unhealthy', engine: 'neo4j', db: false });
    }
  } else {
    const mongoose = await import('mongoose');
    const dbOk = mongoose.default.connection.readyState === 1;
    res.status(dbOk ? 200 : 503).json({ status: dbOk ? 'ok' : 'unhealthy', engine: 'mongodb', db: dbOk });
  }
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err, stack: err.stack }, 'Unhandled error');
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

export default app;
