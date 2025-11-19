import chokidar, { FSWatcher } from 'chokidar';
import { promises as fs } from 'fs';
import path from 'path';
import logger from '../config/logger';
import { broadcastDebugEvent } from '../utils/eventBroadcaster';
import {
  parseLogLine,
  parseSamplingParams,
  parsePromptProgress,
  parseCacheStats,
  parseTokenInfo,
  isChatCompletionStart,
  isBeginProcessingPrompt,
} from '../utils/logParser';

/**
 * LM Studio Log Monitor Service
 *
 * Monitors LM Studio's server log files and broadcasts parsed events
 * to the debug stream for real-time visibility into LM Studio operations.
 */

class LMStudioLogMonitor {
  private static instance: LMStudioLogMonitor | null = null;
  private watcher: FSWatcher | null = null;
  private parentWatcher: FSWatcher | null = null;
  private currentLogFile: string | null = null;
  private currentMonthDir: string | null = null;
  private filePosition: number = 0;
  private enabled: boolean = false;
  private logDirectory: string | null = null;
  private monthCheckInterval: NodeJS.Timeout | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  public static getInstance(): LMStudioLogMonitor {
    if (!LMStudioLogMonitor.instance) {
      LMStudioLogMonitor.instance = new LMStudioLogMonitor();
    }
    return LMStudioLogMonitor.instance;
  }

  /**
   * Start monitoring LM Studio logs
   */
  public async start(logDirectory: string, enabled: boolean): Promise<void> {
    this.logDirectory = logDirectory;
    this.enabled = enabled;

    if (!this.enabled) {
      logger.info('LM Studio log monitoring is disabled');
      return;
    }

    if (!logDirectory) {
      logger.warn('LM Studio log directory not configured, log monitoring disabled');
      return;
    }

    try {
      // Find the current month's log directory
      const currentMonthDir = await this.findCurrentMonthLogDir(logDirectory);
      if (!currentMonthDir) {
        logger.warn('Could not find current month log directory', { logDirectory });
        return;
      }

      this.currentMonthDir = currentMonthDir;
      logger.info('Starting LM Studio log monitoring', { directory: currentMonthDir });

      // Find the most recent log file
      const latestLogFile = await this.findLatestLogFile(currentMonthDir);
      if (!latestLogFile) {
        logger.warn('No log files found in directory', { directory: currentMonthDir });
        return;
      }

      this.currentLogFile = latestLogFile;
      logger.info('Monitoring log file', { file: this.currentLogFile });

      // Get current file size to start reading from end
      const stats = await fs.stat(this.currentLogFile);
      this.filePosition = stats.size;

      // Watch the log directory for changes
      this.watcher = chokidar.watch(currentMonthDir, {
        persistent: true,
        ignoreInitial: false,
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 50,
        },
      });

      // Watch for file changes
      this.watcher.on('change', async (filePath: string) => {
        if (filePath === this.currentLogFile) {
          await this.readNewLogLines();
        }
      });

      // Watch for new files (log rotation)
      this.watcher.on('add', async (filePath: string) => {
        if (filePath.endsWith('.log')) {
          logger.info('New log file detected', { file: filePath });
          // Switch to new file if it's more recent
          const stats = await fs.stat(filePath);
          const currentStats = this.currentLogFile
            ? await fs.stat(this.currentLogFile)
            : null;

          if (!currentStats || stats.mtime > currentStats.mtime) {
            this.currentLogFile = filePath;
            this.filePosition = 0;
            logger.info('Switched to new log file', { file: filePath });
          }
        }
      });

      this.watcher.on('error', (error: unknown) => {
        logger.error('Log watcher error', {
          error: error instanceof Error ? error.message : String(error),
        });
      });

      // Set up periodic check for newer month directories (every 10 minutes)
      this.monthCheckInterval = setInterval(
        async () => {
          await this.checkForNewerMonthDirectory();
        },
        10 * 60 * 1000
      ); // 10 minutes

      // Set up polling as fallback for file changes (every 1 second)
      // This is needed on Windows where chokidar may not detect all file writes
      this.pollingInterval = setInterval(
        async () => {
          await this.readNewLogLines();
        },
        1000
      ); // 1 second

      // Watch parent directory for new month folders
      this.parentWatcher = chokidar.watch(logDirectory, {
        persistent: true,
        ignoreInitial: true,
        depth: 0, // Only watch immediate children
        awaitWriteFinish: {
          stabilityThreshold: 2000,
          pollInterval: 500,
        },
      });

      this.parentWatcher.on('addDir', async (dirPath: string) => {
        const dirName = path.basename(dirPath);
        // Check if it's a month directory (YYYY-MM format)
        if (/^\d{4}-\d{2}$/.test(dirName)) {
          logger.info('New month directory detected', { directory: dirPath });
          await this.checkForNewerMonthDirectory();
        }
      });

      this.parentWatcher.on('error', (error: unknown) => {
        logger.error('Parent directory watcher error', {
          error: error instanceof Error ? error.message : String(error),
        });
      });

      logger.info('LM Studio log monitoring started successfully');
    } catch (error) {
      logger.error('Failed to start log monitoring', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Stop monitoring
   */
  public async stop(): Promise<void> {
    // Clear polling interval
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    // Clear periodic month check interval
    if (this.monthCheckInterval) {
      clearInterval(this.monthCheckInterval);
      this.monthCheckInterval = null;
    }

    // Close parent directory watcher
    if (this.parentWatcher) {
      await this.parentWatcher.close();
      this.parentWatcher = null;
    }

    // Close current log directory watcher
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }

    logger.info('LM Studio log monitoring stopped');
  }

  /**
   * Find the current month's log directory
   */
  private async findCurrentMonthLogDir(baseDir: string): Promise<string | null> {
    try {
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const monthDir = path.join(baseDir, currentMonth);

      // Check if directory exists
      try {
        await fs.access(monthDir);
        return monthDir;
      } catch {
        // Try listing all directories and finding the most recent
        const entries = await fs.readdir(baseDir, { withFileTypes: true });
        const monthDirs = entries
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name)
          .filter((name) => /^\d{4}-\d{2}$/.test(name))
          .sort()
          .reverse();

        if (monthDirs.length > 0) {
          return path.join(baseDir, monthDirs[0]);
        }
      }
    } catch (error) {
      logger.error('Error finding month log directory', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return null;
  }

  /**
   * Check for newer month directories and switch if found
   */
  private async checkForNewerMonthDirectory(): Promise<void> {
    if (!this.logDirectory || !this.currentMonthDir) {
      return;
    }

    try {
      // Get all month directories
      const entries = await fs.readdir(this.logDirectory, { withFileTypes: true });
      const monthDirs = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((name) => /^\d{4}-\d{2}$/.test(name))
        .sort()
        .reverse();

      if (monthDirs.length === 0) {
        return;
      }

      // Get the most recent month directory
      const newestMonthDir = path.join(this.logDirectory, monthDirs[0]);
      const currentMonthDirName = path.basename(this.currentMonthDir);
      const newestMonthDirName = monthDirs[0];

      // Check if there's a newer month directory
      if (newestMonthDirName > currentMonthDirName) {
        logger.info('Newer month directory detected', {
          current: currentMonthDirName,
          new: newestMonthDirName,
        });
        await this.switchToNewDirectory(newestMonthDir);
      }
    } catch (error) {
      logger.error('Error checking for newer month directory', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Switch to a new month directory
   */
  private async switchToNewDirectory(newMonthDir: string): Promise<void> {
    try {
      const oldMonthDir = this.currentMonthDir;

      // Find the latest log file in the new directory
      const latestLogFile = await this.findLatestLogFile(newMonthDir);
      if (!latestLogFile) {
        logger.warn('No log files found in new directory', { directory: newMonthDir });
        return;
      }

      // Close current watcher
      if (this.watcher) {
        await this.watcher.close();
        this.watcher = null;
      }

      // Update state
      this.currentMonthDir = newMonthDir;
      this.currentLogFile = latestLogFile;
      this.filePosition = 0; // Start from beginning of new file

      // Set up new watcher for the new month directory
      this.watcher = chokidar.watch(newMonthDir, {
        persistent: true,
        ignoreInitial: false,
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 50,
        },
      });

      // Watch for file changes
      this.watcher.on('change', async (filePath: string) => {
        if (filePath === this.currentLogFile) {
          await this.readNewLogLines();
        }
      });

      // Watch for new files (log rotation)
      this.watcher.on('add', async (filePath: string) => {
        if (filePath.endsWith('.log')) {
          logger.info('New log file detected', { file: filePath });
          const stats = await fs.stat(filePath);
          const currentStats = this.currentLogFile
            ? await fs.stat(this.currentLogFile)
            : null;

          if (!currentStats || stats.mtime > currentStats.mtime) {
            this.currentLogFile = filePath;
            this.filePosition = 0;
            logger.info('Switched to new log file', { file: filePath });
          }
        }
      });

      this.watcher.on('error', (error: unknown) => {
        logger.error('Log watcher error', {
          error: error instanceof Error ? error.message : String(error),
        });
      });

      logger.info('Switched to new month directory', {
        from: oldMonthDir,
        to: newMonthDir,
        file: latestLogFile,
      });

      // Broadcast month transition event
      broadcastDebugEvent('lmstudio_month_transition', {
        oldDirectory: oldMonthDir,
        newDirectory: newMonthDir,
        newLogFile: latestLogFile,
      });
    } catch (error) {
      logger.error('Error switching to new directory', {
        error: error instanceof Error ? error.message : String(error),
        directory: newMonthDir,
      });
    }
  }

  /**
   * Find the most recent log file in a directory
   */
  private async findLatestLogFile(directory: string): Promise<string | null> {
    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });
      const logFiles = entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.log'))
        .map((entry) => path.join(directory, entry.name));

      if (logFiles.length === 0) {
        return null;
      }

      // Get file stats and sort by modification time
      const fileStats = await Promise.all(
        logFiles.map(async (file) => ({
          file,
          mtime: (await fs.stat(file)).mtime,
        }))
      );

      fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      return fileStats[0].file;
    } catch (error) {
      logger.error('Error finding latest log file', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Read new log lines from the current file
   */
  private async readNewLogLines(): Promise<void> {
    if (!this.currentLogFile) {
      return;
    }

    try {
      const stats = await fs.stat(this.currentLogFile);
      const fileSize = stats.size;

      // If file was truncated (log rotation), reset position
      if (fileSize < this.filePosition) {
        this.filePosition = 0;
      }

      // No new data
      if (fileSize === this.filePosition) {
        return;
      }

      // Read new data
      const fileHandle = await fs.open(this.currentLogFile, 'r');
      const buffer = Buffer.alloc(fileSize - this.filePosition);
      await fileHandle.read(buffer, 0, buffer.length, this.filePosition);
      await fileHandle.close();

      // Update position
      this.filePosition = fileSize;

      // Process lines
      const newContent = buffer.toString('utf-8');
      const lines = newContent.split('\n').filter((line) => line.trim().length > 0);

      for (const line of lines) {
        this.processLogLine(line);
      }
    } catch (error) {
      logger.error('Error reading log lines', {
        error: error instanceof Error ? error.message : String(error),
        file: this.currentLogFile,
      });
    }
  }

  /**
   * Process a single log line
   */
  private processLogLine(line: string): void {
    const parsed = parseLogLine(line);

    if (!parsed) {
      return;
    }

    // Broadcast raw log entry with debug_log key
    broadcastDebugEvent('debug_log', {
      timestamp: parsed.timestamp,
      level: parsed.logLevel,
      message: parsed.message,
      raw: line,
    });

    // Check for chat completion start
    if (isChatCompletionStart(parsed.message)) {
      broadcastDebugEvent('lmstudio_chat_start', {
        message: parsed.message,
      });
    }

    // Check for sampling parameters
    const samplingParams = parseSamplingParams(parsed.message);
    if (samplingParams) {
      broadcastDebugEvent('lmstudio_sampling_params', samplingParams);
    }

    // Check for prompt progress
    const promptProgress = parsePromptProgress(parsed.message);
    if (promptProgress) {
      broadcastDebugEvent('lmstudio_prompt_progress', {
        progress: promptProgress.progress,
        message: promptProgress.message,
      });
    }

    // Check for cache stats
    const cacheStats = parseCacheStats(parsed.message);
    if (cacheStats) {
      broadcastDebugEvent('lmstudio_cache_stats', {
        reused: cacheStats.reused,
        total: cacheStats.total,
        percentage: cacheStats.percentage,
        prefix: cacheStats.prefix,
        nonPrefix: cacheStats.nonPrefix,
        message: cacheStats.message,
      });
    }

    // Check for token info
    const tokenInfo = parseTokenInfo(parsed.message);
    if (tokenInfo) {
      broadcastDebugEvent('lmstudio_token_info', tokenInfo);
    }

    // Check for begin processing prompt
    if (isBeginProcessingPrompt(parsed.message)) {
      broadcastDebugEvent('lmstudio_processing_start', {
        message: 'BeginProcessingPrompt',
      });
    }
  }
}

// Export singleton getter
export const getLMStudioLogMonitor = (): LMStudioLogMonitor => {
  return LMStudioLogMonitor.getInstance();
};

// Export for testing
export { LMStudioLogMonitor };
