import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { logger } from './utils/logger';
import authRoutes from './routes/auth';
import taskRoutes from './routes/tasks';
import groupRoutes from './routes/groups';

const app = express();
app.use(cors());
app.use(express.json());

// Swagger docs — dev only
if (process.env.NODE_ENV !== 'production') {
  import('./swagger').then(({ default: spec }) => {
    import('swagger-ui-express').then(swaggerUi => {
      app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec));
      logger.info('Swagger docs available at /api/docs');
    });
  });
}

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info({ method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - start }, 'request');
  });
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/groups', groupRoutes);
app.get('/api/version', (_req, res) => res.json({ version: '1.1.0' }));
app.get('/api/health', async (_req, res) => {
  const dbOk = mongoose.connection.readyState === 1;
  res.status(dbOk ? 200 : 503).json({ status: dbOk ? 'ok' : 'unhealthy', db: dbOk });
});

export default app;
