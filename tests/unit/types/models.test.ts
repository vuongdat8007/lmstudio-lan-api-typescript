import {
  LoadModelRequestSchema,
  UnloadModelRequestSchema,
  ActivateModelRequestSchema,
  DefaultInferenceSchema,
  LoadConfigSchema,
  LoadModelResponseSchema,
  UnloadModelResponseSchema,
  ActivateModelResponseSchema,
} from '../../../src/types/models';

describe('Model Schemas', () => {
  describe('LoadConfigSchema', () => {
    it('should validate valid load config', () => {
      const validConfig = {
        contextLength: 8192,
        gpu: {
          ratio: 1.0,
          layers: 32,
        },
        cpuThreads: 8,
        ropeFrequencyBase: 10000,
        ropeFrequencyScale: 1.0,
      };

      const result = LoadConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });

    it('should validate empty load config', () => {
      const result = LoadConfigSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject negative context length', () => {
      const invalidConfig = {
        contextLength: -1,
      };

      const result = LoadConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should reject invalid GPU ratio', () => {
      const invalidConfig = {
        gpu: {
          ratio: 1.5, // Must be between 0 and 1
        },
      };

      const result = LoadConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });
  });

  describe('DefaultInferenceSchema', () => {
    it('should validate valid inference parameters', () => {
      const validInference = {
        temperature: 0.7,
        maxTokens: 2048,
        topP: 0.9,
        topK: 50,
        repeatPenalty: 1.1,
        stopStrings: ['</s>', '\n\n'],
        stream: true,
      };

      const result = DefaultInferenceSchema.safeParse(validInference);
      expect(result.success).toBe(true);
    });

    it('should validate empty inference parameters', () => {
      const result = DefaultInferenceSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject temperature out of range', () => {
      const invalidInference = {
        temperature: 3.0, // Must be between 0 and 2
      };

      const result = DefaultInferenceSchema.safeParse(invalidInference);
      expect(result.success).toBe(false);
    });

    it('should reject negative max tokens', () => {
      const invalidInference = {
        maxTokens: -100,
      };

      const result = DefaultInferenceSchema.safeParse(invalidInference);
      expect(result.success).toBe(false);
    });

    it('should reject topP out of range', () => {
      const invalidInference = {
        topP: 1.5, // Must be between 0 and 1
      };

      const result = DefaultInferenceSchema.safeParse(invalidInference);
      expect(result.success).toBe(false);
    });
  });

  describe('LoadModelRequestSchema', () => {
    it('should validate valid load model request', () => {
      const validRequest = {
        modelKey: 'qwen2.5-7b-instruct',
        instanceId: 'primary-qwen',
        loadConfig: {
          contextLength: 8192,
          gpu: { ratio: 1.0 },
        },
        ttlSeconds: 3600,
        defaultInference: {
          temperature: 0.7,
          maxTokens: 2048,
        },
        activate: true,
      };

      const result = LoadModelRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.modelKey).toBe('qwen2.5-7b-instruct');
        expect(result.data.activate).toBe(true);
      }
    });

    it('should validate minimal load model request', () => {
      const minimalRequest = {
        modelKey: 'test-model',
      };

      const result = LoadModelRequestSchema.safeParse(minimalRequest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.activate).toBe(true); // Default value
      }
    });

    it('should reject request without modelKey', () => {
      const invalidRequest = {
        activate: true,
      };

      const result = LoadModelRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should reject empty modelKey', () => {
      const invalidRequest = {
        modelKey: '',
      };

      const result = LoadModelRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should reject negative TTL', () => {
      const invalidRequest = {
        modelKey: 'test-model',
        ttlSeconds: -100,
      };

      const result = LoadModelRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });
  });

  describe('UnloadModelRequestSchema', () => {
    it('should validate valid unload request', () => {
      const validRequest = {
        modelKey: 'test-model',
        instanceId: 'instance-1',
      };

      const result = UnloadModelRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should validate unload request with null instanceId', () => {
      const validRequest = {
        modelKey: 'test-model',
        instanceId: null,
      };

      const result = UnloadModelRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should reject request without modelKey', () => {
      const invalidRequest = {
        instanceId: 'instance-1',
      };

      const result = UnloadModelRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });
  });

  describe('ActivateModelRequestSchema', () => {
    it('should validate valid activate request', () => {
      const validRequest = {
        modelKey: 'test-model',
        instanceId: 'instance-1',
        defaultInference: {
          temperature: 0.5,
        },
      };

      const result = ActivateModelRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should validate minimal activate request', () => {
      const validRequest = {
        modelKey: 'test-model',
      };

      const result = ActivateModelRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should reject request without modelKey', () => {
      const invalidRequest = {
        defaultInference: {
          temperature: 0.5,
        },
      };

      const result = ActivateModelRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });
  });

  describe('LoadModelResponseSchema', () => {
    it('should validate valid load response', () => {
      const validResponse = {
        status: 'loaded' as const,
        modelKey: 'test-model',
        instanceId: 'instance-1',
        activated: true,
        message: 'Model loaded successfully',
      };

      const result = LoadModelResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it('should validate response with null instanceId', () => {
      const validResponse = {
        status: 'loaded' as const,
        modelKey: 'test-model',
        instanceId: null,
        activated: false,
      };

      const result = LoadModelResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it('should reject response with wrong status', () => {
      const invalidResponse = {
        status: 'loading', // Must be 'loaded'
        modelKey: 'test-model',
        instanceId: null,
        activated: true,
      };

      const result = LoadModelResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });
  });

  describe('UnloadModelResponseSchema', () => {
    it('should validate valid unload response', () => {
      const validResponse = {
        status: 'unloaded' as const,
        modelKey: 'test-model',
        instanceId: null,
        message: 'Model unloaded successfully',
      };

      const result = UnloadModelResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it('should reject response with wrong status', () => {
      const invalidResponse = {
        status: 'unloading',
        modelKey: 'test-model',
        instanceId: null,
      };

      const result = UnloadModelResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });
  });

  describe('ActivateModelResponseSchema', () => {
    it('should validate valid activate response', () => {
      const validResponse = {
        status: 'activated' as const,
        modelKey: 'test-model',
        instanceId: 'instance-1',
        defaultInference: {
          temperature: 0.7,
          maxTokens: 2048,
        },
        message: 'Model activated successfully',
      };

      const result = ActivateModelResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it('should validate response with empty defaultInference', () => {
      const validResponse = {
        status: 'activated' as const,
        modelKey: 'test-model',
        instanceId: null,
        defaultInference: {},
      };

      const result = ActivateModelResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it('should reject response with wrong status', () => {
      const invalidResponse = {
        status: 'activating',
        modelKey: 'test-model',
        instanceId: null,
        defaultInference: {},
      };

      const result = ActivateModelResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });
  });
});
