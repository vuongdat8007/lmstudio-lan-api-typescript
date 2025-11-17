import { Router, Request, Response, NextFunction } from 'express';
import axios, { AxiosResponse } from 'axios';
import logger from '../config/logger';
import { settings } from '../config/settings';
import { AppState } from '../types/models';
import { broadcastDebugEvent } from '../utils/eventBroadcaster';

export function createProxyRouter(appState: AppState): Router {
  const router = Router();

  /**
   * Common OpenAI API endpoints that can be called with or without /v1/ prefix
   */
  const OPENAI_ENDPOINTS = [
    '/chat/completions',
    '/completions',
    '/models',
    '/embeddings',
    '/images/generations',
    '/audio/transcriptions',
    '/audio/translations',
  ];

  /**
   * Shared proxy handler logic
   * Forwards requests to LM Studio with auto-injection of model and inference params
   */
  const proxyHandler = async (
    req: Request,
    res: Response,
    next: NextFunction,
    targetPath: string,
    isShorthand: boolean = false
  ) => {
    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Declare targetUrl in outer scope for error logging
    let targetUrl = '';

    try {
      targetUrl = `${settings.lmStudioBaseUrl}${targetPath}`;

      logger.info('Proxying request to LM Studio', {
        method: req.method,
        path: targetPath,
        targetUrl,
        requestId,
        hasBody: !!req.body,
        bodyKeys: req.body ? Object.keys(req.body) : [],
        shorthand: isShorthand,
      });

      // Log when shorthand path is used
      if (isShorthand) {
        logger.debug('Shorthand path detected, auto-adding /v1/ prefix', {
          originalPath: req.path,
          targetPath,
        });
      }

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
        // Use instanceId if available (for loaded model instances), otherwise use modelKey
        if (!requestBody.model && appState.activeModel.modelKey) {
          requestBody.model = appState.activeModel.instanceId || appState.activeModel.modelKey;
          logger.debug('Injected active model', {
            model: requestBody.model,
            usingInstanceId: !!appState.activeModel.instanceId
          });
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
      const requestTimeout = requestBody?.stream ? settings.proxyStreamTimeout : settings.proxyTimeout;

      // Log detailed request information
      logger.debug('Sending request to LM Studio', {
        requestId,
        url: targetUrl,
        method: req.method,
        hasData: !!requestBody,
        requestBodyModel: requestBody?.model,
        stream: requestBody?.stream,
        timeout: requestTimeout === 0 ? 'none' : `${requestTimeout}ms`,
      });

      // Log full request body for debugging
      logger.debug('Request body details', {
        requestId,
        bodyKeys: requestBody ? Object.keys(requestBody) : [],
        bodySize: requestBody ? JSON.stringify(requestBody).length : 0,
      });

      // Prepare headers - forward all except problematic ones
      const headersToExclude = ['host', 'connection', 'x-api-key', 'transfer-encoding', 'content-length'];
      const forwardHeaders: Record<string, string | string[] | undefined> = {};

      for (const [key, value] of Object.entries(req.headers)) {
        if (!headersToExclude.includes(key.toLowerCase())) {
          forwardHeaders[key] = value;
        }
      }

      // Log headers being sent
      logger.debug('Headers to forward', {
        requestId,
        headerKeys: Object.keys(forwardHeaders),
      });

      // Log before making axios call
      logger.debug('About to make axios request', { requestId });

      const response: AxiosResponse = await axios({
        method: req.method,
        url: targetUrl,
        headers: forwardHeaders,
        data: requestBody,
        params: req.query,
        responseType: requestBody?.stream ? 'stream' : 'json',
        // Use stream timeout for streaming, regular timeout for non-streaming
        // 0 = no timeout for streams (handled by client disconnect)
        timeout: requestBody?.stream ? settings.proxyStreamTimeout : settings.proxyTimeout,
        validateStatus: () => true, // Accept all status codes to see what LM Studio returns
      });

      // Log immediately after axios returns
      logger.debug('Axios call completed', { requestId, status: response.status });

      logger.debug('Received response from LM Studio', {
        requestId,
        status: response.status,
        statusText: response.statusText,
        hasData: !!response.data,
        contentType: response.headers['content-type'],
        isStreaming: requestBody?.stream,
      });

      // Handle streaming response
      if (requestBody?.stream && response.data?.pipe) {
        logger.debug('Starting stream response', { requestId });

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Track if stream has ended to avoid duplicate updates
        let streamEnded = false;

        // Handle successful stream completion
        response.data.on('end', () => {
          if (streamEnded) return;
          streamEnded = true;

          logger.debug('Stream completed successfully', {
            requestId,
            totalTimeMs: Date.now() - startTime,
          });

          // Update debug state AFTER stream completes
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

          // Broadcast inference complete event AFTER stream finishes
          broadcastDebugEvent('inference_complete', {
            requestId,
            totalTimeMs: Date.now() - startTime,
          });
        });

        // Handle stream errors
        response.data.on('error', (err: Error) => {
          if (streamEnded) return;
          streamEnded = true;

          logger.error('Stream error', {
            requestId,
            error: err.message,
            totalTimeMs: Date.now() - startTime,
          });

          appState.debugState.totalErrors++;

          broadcastDebugEvent('error', {
            requestId,
            error: err.message,
            totalTimeMs: Date.now() - startTime,
          });

          // Close response if not already sent
          if (!res.headersSent) {
            res.status(500).end();
          }
        });

        // Handle client disconnect during streaming
        req.on('close', () => {
          if (streamEnded) return;
          streamEnded = true;

          logger.debug('Client disconnected during stream', { requestId });

          // Destroy the upstream stream to LM Studio
          if (response.data && typeof response.data.destroy === 'function') {
            response.data.destroy();
          }
        });

        // Start piping the stream
        response.data.pipe(res);

      } else {
        // Non-streaming response - update state immediately
        logger.debug('Sending non-streaming response', { requestId });

        // Extract token usage from response if available (OpenAI format)
        const responseData = response.data;
        let tokenUsage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined;

        if (responseData?.usage) {
          tokenUsage = {
            promptTokens: responseData.usage.prompt_tokens,
            completionTokens: responseData.usage.completion_tokens,
            totalTokens: responseData.usage.total_tokens,
          };

          logger.debug('Token usage extracted', {
            requestId,
            ...tokenUsage,
          });
        }

        appState.debugState.totalRequests++;
        appState.debugState.recentRequests.push({
          requestId,
          status: 'completed',
          timeMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          tokensGenerated: tokenUsage?.completionTokens, // Backward compatibility
          tokenUsage, // Full token usage data
        });

        // Keep only last 100 requests
        if (appState.debugState.recentRequests.length > 100) {
          appState.debugState.recentRequests = appState.debugState.recentRequests.slice(-100);
        }

        // Broadcast inference complete event with token info
        broadcastDebugEvent('inference_complete', {
          requestId,
          totalTimeMs: Date.now() - startTime,
          tokenUsage,
        });

        // Send JSON response
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
        errorCode: axios.isAxiosError(error) ? error.code : 'N/A',
        responseStatus: axios.isAxiosError(error) ? error.response?.status : 'N/A',
        responseData: axios.isAxiosError(error) ? error.response?.data : 'N/A',
        requestUrl: targetUrl,
        requestMethod: req.method,
      });

      if (axios.isAxiosError(error)) {
        // Log detailed axios error information
        logger.error('Axios error details', {
          requestId,
          message: error.message,
          code: error.code,
          config: {
            url: error.config?.url,
            method: error.config?.method,
            baseURL: error.config?.baseURL,
          },
          response: error.response
            ? {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data,
              }
            : 'No response received',
        });

        const status = error.response?.status || 503;
        const data = error.response?.data || { error: 'LM Studio API error' };
        res.status(status).json(data);
      } else {
        next(error);
      }
    }
  };

  /**
   * Route 1: Shorthand OpenAI endpoints (without /v1/ prefix)
   * Examples: /chat/completions, /completions, /models
   * Auto-adds /v1/ prefix when forwarding to LM Studio
   */
  for (const endpoint of OPENAI_ENDPOINTS) {
    router.all(endpoint, async (req: Request, res: Response, next: NextFunction) => {
      // Add /v1/ prefix to match LM Studio's API
      const targetPath = `/v1${req.path}`;
      await proxyHandler(req, res, next, targetPath, true);
    });
  }

  /**
   * Route 2: Standard /v1/* requests (OpenAI-compatible format)
   * Excludes gateway-specific paths like /v1/debug, /v1/admin, /v1/health
   */
  router.all(/^\/v1\/(?!(debug|admin|health)\/).*/, async (req: Request, res: Response, next: NextFunction) => {
    // Use original path (already has /v1/ prefix)
    await proxyHandler(req, res, next, req.path, false);
  });

  return router;
}
