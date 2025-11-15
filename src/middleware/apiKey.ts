import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import { settings } from '../config/settings';

/**
 * Middleware to enforce API key authentication
 */
export function apiKeyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Skip if API key is not enabled
  if (!settings.apiKeyEnabled) {
    return next();
  }

  // Skip for health check if configured
  if (req.path === '/health' && !settings.requireAuthForHealth) {
    return next();
  }

  // Get API key from header
  const apiKey = req.headers['x-api-key'];

  // Validate API key
  if (!apiKey || apiKey !== settings.gatewayApiKey) {
    logger.warn('Unauthorized request', {
      ip: req.ip,
      path: req.path,
      hasKey: !!apiKey,
    });
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}
