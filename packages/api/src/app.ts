import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';

// ── Create Express Application ──────────────────────

const app = express();

// ── Global Middleware ────────────────────────────────

// Security headers
app.use(helmet());

// CORS
const allowedOrigins = (config.corsOrigin || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., mobile apps, curl, server-to-server, Render health checks)
      if (!origin) return callback(null, true);
      const normalizedOrigin = origin.trim().replace(/\/+$/, '');
      const isAllowed = allowedOrigins.some((allowed) => {
        if (allowed === '*' || allowed === normalizedOrigin) return true;
        if (`https://${allowed}` === normalizedOrigin || `http://${allowed}` === normalizedOrigin) return true;
        return false;
      });
      if (isAllowed) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  }),
);

// Request logging
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health Check ────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── API Routes ──────────────────────────────────────

app.use('/api', routes);

// ── 404 Handler ─────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found.' });
});

// ── Global Error Handler ────────────────────────────

app.use(errorHandler);

export default app;
