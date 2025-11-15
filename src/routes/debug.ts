import { Router, Request, Response } from 'express';
import logger from '../config/logger';
import { AppState } from '../types/models';
import { getDebugEventEmitter, DebugEventData } from '../utils/eventBroadcaster';

export function createDebugRouter(appState: AppState): Router {
  const router = Router();
  const debugEventEmitter = getDebugEventEmitter();

  /**
   * GET /debug/stream - Server-Sent Events stream for real-time debugging
   */
  router.get('/stream', (req: Request, res: Response): void => {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    logger.info('Client connected to debug stream', { ip: req.ip });

    // Send initial connection event
    res.write(
      `event: connected\ndata: ${JSON.stringify({
        timestamp: new Date().toISOString(),
        message: 'Debug stream connected',
      })}\n\n`
    );

    // Event listener for broadcasting
    const eventListener = (event: DebugEventData): void => {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
    };

    debugEventEmitter.on('debug-event', eventListener);

    // Keep-alive ping every 30 seconds
    const keepAliveInterval = setInterval(() => {
      res.write(': keep-alive\n\n');
    }, 30000);

    // Cleanup on client disconnect
    req.on('close', () => {
      debugEventEmitter.off('debug-event', eventListener);
      clearInterval(keepAliveInterval);
      logger.info('Client disconnected from debug stream', { ip: req.ip });
    });
  });

  /**
   * GET /debug/status - Current debug status snapshot
   */
  router.get('/status', (_req: Request, res: Response): void => {
    res.json({
      status: appState.debugState.status,
      currentOperation: appState.debugState.currentOperation,
      activeModel: appState.activeModel,
      recentRequests: appState.debugState.recentRequests.slice(-10), // Last 10
      totalRequests: appState.debugState.totalRequests,
      totalErrors: appState.debugState.totalErrors,
    });
  });

  /**
   * GET /debug/metrics - Performance metrics
   */
  router.get('/metrics', (_req: Request, res: Response): void => {
    res.json({
      modelInfo: {
        modelKey: appState.activeModel.modelKey,
        instanceId: appState.activeModel.instanceId,
      },
      performance: {
        totalRequests: appState.debugState.totalRequests,
        totalErrors: appState.debugState.totalErrors,
        recentRequestCount: appState.debugState.recentRequests.length,
      },
      system: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
      },
    });
  });

  return router;
}
