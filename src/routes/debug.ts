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
    // Calculate average response time from recent requests
    const completedRequests = appState.debugState.recentRequests.filter(
      (req) => req.status === 'completed' && req.timeMs !== undefined
    );

    const avgResponseTime =
      completedRequests.length > 0
        ? completedRequests.reduce((sum, req) => sum + (req.timeMs || 0), 0) /
          completedRequests.length
        : 0;

    // Calculate error rate
    const errorRate =
      appState.debugState.totalRequests > 0
        ? (appState.debugState.totalErrors / appState.debugState.totalRequests) * 100
        : 0;

    // Get min, max, median response times
    const responseTimes = completedRequests.map((req) => req.timeMs || 0).sort((a, b) => a - b);
    const minResponseTime = responseTimes.length > 0 ? responseTimes[0] : 0;
    const maxResponseTime =
      responseTimes.length > 0 ? responseTimes[responseTimes.length - 1] : 0;
    const medianResponseTime =
      responseTimes.length > 0
        ? responseTimes[Math.floor(responseTimes.length / 2)]
        : 0;

    // Calculate token throughput metrics
    const requestsWithTokens = completedRequests.filter(
      (req) => req.tokenUsage?.totalTokens && req.timeMs && req.timeMs > 0
    );

    // Calculate tokens per second for each request, then average
    const tokensPerSecArray = requestsWithTokens.map((req) => {
      const timeSeconds = (req.timeMs || 0) / 1000;
      return timeSeconds > 0 ? (req.tokenUsage?.totalTokens || 0) / timeSeconds : 0;
    });

    const avgTokensPerSec =
      tokensPerSecArray.length > 0
        ? tokensPerSecArray.reduce((sum, val) => sum + val, 0) / tokensPerSecArray.length
        : 0;

    // Calculate token statistics
    const totalTokensProcessed = requestsWithTokens.reduce(
      (sum, req) => sum + (req.tokenUsage?.totalTokens || 0),
      0
    );

    const totalPromptTokens = requestsWithTokens.reduce(
      (sum, req) => sum + (req.tokenUsage?.promptTokens || 0),
      0
    );

    const totalCompletionTokens = requestsWithTokens.reduce(
      (sum, req) => sum + (req.tokenUsage?.completionTokens || 0),
      0
    );

    res.json({
      modelInfo: {
        modelKey: appState.activeModel.modelKey,
        instanceId: appState.activeModel.instanceId,
        defaultInference: appState.activeModel.defaultInference,
      },
      performance: {
        totalRequests: appState.debugState.totalRequests,
        totalErrors: appState.debugState.totalErrors,
        errorRate: Math.round(errorRate * 100) / 100, // Round to 2 decimal places
        recentRequestCount: appState.debugState.recentRequests.length,
        completedRequestCount: completedRequests.length,
        avgResponseTimeMs: Math.round(avgResponseTime * 100) / 100,
        minResponseTimeMs: minResponseTime,
        maxResponseTimeMs: maxResponseTime,
        medianResponseTimeMs: medianResponseTime,
        avgTokensPerSec: Math.round(avgTokensPerSec * 100) / 100,
        totalTokensProcessed,
        requestsWithTokenData: requestsWithTokens.length,
        tokenStats: requestsWithTokens.length > 0 ? {
          totalPromptTokens,
          totalCompletionTokens,
          avgPromptTokens: Math.round((totalPromptTokens / requestsWithTokens.length) * 100) / 100,
          avgCompletionTokens: Math.round((totalCompletionTokens / requestsWithTokens.length) * 100) / 100,
        } : undefined,
      },
      recentActivity: {
        last10Requests: appState.debugState.recentRequests.slice(-10).map((req) => ({
          requestId: req.requestId,
          status: req.status,
          timeMs: req.timeMs,
          timestamp: req.timestamp,
        })),
      },
      system: {
        uptime: process.uptime(),
        uptimeFormatted: formatUptime(process.uptime()),
        memoryUsage: {
          rss: Math.round((process.memoryUsage().rss / 1024 / 1024) * 100) / 100, // MB
          heapTotal:
            Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100,
          heapUsed:
            Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
          external:
            Math.round((process.memoryUsage().external / 1024 / 1024) * 100) / 100,
        },
        memoryUsageRaw: process.memoryUsage(),
        nodeVersion: process.version,
        platform: process.platform,
      },
      currentOperation: appState.debugState.currentOperation,
    });
  });

  return router;
}

/**
 * Format uptime in human-readable format
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(' ');
}
