import { Request, Response, NextFunction } from 'express';
import * as ipaddr from 'ipaddr.js';
import logger from '../config/logger';
import { settings } from '../config/settings';

/**
 * Check if an IP address is within a CIDR range
 */
function ipInCidr(ip: string, cidr: string): boolean {
  try {
    // Handle CIDR notation
    if (cidr.includes('/')) {
      const [network, prefixStr] = cidr.split('/');
      const prefix = parseInt(prefixStr, 10);

      // Determine IP version
      const ipAddr = ip.includes(':') ? ipaddr.IPv6.parse(ip) : ipaddr.IPv4.parse(ip);
      const networkAddr = network.includes(':')
        ? ipaddr.IPv6.parse(network)
        : ipaddr.IPv4.parse(network);

      // Both must be same version
      if (ipAddr.kind() !== networkAddr.kind()) {
        return false;
      }

      // Check if IP matches network/prefix
      return ipAddr.match(networkAddr, prefix);
    } else {
      // Exact IP match
      return ip === cidr;
    }
  } catch (error) {
    logger.error('Error parsing IP/CIDR:', { ip, cidr, error });
    return false;
  }
}

/**
 * Middleware to enforce IP allowlist
 */
export function ipAllowlistMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const allowlist = settings.ipAllowlistItems;

  // Allow all if wildcard
  if (allowlist.includes('*')) {
    return next();
  }

  // Get client IP (handle IPv6-mapped IPv4)
  let clientIp = req.ip || req.socket.remoteAddress || '';
  if (clientIp.startsWith('::ffff:')) {
    clientIp = clientIp.substring(7);
  }

  // Check if IP is in allowlist
  const allowed = allowlist.some((item) => {
    if (item === clientIp) return true;
    if (item.includes('/')) return ipInCidr(clientIp, item);
    return false;
  });

  if (!allowed) {
    logger.warn('Forbidden IP attempted access', {
      ip: clientIp,
      path: req.path,
      allowlist,
    });
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  next();
}
