import { LMStudioClient } from '@lmstudio/sdk';
import logger from '../config/logger';
import { settings } from '../config/settings';

/**
 * LM Studio SDK Client Service
 *
 * Provides a singleton LMStudioClient instance for model management via WebSocket.
 * This service wraps the official @lmstudio/sdk for:
 * - Model loading/unloading
 * - Load configuration (context length, GPU settings, etc.)
 * - Multi-instance support
 * - Event monitoring
 */

class LMStudioClientService {
  private static instance: LMStudioClientService | null = null;
  private client: LMStudioClient | null = null;
  private connecting: Promise<LMStudioClient> | null = null;
  private readonly maxRetries = 3;
  private readonly retryDelayMs = 2000;

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): LMStudioClientService {
    if (!LMStudioClientService.instance) {
      LMStudioClientService.instance = new LMStudioClientService();
    }
    return LMStudioClientService.instance;
  }

  /**
   * Convert HTTP URL to WebSocket URL
   * Example: http://127.0.0.1:1234 -> ws://127.0.0.1:1234
   */
  private getWebSocketUrl(): string {
    const httpUrl = settings.lmStudioBaseUrl;
    const wsUrl = httpUrl.replace(/^http/, 'ws');
    return wsUrl;
  }

  /**
   * Get or create LMStudioClient connection
   *
   * @returns Promise<LMStudioClient>
   * @throws Error if connection fails after retries
   */
  public async getClient(): Promise<LMStudioClient> {
    // Return existing client if connected
    if (this.client) {
      return this.client;
    }

    // Wait for existing connection attempt
    if (this.connecting) {
      return this.connecting;
    }

    // Start new connection
    this.connecting = this.connect();
    return this.connecting;
  }

  /**
   * Connect to LM Studio with retry logic
   */
  private async connect(): Promise<LMStudioClient> {
    const wsUrl = this.getWebSocketUrl();

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        logger.info('Connecting to LM Studio SDK', {
          url: wsUrl,
          attempt,
          maxRetries: this.maxRetries,
        });

        const client = new LMStudioClient({
          baseUrl: wsUrl,
        });

        // Test connection by listing downloaded models
        await client.system.listDownloadedModels();

        logger.info('Successfully connected to LM Studio SDK', {
          url: wsUrl,
          attempt,
        });

        this.client = client;
        this.connecting = null;

        return client;
      } catch (error) {
        logger.warn('Failed to connect to LM Studio SDK', {
          url: wsUrl,
          attempt,
          maxRetries: this.maxRetries,
          error: error instanceof Error ? error.message : String(error),
        });

        if (attempt < this.maxRetries) {
          logger.info(`Retrying in ${this.retryDelayMs}ms...`);
          await this.delay(this.retryDelayMs);
        } else {
          this.connecting = null;
          const errorMsg =
            'Failed to connect to LM Studio SDK after ' +
            this.maxRetries +
            ' attempts. ' +
            'Ensure LM Studio is running and the API server is enabled.';

          logger.error(errorMsg, {
            url: wsUrl,
            originalError: error instanceof Error ? error.message : String(error),
          });

          throw new Error(errorMsg);
        }
      }
    }

    // Should never reach here due to throw above
    throw new Error('Connection failed');
  }

  /**
   * Check if client is connected
   */
  public isConnected(): boolean {
    return this.client !== null;
  }

  /**
   * Disconnect from LM Studio
   */
  public async disconnect(): Promise<void> {
    if (this.client) {
      logger.info('Disconnecting from LM Studio SDK');
      // The SDK doesn't expose a disconnect method, so we just null the client
      // The WebSocket connection will be cleaned up by garbage collection
      this.client = null;
      this.connecting = null;
    }
  }

  /**
   * Health check - verify connection is alive
   *
   * @returns true if connected and responsive
   */
  public async healthCheck(): Promise<boolean> {
    try {
      if (!this.client) {
        return false;
      }

      // Test connection by listing downloaded models
      await this.client.system.listDownloadedModels();
      return true;
    } catch (error) {
      logger.warn('LM Studio SDK health check failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      // Invalidate client on health check failure
      this.client = null;
      this.connecting = null;

      return false;
    }
  }

  /**
   * Helper function for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance getter
export const getLMStudioClient = (): LMStudioClientService => {
  return LMStudioClientService.getInstance();
};

// Export for testing
export { LMStudioClientService };
