import { settings } from '../../../src/config/settings';

describe('Settings', () => {
  it('should load settings from environment', () => {
    expect(settings.gatewayPort).toBeDefined();
    expect(typeof settings.gatewayPort).toBe('number');
    expect(settings.gatewayPort).toBeGreaterThan(0);
    expect(settings.gatewayPort).toBeLessThanOrEqual(65535);
  });

  it('should have valid lmStudioBaseUrl', () => {
    expect(settings.lmStudioBaseUrl).toBeDefined();
    expect(settings.lmStudioBaseUrl).toMatch(/^https?:\/\//);
  });

  it('should parse IP allowlist items', () => {
    expect(Array.isArray(settings.ipAllowlistItems)).toBe(true);
    expect(settings.ipAllowlistItems.length).toBeGreaterThan(0);
  });

  it('should determine if API key is enabled', () => {
    expect(typeof settings.apiKeyEnabled).toBe('boolean');
  });

  it('should have valid log level', () => {
    expect(settings.logLevel).toBeDefined();
    expect(['error', 'warn', 'info', 'debug']).toContain(settings.logLevel);
  });

  it('should have valid node environment', () => {
    expect(settings.nodeEnv).toBeDefined();
    expect(['development', 'production', 'test']).toContain(settings.nodeEnv);
  });
});
