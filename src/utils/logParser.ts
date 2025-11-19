/**
 * LM Studio Log Parser
 *
 * Parses LM Studio server log entries and extracts structured information
 * for broadcasting to debug streams.
 */

export interface ParsedLogEntry {
  timestamp: string;
  logLevel: 'INFO' | 'DEBUG' | 'WARN' | 'ERROR';
  message: string;
  raw: string;
}

export interface SamplingParams {
  repeat_last_n?: number;
  repeat_penalty?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  dry_multiplier?: number;
  dry_base?: number;
  dry_allowed_length?: number;
  dry_penalty_last_n?: number;
  top_k?: number;
  top_p?: number;
  min_p?: number;
  xtc_probability?: number;
  xtc_threshold?: number;
  typical_p?: number;
  top_n_sigma?: number;
  temp?: number;
  mirostat?: number;
  mirostat_lr?: number;
  mirostat_ent?: number;
}

export interface PromptProgressInfo {
  progress: number; // Percentage
  message: string;
}

export interface CacheStats {
  reused: number;
  total: number;
  percentage: number;
  prefix: number;
  nonPrefix: number;
  message: string;
}

export interface TokenInfo {
  n_ctx?: number;
  n_batch?: number;
  n_predict?: number;
  n_keep?: number;
  totalPromptTokens?: number;
  promptTokensToDecode?: number;
}

/**
 * Parse a log line to extract timestamp and log level
 */
export function parseLogLine(line: string): ParsedLogEntry | null {
  // Match pattern: "[2025-11-17 10:59:23][INFO]" or "[2025-11-17 10:59:23][DEBUG][Client=...]"
  const match = line.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]\[(INFO|DEBUG|WARN|ERROR)\]/);

  if (!match) {
    return null;
  }

  const [, timestamp, logLevel] = match;
  const message = line.substring(match[0].length).trim();

  return {
    timestamp,
    logLevel: logLevel as ParsedLogEntry['logLevel'],
    message,
    raw: line,
  };
}

/**
 * Extract sampling parameters from a DEBUG log line
 */
export function parseSamplingParams(message: string): SamplingParams | null {
  if (!message.includes('Sampling params:')) {
    return null;
  }

  const params: SamplingParams = {};

  // Parse repeat parameters
  const repeatMatch = message.match(/repeat_last_n = (\d+), repeat_penalty = ([\d.]+), frequency_penalty = ([\d.]+), presence_penalty = ([\d.]+)/);
  if (repeatMatch) {
    params.repeat_last_n = parseInt(repeatMatch[1]);
    params.repeat_penalty = parseFloat(repeatMatch[2]);
    params.frequency_penalty = parseFloat(repeatMatch[3]);
    params.presence_penalty = parseFloat(repeatMatch[4]);
  }

  // Parse dry parameters
  const dryMatch = message.match(/dry_multiplier = ([\d.]+), dry_base = ([\d.]+), dry_allowed_length = (\d+), dry_penalty_last_n = (-?\d+)/);
  if (dryMatch) {
    params.dry_multiplier = parseFloat(dryMatch[1]);
    params.dry_base = parseFloat(dryMatch[2]);
    params.dry_allowed_length = parseInt(dryMatch[3]);
    params.dry_penalty_last_n = parseInt(dryMatch[4]);
  }

  // Parse top_k, top_p, min_p, etc.
  const topMatch = message.match(/top_k = (\d+), top_p = ([\d.]+), min_p = ([\d.]+), xtc_probability = ([\d.]+), xtc_threshold = ([\d.]+), typical_p = ([\d.]+), top_n_sigma = ([-\d.]+), temp = ([\d.]+)/);
  if (topMatch) {
    params.top_k = parseInt(topMatch[1]);
    params.top_p = parseFloat(topMatch[2]);
    params.min_p = parseFloat(topMatch[3]);
    params.xtc_probability = parseFloat(topMatch[4]);
    params.xtc_threshold = parseFloat(topMatch[5]);
    params.typical_p = parseFloat(topMatch[6]);
    params.top_n_sigma = parseFloat(topMatch[7]);
    params.temp = parseFloat(topMatch[8]);
  }

  // Parse mirostat parameters
  const mirostatMatch = message.match(/mirostat = (\d+), mirostat_lr = ([\d.]+), mirostat_ent = ([\d.]+)/);
  if (mirostatMatch) {
    params.mirostat = parseInt(mirostatMatch[1]);
    params.mirostat_lr = parseFloat(mirostatMatch[2]);
    params.mirostat_ent = parseFloat(mirostatMatch[3]);
  }

  return Object.keys(params).length > 0 ? params : null;
}

/**
 * Extract prompt processing progress
 */
export function parsePromptProgress(message: string): PromptProgressInfo | null {
  // Match "Prompt processing progress: 0.0%"
  const match = message.match(/Prompt processing progress: ([\d.]+)%/);

  if (!match) {
    return null;
  }

  return {
    progress: parseFloat(match[1]),
    message: message.trim(),
  };
}

/**
 * Extract cache reuse statistics
 */
export function parseCacheStats(message: string): CacheStats | null {
  // Match "Cache reuse summary: 2158/5889 of prompt (36.6446%), 2158 prefix, 0 non-prefix"
  const match = message.match(/Cache reuse summary: (\d+)\/(\d+) of prompt \(([\d.]+)%\), (\d+) prefix, (\d+) non-prefix/);

  if (!match) {
    return null;
  }

  return {
    reused: parseInt(match[1]),
    total: parseInt(match[2]),
    percentage: parseFloat(match[3]),
    prefix: parseInt(match[4]),
    nonPrefix: parseInt(match[5]),
    message: message.trim(),
  };
}

/**
 * Extract token information
 */
export function parseTokenInfo(message: string): TokenInfo | null {
  const info: TokenInfo = {};

  // Match "Generate: n_ctx = 12032, n_batch = 512, n_predict = -1, n_keep = 2198"
  const generateMatch = message.match(/Generate: n_ctx = (\d+), n_batch = (\d+), n_predict = (-?\d+), n_keep = (\d+)/);
  if (generateMatch) {
    info.n_ctx = parseInt(generateMatch[1]);
    info.n_batch = parseInt(generateMatch[2]);
    info.n_predict = parseInt(generateMatch[3]);
    info.n_keep = parseInt(generateMatch[4]);
  }

  // Match "Total prompt tokens: 5889"
  const totalTokensMatch = message.match(/Total prompt tokens: (\d+)/);
  if (totalTokensMatch) {
    info.totalPromptTokens = parseInt(totalTokensMatch[1]);
  }

  // Match "Prompt tokens to decode: 3731"
  const decodeTokensMatch = message.match(/Prompt tokens to decode: (\d+)/);
  if (decodeTokensMatch) {
    info.promptTokensToDecode = parseInt(decodeTokensMatch[1]);
  }

  return Object.keys(info).length > 0 ? info : null;
}

/**
 * Check if a log line indicates the start of a chat completion
 */
export function isChatCompletionStart(message: string): boolean {
  return message.includes('Running chat completion on conversation');
}

/**
 * Check if a log line indicates begin processing prompt
 */
export function isBeginProcessingPrompt(message: string): boolean {
  return message.includes('BeginProcessingPrompt');
}
