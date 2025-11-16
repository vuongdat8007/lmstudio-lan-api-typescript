import { z } from 'zod';

// ===== Load Configuration Schemas =====

export const LoadConfigSchema = z.object({
  contextLength: z.number().int().positive().optional(),
  gpu: z
    .object({
      ratio: z.number().min(0).max(1).optional(),
      layers: z.number().int().nonnegative().optional(),
    })
    .optional(),
  cpuThreads: z.number().int().positive().optional(),
  ropeFrequencyBase: z.number().positive().optional(),
  ropeFrequencyScale: z.number().positive().optional(),
});

export type LoadConfig = z.infer<typeof LoadConfigSchema>;

// ===== Inference Parameter Schemas =====

export const DefaultInferenceSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  topP: z.number().min(0).max(1).optional(),
  topK: z.number().int().nonnegative().optional(),
  repeatPenalty: z.number().min(0).optional(),
  stopStrings: z.array(z.string()).optional(),
  stream: z.boolean().optional(),
});

export type DefaultInference = z.infer<typeof DefaultInferenceSchema>;

// ===== Admin API Request/Response Schemas =====

export const LoadModelRequestSchema = z.object({
  modelKey: z.string().min(1, 'modelKey is required'),
  instanceId: z.string().optional(),
  loadConfig: LoadConfigSchema.optional(),
  ttlSeconds: z.number().int().nonnegative().optional(),
  defaultInference: DefaultInferenceSchema.optional(),
  activate: z.boolean().default(true),
});

export type LoadModelRequest = z.infer<typeof LoadModelRequestSchema>;

export const LoadModelResponseSchema = z.object({
  status: z.literal('loaded'),
  modelKey: z.string(),
  instanceId: z.string().nullable(),
  activated: z.boolean(),
  message: z.string().optional(),
});

export type LoadModelResponse = z.infer<typeof LoadModelResponseSchema>;

export const UnloadModelRequestSchema = z.object({
  modelKey: z.string().min(1, 'modelKey is required'),
  instanceId: z.string().nullable().optional(),
});

export type UnloadModelRequest = z.infer<typeof UnloadModelRequestSchema>;

export const UnloadModelResponseSchema = z.object({
  status: z.literal('unloaded'),
  modelKey: z.string(),
  instanceId: z.string().nullable(),
  message: z.string().optional(),
});

export type UnloadModelResponse = z.infer<typeof UnloadModelResponseSchema>;

export const ActivateModelRequestSchema = z.object({
  modelKey: z.string().min(1, 'modelKey is required'),
  instanceId: z.string().nullable().optional(),
  defaultInference: DefaultInferenceSchema.optional(),
});

export type ActivateModelRequest = z.infer<typeof ActivateModelRequestSchema>;

export const ActivateModelResponseSchema = z.object({
  status: z.literal('activated'),
  modelKey: z.string(),
  instanceId: z.string().nullable(),
  defaultInference: z.record(z.string(), z.any()),
  message: z.string().optional(),
});

export type ActivateModelResponse = z.infer<typeof ActivateModelResponseSchema>;

// ===== Application State Interfaces =====

export interface ActiveModel {
  modelKey: string | null;
  instanceId: string | null;
  defaultInference: Record<string, any>;
}

export interface OperationInfo {
  type: 'model_load' | 'model_unload' | 'inference' | null;
  modelKey?: string;
  progress?: number;
  startedAt?: string;
  elapsedMs?: number;
}

export interface RequestInfo {
  requestId: string;
  status: 'pending' | 'completed' | 'failed';
  tokensGenerated?: number;
  timeMs?: number;
  timestamp: string;
}

export interface DebugState {
  status: 'idle' | 'loading_model' | 'processing_inference' | 'error';
  currentOperation: OperationInfo | null;
  recentRequests: RequestInfo[];
  totalRequests: number;
  totalErrors: number;
}

export interface AppState {
  activeModel: ActiveModel;
  debugState: DebugState;
}

// ===== Debug Event Types =====

export interface DebugEvent {
  type: string;
  data: Record<string, any>;
}
