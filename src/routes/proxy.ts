import { Router, Request, Response, NextFunction } from 'express';
import axios, { AxiosResponse } from 'axios';
import logger from '../config/logger';
import { settings } from '../config/settings';
import { AppState } from '../types/models';
import { broadcastDebugEvent } from '../utils/eventBroadcaster';

export function createProxyRouter(appState: AppState): Router {
  const router = Router();

  /**
   * Proxy all /v1/* requests to LM Studio
   * Using regex pattern to match any path starting with /v1/
   */
  router.all(/^\/v1\/.*/, async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    try {
      // Get the full path after /v1
      const targetPath = req.path;
      const targetUrl = `${settings.lmStudioBaseUrl}${targetPath}`;

      logger.info('Proxying request to LM Studio', {
        method: req.method,
        path: targetPath,
        requestId,
      });

      // Broadcast inference start event
      broadcastDebugEvent('inference_start', {
        requestId,
        method: req.method,
        path: targetPath,
      });

      // Clone and modify request body if needed
      let requestBody = req.body;

      // Auto-inject active model and default inference params for completion requests
      if (
        (targetPath.includes('/chat/completions') || targetPath.includes('/completions')) &&
        req.method === 'POST'
      ) {
        requestBody = { ...req.body };

        // Inject model if not specified
        if (!requestBody.model && appState.activeModel.modelKey) {
          requestBody.model = appState.activeModel.modelKey;
          logger.debug('Injected active model', { model: requestBody.model });
        }

        // Inject default inference parameters
        const defaults = appState.activeModel.defaultInference;
        if (defaults.temperature !== undefined && requestBody.temperature === undefined) {
          requestBody.temperature = defaults.temperature;
        }
        if (defaults.maxTokens !== undefined && requestBody.max_tokens === undefined) {
          requestBody.max_tokens = defaults.maxTokens;
        }
        if (defaults.topP !== undefined && requestBody.top_p === undefined) {
          requestBody.top_p = defaults.topP;
        }
        if (defaults.topK !== undefined && requestBody.top_k === undefined) {
          requestBody.top_k = defaults.topK;
        }
        if (defaults.repeatPenalty !== undefined && requestBody.repeat_penalty === undefined) {
          requestBody.repeat_penalty = defaults.repeatPenalty;
        }
        if (defaults.stopStrings !== undefined && requestBody.stop === undefined) {
          requestBody.stop = defaults.stopStrings;
        }
        if (defaults.stream !== undefined && requestBody.stream === undefined) {
          requestBody.stream = defaults.stream;
        }
      }

      // Forward request to LM Studio
      const response: AxiosResponse = await axios({
        method: req.method,
        url: targetUrl,
        headers: {
          ...req.headers,
          host: new URL(settings.lmStudioBaseUrl).host,
          // Remove gateway-specific headers
          'x-api-key': undefined,
        },
        data: requestBody,
        params: req.query,
        responseType: requestBody.stream ? 'stream' : 'json',
        timeout: 120000, // 2 minutes for long-running requests
      });

      // Update debug state
      appState.debugState.totalRequests++;
      appState.debugState.recentRequests.push({
        requestId,
        status: 'completed',
        timeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      // Keep only last 100 requests
      if (appState.debugState.recentRequests.length > 100) {
        appState.debugState.recentRequests = appState.debugState.recentRequests.slice(-100);
      }

      // Broadcast inference complete event
      broadcastDebugEvent('inference_complete', {
        requestId,
        totalTimeMs: Date.now() - startTime,
      });

      // Handle streaming response
      if (requestBody.stream && response.data.pipe) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        response.data.pipe(res);
      } else {
        // Regular JSON response
        res.status(response.status).json(response.data);
      }
    } catch (error) {
      appState.debugState.totalErrors++;

      broadcastDebugEvent('error', {
        requestId,
        error: axios.isAxiosError(error) ? error.message : 'Unknown error',
        totalTimeMs: Date.now() - startTime,
      });

      logger.error('Proxy request failed', {
        requestId,
        error: axios.isAxiosError(error) ? error.message : error,
      });

      if (axios.isAxiosError(error)) {
        const status = error.response?.status || 503;
        const data = error.response?.data || { error: 'LM Studio API error' };
        res.status(status).json(data);
      } else {
        next(error);
      }
    }
  });

  return router;
}
