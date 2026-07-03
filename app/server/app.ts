import express, { NextFunction, Request, RequestHandler } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';

import compression from 'compression';
import chatRoutes from './routes/chat';
import { logger } from './services/logging';
// Remove eager imports - these will be loaded lazily when needed
// import './services/firebase';
import 'express-async-errors';
// Import API routes directly - lazy loading is handled inside the routes
import apiRoutes from './routes/api';
import { errorHandler } from './middleware/error-handler';

export function createApp() {
  const app = express();

  // Health check endpoint for ALB (must be before other middleware)
  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // CORS — allow credentials (httpOnly refresh token cookies)
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3011';
  app.use(
    cors({
      origin: [
        clientUrl,
        'http://localhost:3011',
        'http://localhost:5173',
        'https://app.1703media.com',
        'https://app-uat.1703media.com',
        'https://app-test.1703media.com',
      ].filter(Boolean),
      credentials: true,
    })
  );

  // Parse cookies (needed for httpOnly refresh token)
  app.use(cookieParser());

  // Mount chat route BEFORE compression to enable real-time SSE streaming
  // Chat uses Server-Sent Events which must not be buffered
  app.use('/api/chat', bodyParser.json(), chatRoutes);

  // Configure compression for all other routes
  app.use(compression() as unknown as RequestHandler);
  app.use(
    bodyParser.urlencoded({
      extended: true,
      limit: '100mb'
    })
  );

  app.use(
    bodyParser.json({
      limit: '100mb'
    })
  );

  // Use API routes directly - lazy loading happens inside the routes
  app.use('/api', apiRoutes);

  // Apply error handling middleware last
  app.use(errorHandler);

  // Static file serving (self-hosted mode)
  app.get('/', (req, res) => {
    res.sendFile('/index.html', { root: path.join(__dirname, 'dist') });
  });

  app.use('/', express.static(path.join(__dirname, 'dist'), { maxAge: 86400000 }));
  app.use('/*', function (req, res) {
    res.sendFile('/index.html', { root: path.join(__dirname, 'dist') });
  });

  return app;
}
