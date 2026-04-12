import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import taskRoutes from './routes/tasks';
import groupRoutes from './routes/groups';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Global rate limit: 100 requests per minute per IP
app.use(rateLimit({ windowMs: 60_000, max: 100, standardHeaders: true, legacyHeaders: false }));

// Strict rate limit on auth routes: 10 requests per minute per IP
app.use('/api/auth', rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false }));

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/groups', groupRoutes);
app.get('/api/version', (_req, res) => res.json({ version: '1.1.0' }));

const PORT = process.env.PORT || 4000;

mongoose.connect(process.env.MONGODB_URI!, { autoIndex: false })
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => console.error('MongoDB connection error:', err));
