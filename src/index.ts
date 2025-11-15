import express, { Request, Response, NextFunction, Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { z } from 'zod';
import logger from './config/logger';
import { settings } from './config/settings';
import { ipAllowlistMiddleware } from './middleware/ipAllowlist';
import { apiKeyMiddleware } from './middleware/apiKey';
import { createAdminRouter } from './routes/admin';
import { createDebugRouter } from './routes/debug';
import { createProxyRouter } from './routes/proxy';
import { AppState } from './types/models';

/**
 * Create and configure Express application
 */
export function createApp(): Express {
  const app = express();

  // Initialize application state
  const appState: AppState = {
    activeModel: {
      modelKey: null,
      instanceId: null,
      defaultInference: {},
    },
    debugState: {
      status: 'idle',
      currentOperation: null,
      recentRequests: [],
      totalRequests: 0,
      totalErrors: 0,
    },
  };

  // Attach state to app locals
  app.locals.appState = appState;

  // Security middleware
  app.use(helmet());
  app.use(cors());

  // Body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Custom middleware
  app.use(ipAllowlistMiddleware);
  app.use(apiKeyMiddleware);

  // Health check endpoint (before routers)
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Register routers
  app.use('/admin', createAdminRouter(appState));
  app.use('/debug', createDebugRouter(appState));
  app.use(createProxyRouter(appState));

  // 404 handler
  app.use((req: Request, res: Response) => {
    logger.warn('Route not found', { path: req.path, method: req.method });
    res.status(404).json({ error: 'Not found' });
  });

  // Global error handler
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    // Handle Zod validation errors
    if (err instanceof z.ZodError) {
      logger.warn('Validation error', {
        path: req.path,
        errors: err.issues,
      });
      res.status(400).json({
        error: 'Validation failed',
        details: err.issues,
      });
      return;
    }

    // Handle other errors
    logger.error('Unhandled error', {
      path: req.path,
      error: err.message,
      stack: err.stack,
    });

    res.status(500).json({
      error: 'Internal server error',
      ...(settings.nodeEnv === 'development' && { details: err.message }),
    });
  });

  return app;
}

/**
 * Start the server
 */
export function startServer(): void {
  const app = createApp();

  const server = app.listen(settings.gatewayPort, settings.gatewayHost, () => {
    logger.info('='.repeat(60));
    logger.info('LM Studio LAN Gateway (TypeScript) v1.0.0');
    logger.info('='.repeat(60));
    logger.info(`LM Studio URL: ${settings.lmStudioBaseUrl}`);
    logger.info(`Gateway: http://${settings.gatewayHost}:${settings.gatewayPort}`);
    logger.info(`API Key Auth: ${settings.apiKeyEnabled ? 'enabled' : 'disabled'}`);
    logger.info(`IP Allowlist: ${settings.ipAllowlistItems.join(', ') || '*'}`);
    logger.info(`Environment: ${settings.nodeEnv}`);
    logger.info(`Log Level: ${settings.logLevel}`);
    logger.info('='.repeat(60));
    logger.info('Gateway started successfully');
  });

  // Graceful shutdown
  const shutdown = (signal: string): void => {
    logger.info(`${signal} signal received: closing HTTP server`);
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Start server if this is the main module
if (require.main === module) {
  startServer();
}
