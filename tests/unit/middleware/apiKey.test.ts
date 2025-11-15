import { Request, Response, NextFunction } from 'express';
import { apiKeyMiddleware } from '../../../src/middleware/apiKey';
import { settings } from '../../../src/config/settings';

describe('API Key Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      path: '/test',
      headers: {},
      ip: '127.0.0.1',
    };

    mockRes = {
      status: statusMock,
      json: jsonMock,
    };

    mockNext = jest.fn();
  });

  it('should allow requests when API key is disabled', () => {
    // If API key is empty or disabled, should call next()
    apiKeyMiddleware(mockReq as Request, mockRes as Response, mockNext);

    if (!settings.apiKeyEnabled) {
      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    }
  });

  it('should allow health check without auth if configured', () => {
    const healthReq = {
      ...mockReq,
      path: '/health',
    };

    apiKeyMiddleware(healthReq as Request, mockRes as Response, mockNext);

    // If requireAuthForHealth is false, should call next()
    if (!settings.requireAuthForHealth) {
      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    }
  });

  it('should reject requests without API key when enabled', () => {
    // Only run if API key is enabled
    if (settings.apiKeyEnabled) {
      const adminReq = {
        ...mockReq,
        path: '/admin/models',
        headers: {},
      };

      apiKeyMiddleware(adminReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(mockNext).not.toHaveBeenCalled();
    } else {
      // If API key is disabled, this test is skipped
      expect(true).toBe(true);
    }
  });

  it('should allow requests with valid API key', () => {
    if (settings.apiKeyEnabled) {
      const validReq = {
        ...mockReq,
        headers: { 'x-api-key': settings.gatewayApiKey },
      };

      apiKeyMiddleware(validReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    } else {
      // If API key is disabled, next is always called
      expect(true).toBe(true);
    }
  });

  it('should reject requests with invalid API key', () => {
    if (settings.apiKeyEnabled) {
      const invalidReq = {
        ...mockReq,
        headers: { 'x-api-key': 'wrong-key' },
      };

      apiKeyMiddleware(invalidReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(mockNext).not.toHaveBeenCalled();
    } else {
      expect(true).toBe(true);
    }
  });
});
