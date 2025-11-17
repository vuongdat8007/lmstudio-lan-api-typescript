# Claude Code Integration Guide

## Overview

This guide is for **Claude Code** (or any AI assistant) to integrate with the LM Studio LAN Gateway for programmatic model management and inference.

The gateway provides a complete OpenAI-compatible API with additional model management capabilities via the LM Studio SDK.

---

## Quick Start for Claude Code

### Connection Information

**Gateway URL**: `http://<gateway-host>:8002` (default port)

**Authentication**: API key required via header

```bash
X-API-Key: <your-api-key>
```

### Basic Health Check

```bash
curl http://<gateway-host>:8002/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-11-15T10:30:00Z",
  "uptime": 3600.5
}
```

---

## Complete API Reference

### 1. Model Management

#### List Available Models

```bash
GET /admin/models
```

**Headers:**
```
X-API-Key: your-api-key
```

**Response:**
```json
{
  "loaded": [
    {
      "path": "qwen2-1.5b-instruct",
      "identifier": "primary"
    }
  ],
  "downloaded": [
    {
      "path": "qwen2-1.5b-instruct",
      "size": 1572864000,
      "type": "llm"
    },
    {
      "path": "llama-3.2-3b-instruct",
      "size": 3145728000,
      "type": "llm"
    }
  ]
}
```

**Use Case**: Check what models are available before loading.

---

#### Load a Model

```bash
POST /admin/models/load
```

**Headers:**
```
X-API-Key: your-api-key
Content-Type: application/json
```

**Request Body (Minimal):**
```json
{
  "modelKey": "qwen2-1.5b-instruct",
  "activate": true
}
```

**Request Body (Full Configuration):**
```json
{
  "modelKey": "qwen2-1.5b-instruct",
  "instanceId": "primary",
  "loadConfig": {
    "contextLength": 8192,
    "gpu": {
      "ratio": 1.0,
      "layers": 32
    },
    "cpuThreads": 4,
    "ropeFrequencyBase": 10000,
    "ropeFrequencyScale": 1.0
  },
  "defaultInference": {
    "temperature": 0.7,
    "maxTokens": 1024,
    "topP": 0.9,
    "topK": 40,
    "repeatPenalty": 1.1,
    "stream": false
  },
  "activate": true
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `modelKey` | string | ✅ Yes | Model path from "downloaded" list |
| `instanceId` | string | ❌ No | Unique identifier for multi-instance |
| `loadConfig` | object | ❌ No | Model loading configuration |
| `loadConfig.contextLength` | number | ❌ No | Context window size (e.g., 2048, 4096, 8192) |
| `loadConfig.gpu.ratio` | number | ❌ No | GPU offload ratio (0-1) |
| `loadConfig.gpu.layers` | number | ❌ No | Number of layers to offload to GPU |
| `loadConfig.cpuThreads` | number | ❌ No | Number of CPU threads |
| `loadConfig.ropeFrequencyBase` | number | ❌ No | RoPE frequency base |
| `loadConfig.ropeFrequencyScale` | number | ❌ No | RoPE frequency scale |
| `defaultInference` | object | ❌ No | Default inference parameters |
| `defaultInference.temperature` | number | ❌ No | Sampling temperature (0-2) |
| `defaultInference.maxTokens` | number | ❌ No | Maximum tokens to generate |
| `defaultInference.topP` | number | ❌ No | Nucleus sampling (0-1) |
| `defaultInference.topK` | number | ❌ No | Top-K sampling |
| `defaultInference.repeatPenalty` | number | ❌ No | Repetition penalty |
| `defaultInference.stopStrings` | string[] | ❌ No | Stop sequences |
| `defaultInference.stream` | boolean | ❌ No | Enable streaming |
| `activate` | boolean | ❌ No | Activate as default model (default: true) |

**Response (Success):**
```json
{
  "status": "loaded",
  "modelKey": "qwen2-1.5b-instruct",
  "instanceId": "primary",
  "activated": true,
  "totalTimeMs": 5432,
  "message": "Model loaded successfully via LM Studio SDK"
}
```

**Response (Error):**
```json
{
  "error": "Model not found: invalid-model"
}
```

**Use Cases:**
- Load a model before starting inference
- Switch between models with different configurations
- Load multiple instances of the same model

---

#### Unload a Model

```bash
POST /admin/models/unload
```

**Headers:**
```
X-API-Key: your-api-key
Content-Type: application/json
```

**Request Body:**
```json
{
  "modelKey": "qwen2-1.5b-instruct",
  "instanceId": "primary"
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `modelKey` | string | ✅ Yes | Model path to unload |
| `instanceId` | string | ❌ No | Instance identifier (if multi-instance) |

**Response (Success):**
```json
{
  "status": "unloaded",
  "modelKey": "qwen2-1.5b-instruct",
  "instanceId": "primary",
  "totalTimeMs": 234,
  "message": "Model unloaded successfully via LM Studio SDK"
}
```

**Response (Not Found):**
```json
{
  "status": "not_found",
  "modelKey": "qwen2-1.5b-instruct",
  "instanceId": "primary",
  "message": "Model not found: qwen2-1.5b-instruct (instance: primary)"
}
```

**Use Cases:**
- Free up memory when done with a model
- Switch to a different model
- Clean up before shutting down

---

#### Activate a Model (Without Loading)

```bash
POST /admin/models/activate
```

**Headers:**
```
X-API-Key: your-api-key
Content-Type: application/json
```

**Request Body:**
```json
{
  "modelKey": "qwen2-1.5b-instruct",
  "instanceId": "primary",
  "defaultInference": {
    "temperature": 0.3,
    "maxTokens": 2048
  }
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `modelKey` | string | ✅ Yes | Model path to activate |
| `instanceId` | string | ❌ No | Instance identifier |
| `defaultInference` | object | ❌ No | Default inference parameters |

**Response:**
```json
{
  "status": "activated",
  "modelKey": "qwen2-1.5b-instruct",
  "instanceId": "primary",
  "defaultInference": {
    "temperature": 0.3,
    "maxTokens": 2048
  },
  "message": "Model activated successfully"
}
```

**Use Case**: Change active model or update default inference parameters without reloading.

---

### 2. Inference (OpenAI-Compatible)

**Important**: The gateway supports **flexible routing** for OpenAI endpoints:
- ✅ Standard: `/v1/chat/completions` (recommended)
- ✅ Shorthand: `/chat/completions` (auto-corrected to `/v1/chat/completions`)

Both formats work identically. Use whichever is more convenient.

#### Chat Completions

```bash
POST /v1/chat/completions
# or
POST /chat/completions  (automatically forwarded with /v1/ prefix)
```

**Headers:**
```
X-API-Key: your-api-key
Content-Type: application/json
```

**Request Body (Minimal - with active model):**
```json
{
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "What is the capital of France?"}
  ]
}
```

**Request Body (Full - explicit model):**
```json
{
  "model": "qwen2-1.5b-instruct",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "What is the capital of France?"}
  ],
  "temperature": 0.7,
  "max_tokens": 1024,
  "top_p": 0.9,
  "stream": false
}
```

**Response (Non-streaming):**
```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "qwen2-1.5b-instruct",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "The capital of France is Paris."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 20,
    "completion_tokens": 10,
    "total_tokens": 30
  }
}
```

**Response (Streaming):**
```
data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"qwen2-1.5b-instruct","choices":[{"index":0,"delta":{"role":"assistant","content":"The"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"qwen2-1.5b-instruct","choices":[{"index":0,"delta":{"content":" capital"},"finish_reason":null}]}

data: [DONE]
```

**Auto-Injection Behavior:**
- If `model` is not specified, the active model is automatically injected
- If inference parameters are not specified, defaults from `defaultInference` are used
- You can override defaults on a per-request basis

---

#### Text Completions

```bash
POST /v1/completions
```

**Headers:**
```
X-API-Key: your-api-key
Content-Type: application/json
```

**Request Body:**
```json
{
  "prompt": "Once upon a time",
  "max_tokens": 100,
  "temperature": 0.7
}
```

**Response:**
```json
{
  "id": "cmpl-123",
  "object": "text_completion",
  "created": 1677652288,
  "model": "qwen2-1.5b-instruct",
  "choices": [
    {
      "text": " in a land far away...",
      "index": 0,
      "logprobs": null,
      "finish_reason": "length"
    }
  ],
  "usage": {
    "prompt_tokens": 4,
    "completion_tokens": 100,
    "total_tokens": 104
  }
}
```

---

#### Embeddings

```bash
POST /v1/embeddings
```

**Headers:**
```
X-API-Key: your-api-key
Content-Type: application/json
```

**Request Body:**
```json
{
  "input": "The quick brown fox jumps over the lazy dog",
  "model": "text-embedding-model"
}
```

**Response:**
```json
{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "embedding": [0.123, 0.456, 0.789, ...],
      "index": 0
    }
  ],
  "model": "text-embedding-model",
  "usage": {
    "prompt_tokens": 10,
    "total_tokens": 10
  }
}
```

---

### 3. Real-Time Debugging

#### Debug Stream (SSE)

```bash
GET /debug/stream
```

**Headers:**
```
X-API-Key: your-api-key
Accept: text/event-stream
```

**Response (Server-Sent Events):**
```
event: connected
data: {"timestamp":"2025-11-15T10:30:00Z","message":"Debug stream connected"}

event: model_load_start
data: {"modelKey":"qwen2-1.5b-instruct","instanceId":"primary","loadConfig":{"contextLength":8192},"timestamp":"2025-11-15T10:30:01Z"}

event: model_load_complete
data: {"modelKey":"qwen2-1.5b-instruct","instanceId":"primary","activated":true,"totalTimeMs":5432,"timestamp":"2025-11-15T10:30:06Z"}

event: inference_start
data: {"requestId":"req_123","method":"POST","path":"/v1/chat/completions","timestamp":"2025-11-15T10:31:00Z"}

event: inference_complete
data: {"requestId":"req_123","totalTimeMs":1520,"timestamp":"2025-11-15T10:31:02Z"}

event: error
data: {"operation":"model_load","modelKey":"invalid-model","error":"Model not found","timestamp":"2025-11-15T10:32:00Z"}
```

**Event Types:**
- `connected` - Initial connection
- `model_load_start` - Model loading started
- `model_load_complete` - Model loaded successfully
- `model_unload_start` - Model unloading started
- `model_unload_complete` - Model unloaded successfully
- `model_activate` - Model activated
- `inference_start` - Inference request started
- `inference_complete` - Inference completed
- `error` - Error occurred

**Use Case**: Monitor operations in real-time for debugging or logging.

---

#### Debug Status

```bash
GET /debug/status
```

**Headers:**
```
X-API-Key: your-api-key
```

**Response:**
```json
{
  "status": "idle",
  "currentOperation": null,
  "activeModel": {
    "modelKey": "qwen2-1.5b-instruct",
    "instanceId": "primary",
    "defaultInference": {
      "temperature": 0.7,
      "maxTokens": 1024
    }
  },
  "recentRequests": [
    {
      "requestId": "req_123",
      "status": "completed",
      "timeMs": 1520,
      "timestamp": "2025-11-15T10:31:02Z"
    }
  ],
  "totalRequests": 42,
  "totalErrors": 1
}
```

**Use Case**: Check current gateway state and recent activity.

---

#### Debug Metrics

```bash
GET /debug/metrics
```

**Headers:**
```
X-API-Key: your-api-key
```

**Response:**
```json
{
  "modelInfo": {
    "modelKey": "qwen2-1.5b-instruct",
    "instanceId": "primary",
    "defaultInference": {
      "temperature": 0.7,
      "maxTokens": 1024
    }
  },
  "performance": {
    "totalRequests": 42,
    "totalErrors": 1,
    "errorRate": 2.38,
    "recentRequestCount": 42,
    "completedRequestCount": 41,
    "avgResponseTimeMs": 1345.67,
    "minResponseTimeMs": 234,
    "maxResponseTimeMs": 5678,
    "medianResponseTimeMs": 1200
  },
  "recentActivity": {
    "last10Requests": [...]
  },
  "system": {
    "uptime": 3600.5,
    "uptimeFormatted": "1h 5s",
    "memoryUsage": {
      "rss": 92.35,
      "heapTotal": 19.08,
      "heapUsed": 17.21,
      "external": 4.41
    },
    "nodeVersion": "v20.10.0",
    "platform": "win32"
  },
  "currentOperation": null
}
```

**Use Case**: Monitor performance and resource usage.

---

## Workflows for Claude Code

### Workflow 1: Simple Inference with Active Model

**Scenario**: You want to ask a question without managing models.

```bash
# Step 1: Check if a model is active
GET /debug/status

# If no active model, load one:
POST /admin/models/load
{
  "modelKey": "qwen2-1.5b-instruct",
  "activate": true
}

# Step 2: Make inference request
POST /v1/chat/completions
{
  "messages": [
    {"role": "user", "content": "What is 2+2?"}
  ]
}
# Model is auto-injected from active model
```

---

### Workflow 2: Load Specific Model with Configuration

**Scenario**: You need a model with specific context length and GPU settings.

```bash
# Step 1: Check available models
GET /admin/models

# Step 2: Load with configuration
POST /admin/models/load
{
  "modelKey": "llama-3.2-3b-instruct",
  "loadConfig": {
    "contextLength": 16384,
    "gpu": {
      "ratio": 1.0,
      "layers": 40
    }
  },
  "defaultInference": {
    "temperature": 0.3,
    "maxTokens": 2048
  },
  "activate": true
}

# Step 3: Make inference requests
POST /v1/chat/completions
{
  "messages": [
    {"role": "user", "content": "Explain quantum computing"}
  ]
}
# Uses defaults: temperature 0.3, maxTokens 2048
```

---

### Workflow 3: Multi-Instance for Different Tasks

**Scenario**: You want creative and factual responses from the same model.

```bash
# Load creative instance
POST /admin/models/load
{
  "modelKey": "qwen2-1.5b-instruct",
  "instanceId": "creative",
  "defaultInference": {
    "temperature": 1.2,
    "topP": 0.95
  }
}

# Load factual instance
POST /admin/models/load
{
  "modelKey": "qwen2-1.5b-instruct",
  "instanceId": "factual",
  "defaultInference": {
    "temperature": 0.1,
    "topP": 0.5
  }
}

# Use creative instance
POST /admin/models/activate
{
  "modelKey": "qwen2-1.5b-instruct",
  "instanceId": "creative"
}

POST /v1/chat/completions
{
  "messages": [
    {"role": "user", "content": "Write a story"}
  ]
}

# Switch to factual instance
POST /admin/models/activate
{
  "modelKey": "qwen2-1.5b-instruct",
  "instanceId": "factual"
}

POST /v1/chat/completions
{
  "messages": [
    {"role": "user", "content": "What is the capital of France?"}
  ]
}
```

---

### Workflow 4: Streaming Responses

**Scenario**: You want to receive responses incrementally.

```bash
POST /v1/chat/completions
{
  "messages": [
    {"role": "user", "content": "Write a long story"}
  ],
  "stream": true
}

# Response arrives as SSE chunks:
# data: {"choices":[{"delta":{"content":"Once"}}]}
# data: {"choices":[{"delta":{"content":" upon"}}]}
# data: {"choices":[{"delta":{"content":" a"}}]}
# ...
# data: [DONE]
```

---

### Workflow 5: Clean Up After Work

**Scenario**: Free up memory when done.

```bash
# Unload models
POST /admin/models/unload
{
  "modelKey": "qwen2-1.5b-instruct",
  "instanceId": "creative"
}

POST /admin/models/unload
{
  "modelKey": "qwen2-1.5b-instruct",
  "instanceId": "factual"
}

# Verify all unloaded
GET /admin/models
# Should show empty "loaded" array
```

---

## Error Handling

### Common Error Responses

#### 401 Unauthorized
```json
{
  "error": "Unauthorized"
}
```
**Cause**: Missing or invalid API key
**Solution**: Check `X-API-Key` header

---

#### 403 Forbidden
```json
{
  "error": "Forbidden"
}
```
**Cause**: IP not in allowlist
**Solution**: Check `IP_ALLOWLIST` configuration

---

#### 400 Bad Request
```json
{
  "error": "Validation failed",
  "details": [
    {
      "code": "invalid_type",
      "expected": "string",
      "received": "undefined",
      "path": ["modelKey"],
      "message": "Required"
    }
  ]
}
```
**Cause**: Invalid request body
**Solution**: Check request schema

---

#### 404 Not Found
```json
{
  "status": "not_found",
  "modelKey": "invalid-model",
  "message": "Model not found: invalid-model"
}
```
**Cause**: Model doesn't exist or not loaded
**Solution**: Use `GET /admin/models` to check available models

---

#### 503 Service Unavailable
```json
{
  "error": "Failed to connect to LM Studio SDK after 3 attempts. Ensure LM Studio is running and the API server is enabled."
}
```
**Cause**: LM Studio not running or API server disabled
**Solution**: Start LM Studio and enable API server

---

## Claude Code Integration Examples

### Example 1: Basic Task Execution

```typescript
// Claude Code internal logic (pseudocode)

async function executeUserTask(task: string) {
  // 1. Check gateway status
  const status = await fetch('http://gateway:8002/debug/status', {
    headers: { 'X-API-Key': 'your-key' }
  }).then(r => r.json());

  // 2. Load model if none active
  if (!status.activeModel.modelKey) {
    await fetch('http://gateway:8002/admin/models/load', {
      method: 'POST',
      headers: {
        'X-API-Key': 'your-key',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        modelKey: 'qwen2-1.5b-instruct',
        activate: true
      })
    });
  }

  // 3. Make inference request
  const response = await fetch('http://gateway:8002/v1/chat/completions', {
    method: 'POST',
    headers: {
      'X-API-Key': 'your-key',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messages: [
        { role: 'user', content: task }
      ]
    })
  }).then(r => r.json());

  return response.choices[0].message.content;
}
```

---

### Example 2: Context-Aware Model Selection

```typescript
// Claude Code chooses model based on task complexity

async function selectAndLoadModel(taskComplexity: 'simple' | 'complex') {
  const models = await fetch('http://gateway:8002/admin/models', {
    headers: { 'X-API-Key': 'your-key' }
  }).then(r => r.json());

  const modelKey = taskComplexity === 'simple'
    ? 'qwen2-1.5b-instruct'
    : 'llama-3.2-3b-instruct';

  const contextLength = taskComplexity === 'simple' ? 4096 : 16384;

  await fetch('http://gateway:8002/admin/models/load', {
    method: 'POST',
    headers: {
      'X-API-Key': 'your-key',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      modelKey,
      loadConfig: { contextLength },
      activate: true
    })
  });
}
```

---

### Example 3: Performance Monitoring

```typescript
// Claude Code monitors performance and switches models if too slow

async function monitorAndOptimize() {
  const metrics = await fetch('http://gateway:8002/debug/metrics', {
    headers: { 'X-API-Key': 'your-key' }
  }).then(r => r.json());

  // If average response time > 3 seconds, switch to smaller model
  if (metrics.performance.avgResponseTimeMs > 3000) {
    console.log('Performance degraded, switching to smaller model');

    await fetch('http://gateway:8002/admin/models/load', {
      method: 'POST',
      headers: {
        'X-API-Key': 'your-key',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        modelKey: 'qwen2-1.5b-instruct',
        loadConfig: {
          contextLength: 2048,
          gpu: { ratio: 1.0 }
        },
        activate: true
      })
    });
  }
}
```

---

## Configuration Reference

### Environment Variables on Gateway

These are configured on the gateway server, not by Claude Code:

```env
# LM Studio connection
LMSTUDIO_BASE_URL=http://127.0.0.1:1234

# Gateway server
GATEWAY_HOST=0.0.0.0
GATEWAY_PORT=8002

# Security
GATEWAY_API_KEY=your-secret-key-here
IP_ALLOWLIST=192.168.0.0/24,10.0.0.0/24

# Optional
REQUIRE_AUTH_FOR_HEALTH=false
LOG_LEVEL=info
NODE_ENV=production
```

### Claude Code Configuration

**Required:**
- Gateway URL: `http://<gateway-host>:8002`
- API Key: Value of `GATEWAY_API_KEY` from gateway

**Optional:**
- Timeout: Recommended 60s for model loading, 10s for inference
- Retry logic: 3 attempts with exponential backoff

---

## Security Best Practices

### For Claude Code Integration

1. **Store API Key Securely**
   - Never hardcode API keys
   - Use environment variables or secure storage
   - Rotate keys regularly

2. **Validate Responses**
   - Check HTTP status codes
   - Validate JSON structure
   - Handle errors gracefully

3. **Rate Limiting**
   - Respect gateway capacity
   - Implement exponential backoff on errors
   - Don't spam model load/unload operations

4. **Clean Up Resources**
   - Unload models when done with long-running tasks
   - Monitor memory usage via `/debug/metrics`
   - Handle connection failures gracefully

---

## Troubleshooting

### Connection Issues

**Problem**: Cannot connect to gateway

**Solutions:**
1. Verify gateway is running: `curl http://gateway:8002/health`
2. Check network connectivity
3. Verify IP is in allowlist
4. Check firewall rules

---

### Authentication Errors

**Problem**: 401 Unauthorized

**Solutions:**
1. Verify API key is correct
2. Check header format: `X-API-Key: your-key`
3. Ensure API key authentication is enabled on gateway

---

### Model Load Failures

**Problem**: Model fails to load

**Solutions:**
1. Check model exists: `GET /admin/models`
2. Verify sufficient memory (model needs ~1.5-2x its size)
3. Try loading with lower GPU ratio
4. Check LM Studio is running

---

### Slow Responses

**Problem**: Inference takes too long

**Solutions:**
1. Check `/debug/metrics` for performance stats
2. Reduce `contextLength` in loadConfig
3. Increase `gpu.ratio` for faster inference
4. Use smaller model for simple tasks

---

## Summary for Claude Code

### Essential Endpoints

1. **Health Check**: `GET /health`
2. **List Models**: `GET /admin/models`
3. **Load Model**: `POST /admin/models/load`
4. **Inference**: `POST /v1/chat/completions`
5. **Status**: `GET /debug/status`

### Recommended Flow

```
1. Check health
2. Check if model active (GET /debug/status)
3. Load model if needed (POST /admin/models/load)
4. Make inference requests (POST /v1/chat/completions)
5. Unload when done (POST /admin/models/unload)
```

### Key Features

- ✅ OpenAI-compatible API
- ✅ Automatic model/parameter injection
- ✅ Real model loading via SDK
- ✅ Multi-instance support
- ✅ Real-time monitoring
- ✅ Production-ready error handling

### Quick Reference

| Task | Endpoint | Method |
|------|----------|--------|
| Health check | `/health` | GET |
| List models | `/admin/models` | GET |
| Load model | `/admin/models/load` | POST |
| Unload model | `/admin/models/unload` | POST |
| Activate model | `/admin/models/activate` | POST |
| Chat completion | `/v1/chat/completions` | POST |
| Text completion | `/v1/completions` | POST |
| Embeddings | `/v1/embeddings` | POST |
| Debug status | `/debug/status` | GET |
| Debug metrics | `/debug/metrics` | GET |
| Debug stream | `/debug/stream` | GET (SSE) |

---

**Ready to integrate! 🚀**

For complete technical details, see:
- [SDK_INTEGRATION.md](SDK_INTEGRATION.md) - SDK integration guide
- [DEBUG_API.md](DEBUG_API.md) - Debug API documentation
- [README.md](README.md) - Project overview
