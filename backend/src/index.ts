import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import app from './app';
import { validateEnv } from './utils/validateEnv';

dotenv.config();
validateEnv();

// Rate limiting (not in app.ts so tests aren't rate-limited)
app.use(rateLimit({ windowMs: 60_000, max: 100, standardHeaders: true, legacyHeaders: false }));

const PORT = process.env.PORT || 4000;

mongoose.connect(process.env.MONGODB_URI!, { autoIndex: false })
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => console.error('MongoDB connection error:', err));
