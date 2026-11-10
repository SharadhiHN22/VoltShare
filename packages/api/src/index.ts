import dotenv from 'dotenv';
import path from 'path';

// Load environment variables before any other imports (supports running from root or workspace dir)
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import app from './app';
import { config } from './config';

const start = async () => {
  try {
    app.listen(config.port, () => {
      console.log(`
  ⚡ VoltShare API Server
  ────────────────────────────
  Environment : ${config.nodeEnv}
  Port        : ${config.port}
  Health      : http://localhost:${config.port}/health
  API Base    : http://localhost:${config.port}/api
  ────────────────────────────
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

start();
