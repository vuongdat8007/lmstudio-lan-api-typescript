import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables (override any existing env vars)
dotenv.config({ override: true });

// Environment schema with validation
const envSchema = z.object({
  LMSTUDIO_BASE_URL: z.string().url().default('http://127.0.0.1:1234'),
  GATEWAY_HOST: z.string().default('0.0.0.0'),
  GATEWAY_PORT: z.coerce.number().int().min(1).max(65535).default(8001),
  GATEWAY_API_KEY: z.string().default(''),
  IP_ALLOWLIST: z.string().default('*'),
  REQUIRE_AUTH_FOR_HEALTH: z
    .string()
    .default('false')
    .transform((val) => val === 'true'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

// Parse and validate environment variables
const env = envSchema.parse(process.env);

// Export settings object
export const settings = {
  lmStudioBaseUrl: env.LMSTUDIO_BASE_URL,
  gatewayHost: env.GATEWAY_HOST,
  gatewayPort: env.GATEWAY_PORT,
  gatewayApiKey: env.GATEWAY_API_KEY,
  ipAllowlist: env.IP_ALLOWLIST,
  requireAuthForHealth: env.REQUIRE_AUTH_FOR_HEALTH,
  logLevel: env.LOG_LEVEL,
  nodeEnv: env.NODE_ENV,

  // Computed properties
  get ipAllowlistItems(): string[] {
    return this.ipAllowlist
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  },

  get apiKeyEnabled(): boolean {
    return this.gatewayApiKey.length > 0;
  },
} as const;
