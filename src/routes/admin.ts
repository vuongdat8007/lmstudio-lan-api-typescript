import { Router, Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import {
  LoadModelRequestSchema,
  UnloadModelRequestSchema,
  ActivateModelRequestSchema,
  AppState,
} from '../types/models';
import { broadcastDebugEvent } from '../utils/eventBroadcaster';
import { getLMStudioClient } from '../services/lmStudioClient';

export function createAdminRouter(appState: AppState): Router {
  const router = Router();

  /**
   * GET /admin/models - List available models
   */
  router.get('/models', async (_req: Request, res: Response) => {
    try {
      logger.info('Fetching model list from LM Studio SDK');

      const lmStudioClient = getLMStudioClient();
      const client = await lmStudioClient.getClient();

      // Get both available and loaded models
      const [loadedModels, downloadedModels] = await Promise.all([
        client.llm.listLoaded(),
        client.system.listDownloadedModels(),
      ]);

      res.json({
        loaded: loadedModels.map((model) => ({
          path: model.path,
          identifier: model.identifier,
        })),
        downloaded: downloadedModels.map((model) => ({
          path: model.path,
          size: model.sizeBytes,
          type: model.type,
        })),
      });
    } catch (error) {
      logger.error('Error fetching models via SDK:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch models';
      res.status(503).json({ error: errorMessage });
    }
  });

  /**
   * POST /admin/models/load - Load a model
   */
  router.post('/models/load', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request
      const payload = LoadModelRequestSchema.parse(req.body);

      logger.info('Loading model', {
        modelKey: payload.modelKey,
        instanceId: payload.instanceId,
      });

      const startTime = Date.now();

      // Update debug state
      appState.debugState.status = 'loading_model';
      appState.debugState.currentOperation = {
        type: 'model_load',
        modelKey: payload.modelKey,
        progress: 0,
        startedAt: new Date().toISOString(),
      };

      // Broadcast model load start event
      broadcastDebugEvent('model_load_start', {
        modelKey: payload.modelKey,
        instanceId: payload.instanceId || null,
        loadConfig: payload.loadConfig || {},
      });

      // Use LM Studio SDK for real model loading
      try {
        const lmStudioClient = getLMStudioClient();
        const client = await lmStudioClient.getClient();

        logger.info('Loading model via SDK', {
          modelKey: payload.modelKey,
          instanceId: payload.instanceId,
        });

        // Build load configuration
        const loadConfig: any = {};

        if (payload.loadConfig?.contextLength) {
          loadConfig.contextLength = payload.loadConfig.contextLength;
        }

        if (payload.loadConfig?.gpu) {
          loadConfig.gpu = payload.loadConfig.gpu;
        }

        if (payload.loadConfig?.cpuThreads) {
          loadConfig.cpuThreads = payload.loadConfig.cpuThreads;
        }

        if (payload.loadConfig?.ropeFrequencyBase) {
          loadConfig.ropeFrequencyBase = payload.loadConfig.ropeFrequencyBase;
        }

        if (payload.loadConfig?.ropeFrequencyScale) {
          loadConfig.ropeFrequencyScale = payload.loadConfig.ropeFrequencyScale;
        }

        // Load the model
        await client.llm.load(payload.modelKey, {
          identifier: payload.instanceId,
          config: loadConfig,
        });

        logger.info('Model loaded successfully via SDK', {
          modelKey: payload.modelKey,
          instanceId: payload.instanceId,
        });

        // Activate model if requested
        if (payload.activate) {
          appState.activeModel = {
            modelKey: payload.modelKey,
            instanceId: payload.instanceId || null,
            defaultInference: payload.defaultInference || {},
          };
          logger.info('Model activated as default', { modelKey: payload.modelKey });
        }

        // Update debug state
        appState.debugState.status = 'idle';
        appState.debugState.currentOperation = null;

        const totalTimeMs = Date.now() - startTime;

        // Broadcast model load complete event
        broadcastDebugEvent('model_load_complete', {
          modelKey: payload.modelKey,
          instanceId: payload.instanceId || null,
          activated: payload.activate,
          totalTimeMs,
          loadConfig: payload.loadConfig || {},
        });

        res.json({
          status: 'loaded',
          modelKey: payload.modelKey,
          instanceId: payload.instanceId || null,
          activated: payload.activate,
          totalTimeMs,
          message: 'Model loaded successfully via LM Studio SDK',
        });
      } catch (loadError) {
        appState.debugState.status = 'error';
        appState.debugState.totalErrors++;

        const totalTimeMs = Date.now() - startTime;

        const errorMessage =
          loadError instanceof Error ? loadError.message : 'Model load failed';

        logger.error('Failed to load model via SDK', {
          modelKey: payload.modelKey,
          error: errorMessage,
        });

        // Broadcast error event
        broadcastDebugEvent('error', {
          operation: 'model_load',
          modelKey: payload.modelKey,
          error: errorMessage,
          totalTimeMs,
        });

        throw loadError;
      }
    } catch (error) {
      appState.debugState.status = 'error';
      appState.debugState.totalErrors++;

      // Broadcast error event for validation errors
      if (error instanceof Error) {
        broadcastDebugEvent('error', {
          operation: 'model_load',
          error: error.message,
        });
      }

      next(error);
    }
  });

  /**
   * POST /admin/models/unload - Unload a model
   */
  router.post('/models/unload', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payload = UnloadModelRequestSchema.parse(req.body);

      logger.info('Unloading model', {
        modelKey: payload.modelKey,
        instanceId: payload.instanceId,
      });

      const startTime = Date.now();

      // Update debug state
      appState.debugState.status = 'loading_model'; // Using loading_model for any model operation
      appState.debugState.currentOperation = {
        type: 'model_unload',
        modelKey: payload.modelKey,
        progress: 0,
        startedAt: new Date().toISOString(),
      };

      // Broadcast model unload start event
      broadcastDebugEvent('model_unload_start', {
        modelKey: payload.modelKey,
        instanceId: payload.instanceId || null,
      });

      // Use LM Studio SDK for real model unloading
      try {
        const lmStudioClient = getLMStudioClient();
        const client = await lmStudioClient.getClient();

        logger.info('Unloading model via SDK', {
          modelKey: payload.modelKey,
          instanceId: payload.instanceId,
        });

        // Get all loaded models
        const loadedModels = await client.llm.listLoaded();

        // Find the model to unload (by identifier or path)
        const modelToUnload = loadedModels.find((model) => {
          if (payload.instanceId) {
            return model.identifier === payload.instanceId;
          }
          return model.path === payload.modelKey;
        });

        if (!modelToUnload) {
          const notFoundMsg = `Model not found: ${payload.modelKey}${
            payload.instanceId ? ` (instance: ${payload.instanceId})` : ''
          }`;
          logger.warn(notFoundMsg);

          res.status(404).json({
            status: 'not_found',
            modelKey: payload.modelKey,
            instanceId: payload.instanceId || null,
            message: notFoundMsg,
          });
          return;
        }

        // Unload the model
        await modelToUnload.unload();

        logger.info('Model unloaded successfully via SDK', {
          modelKey: payload.modelKey,
          instanceId: payload.instanceId,
        });

        // Clear active model if it's the one being unloaded
        if (
          appState.activeModel.modelKey === payload.modelKey &&
          (!payload.instanceId || appState.activeModel.instanceId === payload.instanceId)
        ) {
          appState.activeModel = {
            modelKey: null,
            instanceId: null,
            defaultInference: {},
          };
          logger.info('Active model cleared');
        }

        // Update debug state
        appState.debugState.status = 'idle';
        appState.debugState.currentOperation = null;

        const totalTimeMs = Date.now() - startTime;

        // Broadcast model unload complete event
        broadcastDebugEvent('model_unload_complete', {
          modelKey: payload.modelKey,
          instanceId: payload.instanceId || null,
          totalTimeMs,
        });

        res.json({
          status: 'unloaded',
          modelKey: payload.modelKey,
          instanceId: payload.instanceId || null,
          totalTimeMs,
          message: 'Model unloaded successfully via LM Studio SDK',
        });
      } catch (unloadError) {
        appState.debugState.status = 'error';
        appState.debugState.totalErrors++;

        const totalTimeMs = Date.now() - startTime;

        const errorMessage =
          unloadError instanceof Error ? unloadError.message : 'Model unload failed';

        logger.error('Failed to unload model via SDK', {
          modelKey: payload.modelKey,
          error: errorMessage,
        });

        // Broadcast error event
        broadcastDebugEvent('error', {
          operation: 'model_unload',
          modelKey: payload.modelKey,
          error: errorMessage,
          totalTimeMs,
        });

        throw unloadError;
      }
    } catch (error) {
      appState.debugState.status = 'error';
      appState.debugState.totalErrors++;
      appState.debugState.currentOperation = null;

      // Broadcast error event
      if (error instanceof Error) {
        broadcastDebugEvent('error', {
          operation: 'model_unload',
          error: error.message,
        });
      }

      next(error);
    }
  });

  /**
   * POST /admin/models/activate - Activate a model as default
   */
  router.post(
    '/models/activate',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const payload = ActivateModelRequestSchema.parse(req.body);

        logger.info('Activating model', {
          modelKey: payload.modelKey,
          instanceId: payload.instanceId,
        });

        // Broadcast model activate event
        broadcastDebugEvent('model_activate', {
          modelKey: payload.modelKey,
          instanceId: payload.instanceId || null,
          defaultInference: payload.defaultInference || {},
        });

        // Update active model
        appState.activeModel = {
          modelKey: payload.modelKey,
          instanceId: payload.instanceId || null,
          defaultInference: payload.defaultInference || {},
        };

        res.json({
          status: 'activated',
          modelKey: payload.modelKey,
          instanceId: payload.instanceId || null,
          defaultInference: appState.activeModel.defaultInference,
          message: 'Model activated successfully',
        });
      } catch (error) {
        appState.debugState.totalErrors++;

        // Broadcast error event
        if (error instanceof Error) {
          broadcastDebugEvent('error', {
            operation: 'model_activate',
            error: error.message,
          });
        }

        next(error);
      }
    }
  );

  return router;
}
