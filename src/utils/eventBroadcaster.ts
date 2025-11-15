import { EventEmitter } from 'events';
import logger from '../config/logger';

// Global event emitter for broadcasting debug events
const debugEventEmitter = new EventEmitter();
debugEventEmitter.setMaxListeners(100); // Support many concurrent clients

export interface DebugEventData {
  type: string;
  data: Record<string, any>;
}

/**
 * Broadcast a debug event to all connected SSE clients
 */
export function broadcastDebugEvent(eventType: string, data: Record<string, any>): void {
  const event: DebugEventData = {
    type: eventType,
    data: {
      ...data,
      timestamp: new Date().toISOString(),
    },
  };

  debugEventEmitter.emit('debug-event', event);
  logger.debug('Debug event broadcasted', { type: eventType });
}

/**
 * Get the debug event emitter
 */
export function getDebugEventEmitter(): EventEmitter {
  return debugEventEmitter;
}
