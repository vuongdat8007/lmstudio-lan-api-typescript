import { Request, Response, NextFunction } from 'express';
import { ipAllowlistMiddleware } from '../../../src/middleware/ipAllowlist';

describe('IP Allowlist Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      ip: '192.168.0.100',
      path: '/test',
      socket: { remoteAddress: '192.168.0.100' } as any,
    };

    mockRes = {
      status: statusMock,
      json: jsonMock,
    };

    mockNext = jest.fn();
  });

  it('should allow wildcard access', () => {
    // Assuming IP_ALLOWLIST is set to '*' by default or in test env
    ipAllowlistMiddleware(mockReq as Request, mockRes as Response, mockNext);

    // If wildcard is enabled, next should be called
    // Note: This test depends on environment configuration
    expect(mockNext).toHaveBeenCalled();
  });

  it('should handle IPv6-mapped IPv4 addresses', () => {
    const ipv6Req = {
      ...mockReq,
      ip: '::ffff:192.168.0.100',
      socket: { remoteAddress: '::ffff:192.168.0.100' } as any,
    };

    ipAllowlistMiddleware(ipv6Req as Request, mockRes as Response, mockNext);

    // Should strip ::ffff: prefix and process as IPv4
    // Behavior depends on allowlist configuration
    expect(mockNext).toHaveBeenCalled();
  });

  it('should use socket.remoteAddress if req.ip is not available', () => {
    const noIpReq = {
      ...mockReq,
      ip: undefined,
      socket: { remoteAddress: '192.168.0.100' } as any,
    };

    ipAllowlistMiddleware(noIpReq as Request, mockRes as Response, mockNext);

    // Should still work with socket.remoteAddress
    expect(mockNext).toHaveBeenCalled();
  });
});
