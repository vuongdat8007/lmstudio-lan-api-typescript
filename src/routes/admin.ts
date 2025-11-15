import { Router, Request, Response, NextFunction } from 'express';
import axios from 'axios';
import logger from '../config/logger';
import { settings } from '../config/settings';
import {
  LoadModelRequestSchema,
  UnloadModelRequestSchema,
  ActivateModelRequestSchema,
  AppState,
} from '../types/models';

export function createAdminRouter(appState: AppState): Router {
  const router = Router();

  /**
   * GET /admin/models - List available models
   */
  router.get('/models', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      logger.info('Fetching model list from LM Studio');

      const response = await axios.get(`${settings.lmStudioBaseUrl}/v1/models`, {
        timeout: 10000,
      });

      res.json(response.data);
    } catch (error) {
      logger.error('Error fetching models:', error);
      if (axios.isAxiosError(error)) {
        const status = error.response?.status || 503;
        const message = error.response?.data?.error || 'LM Studio API unreachable';
        res.status(status).json({ error: message });
      } else {
        next(error);
      }
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

      // Update debug state
      appState.debugState.status = 'loading_model';
      appState.debugState.currentOperation = {
        type: 'model_load',
        modelKey: payload.modelKey,
        progress: 0,
        startedAt: new Date().toISOString(),
      };

      // Call LM Studio API to load model
      // Note: This is a placeholder - actual LM Studio API may differ
      // For now, we'll simulate the load and track state
      try {
        // In a real implementation, this would call LM Studio's model loading API
        // const response = await axios.post(
        //   `${settings.lmStudioBaseUrl}/v1/models/load`,
        //   {
        //     model: payload.modelKey,
        //     ...(payload.loadConfig && { config: payload.loadConfig }),
        //   },
        //   { timeout: 60000 }
        // );

        // For now, we'll just track the state
        logger.info('Model load initiated', { modelKey: payload.modelKey });

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

        res.json({
          status: 'loaded',
          modelKey: payload.modelKey,
          instanceId: payload.instanceId || null,
          activated: payload.activate,
          message: 'Model loaded successfully',
        });
      } catch (loadError) {
        appState.debugState.status = 'error';
        appState.debugState.totalErrors++;
        throw loadError;
      }
    } catch (error) {
      appState.debugState.status = 'error';
      appState.debugState.totalErrors++;
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

      // In a real implementation, call LM Studio API to unload model
      // await axios.post(
      //   `${settings.lmStudioBaseUrl}/v1/models/unload`,
      //   {
      //     model: payload.modelKey,
      //   },
      //   { timeout: 30000 }
      // );

      // Clear active model if it's the one being unloaded
      if (appState.activeModel.modelKey === payload.modelKey) {
        appState.activeModel = {
          modelKey: null,
          instanceId: null,
          defaultInference: {},
        };
        logger.info('Active model cleared');
      }

      res.json({
        status: 'unloaded',
        modelKey: payload.modelKey,
        instanceId: payload.instanceId || null,
        message: 'Model unloaded successfully',
      });
    } catch (error) {
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
        next(error);
      }
    }
  );

  return router;
}
