# LM Studio LAN Gateway - API Documentation

## Table of Contents

- [Introduction](#introduction)
- [Authentication](#authentication)
- [Admin API](#admin-api)
- [Inference API (OpenAI-Compatible)](#inference-api-openai-compatible)
- [Debug API](#debug-api)
- [Health Check](#health-check)
- [Error Responses](#error-responses)
- [Code Examples](#code-examples)

---

## Introduction

The **LM Studio LAN Gateway** is a production-ready TypeScript/Node.js application that provides secure LAN access to LM Studio's language model capabilities.

### Key Features

- ✅ **OpenAI-Compatible API** - Drop-in replacement for OpenAI API endpoints
- ✅ **Model Management** - Load, unload, and configure models programmatically
- ✅ **Flexible Routing** - Supports both `/v1/endpoint` and `/endpoint` formats
- ✅ **Real-Time Monitoring** - Server-Sent Events for debugging and metrics
- ✅ **Token Metrics** - Track throughput (tokens/sec) and usage statistics
- ✅ **Security** - API key authentication and IP allowlisting
- ✅ **Auto-Injection** - Automatic model and parameter injection for convenience

### Base URL

```
http://[gateway-host]:[gateway-port]
```

**Default**: `http://localhost:8002`

**LAN Example**: `http://10.0.0.181:8002`

---

## Authentication

All endpoints (except `/health` if configured) require authentication.

### API Key Authentication

**Header**: `X-API-Key`

**Example**:
```bash
curl -H "X-API-Key: your-secret-key" http://localhost:8002/admin/models
```

### IP Allowlist

Configure in `.env`:
```env
IP_ALLOWLIST=192.168.0.0/24,10.0.0.0/24
```

Supports:
- Single IPs: `10.0.0.2`
- CIDR ranges: `192.168.0.0/24`
- Multiple entries: `10.0.0.2,192.168.0.0/24`
- Wildcard (dev only): `*`

---

## Admin API

Endpoints for managing models and gateway configuration.

### GET /admin/models

List all available and loaded models.

**Authentication**: Required

**Request**:
```bash
GET /admin/models
Headers:
  X-API-Key: your-secret-key
```

**Response**: `200 OK`
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
      "size": 3221225472,
      "type": "llm"
    }
  ]
}
```

**Fields**:
- `loaded` - Models currently loaded in LM Studio memory
  - `path` - Model identifier/path
  - `identifier` - Instance ID (if multiple instances)
- `downloaded` - Models available on disk
  - `path` - Model identifier/path
  - `size` - Size in bytes
  - `type` - Model type (usually "llm")

---

### POST /admin/models/load

Load a model with custom configuration.

**Authentication**: Required

**Request**:
```bash
POST /admin/models/load
Headers:
  X-API-Key: your-secret-key
  Content-Type: application/json

Body:
{
  "modelKey": "qwen2-1.5b-instruct",
  "instanceId": "primary",
  "loadConfig": {
    "contextLength": 8192,
    "gpu": {
      "ratio": 1.0,
      "layers": 32
    },
    "cpuThreads": 4
  },
  "defaultInference": {
    "temperature": 0.7,
    "maxTokens": 1024,
    "topP": 0.9
  },
  "activate": true
}
```

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `modelKey` | string | ✅ Yes | Model identifier (from `/admin/models`) |
| `instanceId` | string | No | Custom instance ID for multi-instance loading |
| `loadConfig` | object | No | Model loading configuration |
| `loadConfig.contextLength` | number | No | Context window size (e.g., 2048, 4096, 8192) |
| `loadConfig.gpu` | object | No | GPU offload configuration |
| `loadConfig.gpu.ratio` | number | No | GPU offload ratio (0.0 to 1.0) |
| `loadConfig.gpu.layers` | number | No | Number of layers to offload |
| `loadConfig.cpuThreads` | number | No | CPU threads for inference |
| `loadConfig.ropeFrequencyBase` | number | No | RoPE frequency base |
| `loadConfig.ropeFrequencyScale` | number | No | RoPE frequency scale |
| `defaultInference` | object | No | Default inference parameters |
| `defaultInference.temperature` | number | No | Sampling temperature (0.0 to 2.0) |
| `defaultInference.maxTokens` | number | No | Maximum tokens to generate |
| `defaultInference.topP` | number | No | Nucleus sampling (0.0 to 1.0) |
| `defaultInference.topK` | number | No | Top-K sampling |
| `defaultInference.repeatPenalty` | number | No | Repetition penalty |
| `defaultInference.stopStrings` | string[] | No | Stop sequences |
| `defaultInference.stream` | boolean | No | Enable streaming by default |
| `activate` | boolean | No | Set as active model (default: true) |

**Response**: `200 OK`
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

**Error Responses**:
- `400 Bad Request` - Invalid request body
- `404 Not Found` - Model not found
- `503 Service Unavailable` - LM Studio not running or SDK connection failed

---

### POST /admin/models/unload

Unload a model from memory.

**Authentication**: Required

**Request**:
```bash
POST /admin/models/unload
Headers:
  X-API-Key: your-secret-key
  Content-Type: application/json

Body:
{
  "modelKey": "qwen2-1.5b-instruct",
  "instanceId": "primary"
}
```

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `modelKey` | string | ✅ Yes | Model identifier |
| `instanceId` | string | No | Instance ID (if multiple instances) |

**Response**: `200 OK`
```json
{
  "status": "unloaded",
  "modelKey": "qwen2-1.5b-instruct",
  "instanceId": "primary",
  "totalTimeMs": 234,
  "message": "Model unloaded successfully via LM Studio SDK"
}
```

**Error Responses**:
- `404 Not Found` - Model not loaded
- `503 Service Unavailable` - LM Studio SDK connection failed

---

### POST /admin/models/activate

Set a model as the active default (without loading).

**Authentication**: Required

**Request**:
```bash
POST /admin/models/activate
Headers:
  X-API-Key: your-secret-key
  Content-Type: application/json

Body:
{
  "modelKey": "qwen2-1.5b-instruct",
  "instanceId": "primary",
  "defaultInference": {
    "temperature": 0.7,
    "maxTokens": 1024
  }
}
```

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `modelKey` | string | ✅ Yes | Model identifier |
| `instanceId` | string | No | Instance ID |
| `defaultInference` | object | No | Default inference parameters |

**Response**: `200 OK`
```json
{
  "status": "activated",
  "modelKey": "qwen2-1.5b-instruct",
  "instanceId": "primary",
  "defaultInference": {
    "temperature": 0.7,
    "maxTokens": 1024
  },
  "message": "Model activated successfully"
}
```

---

## Inference API (OpenAI-Compatible)

OpenAI-compatible endpoints for chat completions and text generation.

### Flexible Routing

The gateway supports **two path formats**:

| Standard Format | Shorthand Format |
|----------------|------------------|
| `/v1/chat/completions` | `/chat/completions` |
| `/v1/completions` | `/completions` |
| `/v1/models` | `/models` |
| `/v1/embeddings` | `/embeddings` |

Both formats work identically. The `/v1/` prefix is auto-added when needed.

---

### POST /v1/chat/completions

Generate chat completions using the loaded model.

**Authentication**: Required

**Flexible Routing**: Also available at `/chat/completions`

**Request**:
```bash
POST /v1/chat/completions
Headers:
  X-API-Key: your-secret-key
  Content-Type: application/json

Body:
{
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful assistant."
    },
    {
      "role": "user",
      "content": "What is the capital of France?"
    }
  ],
  "model": "qwen2-1.5b-instruct",
  "temperature": 0.7,
  "max_tokens": 1024,
  "stream": false
}
```

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `messages` | array | ✅ Yes | Array of message objects |
| `messages[].role` | string | ✅ Yes | Role: "system", "user", or "assistant" |
| `messages[].content` | string | ✅ Yes | Message content |
| `model` | string | No* | Model identifier (auto-injected if active model set) |
| `temperature` | number | No | Sampling temperature (0.0 to 2.0) |
| `max_tokens` | number | No | Maximum tokens to generate |
| `top_p` | number | No | Nucleus sampling (0.0 to 1.0) |
| `top_k` | number | No | Top-K sampling |
| `repeat_penalty` | number | No | Repetition penalty |
| `stop` | string[] | No | Stop sequences |
| `stream` | boolean | No | Enable streaming (default: false) |

**\*Auto-Injection**: If `model` is not specified and an active model is set, the gateway automatically injects it.
- When a model instance has an `instanceId`, the gateway injects the `instanceId` (e.g., "primary")
- When no `instanceId` is set, the gateway injects the `modelKey` (e.g., "qwen2-1.5b-instruct")
- This ensures LM Studio routes requests to the correct loaded model instance

**Response**: `200 OK` (Non-Streaming)
```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1700000000,
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
    "prompt_tokens": 25,
    "completion_tokens": 8,
    "total_tokens": 33
  }
}
```

**Response**: `200 OK` (Streaming)

Content-Type: `text/event-stream`

```
data: {"id":"chatcmpl-abc123","choices":[{"delta":{"role":"assistant","content":"The"},"index":0}]}

data: {"id":"chatcmpl-abc123","choices":[{"delta":{"content":" capital"},"index":0}]}

data: {"id":"chatcmpl-abc123","choices":[{"delta":{"content":" of"},"index":0}]}

...

data: [DONE]
```

---

### POST /v1/completions

Generate text completions.

**Authentication**: Required

**Flexible Routing**: Also available at `/completions`

**Request**:
```bash
POST /v1/completions
Headers:
  X-API-Key: your-secret-key
  Content-Type: application/json

Body:
{
  "prompt": "Once upon a time",
  "model": "qwen2-1.5b-instruct",
  "max_tokens": 100,
  "temperature": 0.8
}
```

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | ✅ Yes | Text prompt |
| `model` | string | No* | Model identifier (auto-injected) |
| `max_tokens` | number | No | Maximum tokens to generate |
| `temperature` | number | No | Sampling temperature |
| `stream` | boolean | No | Enable streaming |

**Response**: `200 OK`
```json
{
  "id": "cmpl-abc123",
  "object": "text_completion",
  "created": 1700000000,
  "model": "qwen2-1.5b-instruct",
  "choices": [
    {
      "text": " in a land far away, there lived a brave knight...",
      "index": 0,
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

### GET /v1/models

List available models.

**Authentication**: Required

**Flexible Routing**: Also available at `/models`

**Request**:
```bash
GET /v1/models
Headers:
  X-API-Key: your-secret-key
```

**Response**: `200 OK`
```json
{
  "object": "list",
  "data": [
    {
      "id": "qwen2-1.5b-instruct",
      "object": "model",
      "created": 1700000000,
      "owned_by": "lmstudio"
    }
  ]
}
```

---

## Debug API

Real-time monitoring and performance metrics.

### GET /debug/stream

Server-Sent Events stream for real-time debugging.

**Authentication**: Required

**Request**:
```bash
GET /debug/stream
Headers:
  X-API-Key: your-secret-key
  Accept: text/event-stream
```

**Response**: `200 OK`

Content-Type: `text/event-stream`

```
event: connected
data: {"timestamp":"2025-11-16T10:00:00Z","message":"Debug stream connected"}

event: model_load_start
data: {"modelKey":"qwen2-1.5b-instruct","instanceId":"primary","timestamp":"2025-11-16T10:00:05Z"}

event: model_load_progress
data: {"modelKey":"qwen2-1.5b-instruct","instanceId":"primary","progress":14.6,"progressRaw":0.146,"timestamp":"2025-11-16T10:00:06Z"}

event: model_load_progress
data: {"modelKey":"qwen2-1.5b-instruct","instanceId":"primary","progress":33.1,"progressRaw":0.331,"timestamp":"2025-11-16T10:00:07Z"}

event: model_load_progress
data: {"modelKey":"qwen2-1.5b-instruct","instanceId":"primary","progress":51.4,"progressRaw":0.514,"timestamp":"2025-11-16T10:00:08Z"}

event: model_load_complete
data: {"modelKey":"qwen2-1.5b-instruct","activated":true,"totalTimeMs":5432,"timestamp":"2025-11-16T10:00:10Z"}

event: inference_start
data: {"requestId":"req_1234567_abc","method":"POST","path":"/v1/chat/completions","timestamp":"2025-11-16T10:01:00Z"}

event: debug_log
data: {"timestamp":"2025-11-16 10:01:00","level":"INFO","message":"[Client=ABC123][Endpoint=chatCompletions] Running chat completion","raw":"[2025-11-16 10:01:00][INFO] [Client=ABC123][Endpoint=chatCompletions] Running chat completion","timestamp":"2025-11-16T10:01:00Z"}

event: debug_log
data: {"timestamp":"2025-11-16 10:01:00","level":"DEBUG","message":"[LM Studio] GPU Configuration: Strategy: evenly","raw":"[2025-11-16 10:01:00][DEBUG] [LM Studio] GPU Configuration: Strategy: evenly","timestamp":"2025-11-16T10:01:00Z"}

event: inference_complete
data: {"requestId":"req_1234567_abc","totalTimeMs":7850,"tokenUsage":{"promptTokens":25,"completionTokens":50,"totalTokens":75},"timestamp":"2025-11-16T10:01:08Z"}

event: lmstudio_chat_start
data: {"message":"Running chat completion on conversation with 158 messages","timestamp":"2025-11-16T10:01:00Z"}

event: lmstudio_sampling_params
data: {"repeat_penalty":1.1,"top_k":40,"top_p":0.95,"temp":0.0,"timestamp":"2025-11-16T10:01:00Z"}

event: lmstudio_prompt_progress
data: {"progress":36.6,"message":"Prompt processing progress: 36.6%","timestamp":"2025-11-16T10:01:01Z"}

event: lmstudio_cache_stats
data: {"reused":2158,"total":5889,"percentage":36.6,"prefix":2158,"nonPrefix":0,"message":"Cache reuse summary: 2158/5889 of prompt (36.6446%), 2158 prefix, 0 non-prefix","timestamp":"2025-11-16T10:01:01Z"}

event: lmstudio_token_info
data: {"n_ctx":12032,"n_batch":512,"n_predict":-1,"n_keep":2198,"totalPromptTokens":5889,"promptTokensToDecode":3731,"timestamp":"2025-11-16T10:01:01Z"}

event: error
data: {"requestId":"req_7654321_xyz","error":"Model not found","timestamp":"2025-11-16T10:02:00Z"}
```

**Event Types**:

### Gateway Events

| Event | Description | Data Fields |
|-------|-------------|-------------|
| `connected` | Client connected | `timestamp`, `message` |
| `model_load_start` | Model loading began | `modelKey`, `instanceId`, `loadConfig` |
| `model_load_progress` | Model loading progress update | `modelKey`, `instanceId`, `progress` (%), `progressRaw` (0-1) |
| `model_load_complete` | Model loaded successfully | `modelKey`, `activated`, `totalTimeMs` |
| `model_unload_start` | Model unloading began | `modelKey`, `instanceId` |
| `model_unload_complete` | Model unloaded | `modelKey`, `totalTimeMs` |
| `model_activate` | Model activated | `modelKey`, `instanceId` |
| `inference_start` | Inference request started | `requestId`, `method`, `path` |
| `inference_complete` | Inference completed | `requestId`, `totalTimeMs`, `tokenUsage` |
| `error` | Error occurred | `requestId`, `error`, `operation` |

### LM Studio Log Events (when log monitoring enabled)

| Event | Description | Data Fields |
|-------|-------------|-------------|
| `debug_log` | Raw log entry from LM Studio (all logs) | `timestamp`, `level`, `message`, `raw` |
| `lmstudio_chat_start` | Chat completion started | `message` |
| `lmstudio_sampling_params` | Sampling parameters for inference | `repeat_penalty`, `top_k`, `top_p`, `temp`, etc. |
| `lmstudio_prompt_progress` | Prompt processing progress | `progress` (%), `message` |
| `lmstudio_cache_stats` | KV cache reuse statistics | `reused`, `total`, `percentage`, `prefix`, `nonPrefix` |
| `lmstudio_token_info` | Token and batch configuration | `n_ctx`, `n_batch`, `n_predict`, `totalPromptTokens`, etc. |
| `lmstudio_processing_start` | Begin processing prompt | `message` |
| `lmstudio_month_transition` | Log directory switched to new month | `oldDirectory`, `newDirectory`, `newLogFile`, `timestamp` |

**Notes**:
- The `model_load_progress` event is emitted multiple times during model loading, providing real-time progress updates from 0% to 100%. The `progress` field is a percentage (0-100) with 1 decimal place, while `progressRaw` is the raw progress value (0.0-1.0) from the LM Studio SDK.
- LM Studio log events require log monitoring to be enabled via `ENABLE_LOG_MONITORING=true` and a valid `LMSTUDIO_LOG_DIR` path.
- Log monitoring provides deep visibility into LM Studio's internal operations, including sampling parameters, cache efficiency, and prompt processing.
- The `lmstudio_month_transition` event is triggered when the gateway automatically switches from one month's log directory to the next (e.g., from `2025-11` to `2025-12`). This happens via both periodic checks (every 10 minutes) and real-time parent directory watching.

---

### GET /debug/status

Current gateway status snapshot.

**Authentication**: Required

**Request**:
```bash
GET /debug/status
Headers:
  X-API-Key: your-secret-key
```

**Response**: `200 OK`
```json
{
  "status": "idle",
  "currentOperation": null,
  "activeModel": {
    "modelKey": "qwen2-1.5b-instruct",
    "instanceId": "primary"
  },
  "recentRequests": [
    {
      "requestId": "req_1234567_abc",
      "status": "completed",
      "timeMs": 7850,
      "timestamp": "2025-11-16T10:01:08Z"
    }
  ],
  "totalRequests": 142,
  "totalErrors": 3
}
```

**Fields**:
- `status` - Current gateway status: "idle", "loading_model", "processing_inference", "error"
- `currentOperation` - Active operation details (null if idle)
- `activeModel` - Currently active model info
- `recentRequests` - Last 10 requests
- `totalRequests` - Total requests processed
- `totalErrors` - Total errors encountered

---

### GET /debug/metrics

Performance metrics and token throughput statistics.

**Authentication**: Required

**Request**:
```bash
GET /debug/metrics
Headers:
  X-API-Key: your-secret-key
```

**Response**: `200 OK`
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
    "totalRequests": 142,
    "totalErrors": 3,
    "errorRate": 2.11,
    "recentRequestCount": 100,
    "completedRequestCount": 95,
    "avgResponseTimeMs": 7850.50,
    "minResponseTimeMs": 3200,
    "maxResponseTimeMs": 15600,
    "medianResponseTimeMs": 7500,
    "avgTokensPerSec": 23.5,
    "totalTokensProcessed": 4500,
    "requestsWithTokenData": 30,
    "tokenStats": {
      "totalPromptTokens": 1200,
      "totalCompletionTokens": 3300,
      "avgPromptTokens": 40.0,
      "avgCompletionTokens": 110.0
    }
  },
  "recentActivity": {
    "last10Requests": [
      {
        "requestId": "req_1234567_abc",
        "status": "completed",
        "timeMs": 7850,
        "timestamp": "2025-11-16T10:01:08Z"
      }
    ]
  },
  "system": {
    "uptime": 86400,
    "uptimeFormatted": "1d 0h 0m 0s",
    "memoryUsage": {
      "rss": 87.25,
      "heapTotal": 45.50,
      "heapUsed": 38.75,
      "external": 2.15
    },
    "nodeVersion": "v20.10.0",
    "platform": "win32"
  },
  "currentOperation": null
}
```

**Token Metrics Explanation**:
- `avgTokensPerSec` - Average throughput (tokens per second)
- `totalTokensProcessed` - Cumulative token count
- `requestsWithTokenData` - Requests with token usage info (non-streaming only)
- `tokenStats` - Detailed token breakdown

**Note**: Token metrics are only available for **non-streaming requests**. Streaming responses don't reliably include token usage data in SSE format.

---

## Health Check

### GET /health

Simple health check endpoint.

**Authentication**: Optional (configurable via `REQUIRE_AUTH_FOR_HEALTH`)

**Request**:
```bash
GET /health
```

**Response**: `200 OK`
```json
{
  "status": "ok",
  "timestamp": "2025-11-16T10:00:00Z",
  "uptime": 86400
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message description",
  "details": {
    "field": "Additional context (optional)"
  }
}
```

### Common HTTP Status Codes

| Status Code | Meaning | Common Causes |
|-------------|---------|---------------|
| `400 Bad Request` | Invalid request | Missing required fields, invalid JSON, validation errors |
| `401 Unauthorized` | Authentication failed | Missing or invalid API key |
| `403 Forbidden` | Access denied | IP not in allowlist |
| `404 Not Found` | Resource not found | Unknown endpoint, model not found |
| `500 Internal Server Error` | Server error | Unexpected error |
| `503 Service Unavailable` | Service unavailable | LM Studio not running, SDK connection failed |

### Example Error Responses

**401 Unauthorized**:
```json
{
  "error": "Unauthorized"
}
```

**400 Bad Request (Validation Error)**:
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

**404 Not Found**:
```json
{
  "error": "Model not found: invalid-model"
}
```

**503 Service Unavailable**:
```json
{
  "error": "Failed to connect to LM Studio SDK after 3 attempts. Ensure LM Studio is running and the API server is enabled."
}
```

---

## Code Examples

### JavaScript/TypeScript (using fetch)

```javascript
// Admin: Load a model
const loadModel = async () => {
  const response = await fetch('http://localhost:8002/admin/models/load', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'your-secret-key'
    },
    body: JSON.stringify({
      modelKey: 'qwen2-1.5b-instruct',
      activate: true,
      defaultInference: {
        temperature: 0.7,
        maxTokens: 1024
      }
    })
  });

  const data = await response.json();
  console.log('Model loaded:', data);
};

// Inference: Chat completion
const chatCompletion = async () => {
  const response = await fetch('http://localhost:8002/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'your-secret-key'
    },
    body: JSON.stringify({
      messages: [
        { role: 'user', content: 'Hello!' }
      ]
      // model is auto-injected if active model is set
    })
  });

  const data = await response.json();
  console.log('Response:', data.choices[0].message.content);
};

// Streaming inference
const streamingChat = async () => {
  const response = await fetch('http://localhost:8002/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'your-secret-key'
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Tell me a story' }],
      stream: true
    })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ') && line !== 'data: [DONE]') {
        const data = JSON.parse(line.substring(6));
        const content = data.choices[0]?.delta?.content;
        if (content) process.stdout.write(content);
      }
    }
  }
};

// Debug: Monitor events with model loading progress
const monitorEvents = () => {
  const eventSource = new EventSource(
    'http://localhost:8002/debug/stream',
    { headers: { 'X-API-Key': 'your-secret-key' } }
  );

  // Model loading start
  eventSource.addEventListener('model_load_start', (e) => {
    const data = JSON.parse(e.data);
    console.log(`Loading model: ${data.modelKey}`);
  });

  // Model loading progress (updates in real-time)
  eventSource.addEventListener('model_load_progress', (e) => {
    const data = JSON.parse(e.data);
    console.log(`Loading progress: ${data.progress}%`);
    // Update progress bar in UI
  });

  // Model loading complete
  eventSource.addEventListener('model_load_complete', (e) => {
    const data = JSON.parse(e.data);
    console.log(`Model loaded in ${data.totalTimeMs}ms`);
  });

  // Inference events
  eventSource.addEventListener('inference_start', (e) => {
    console.log('Inference started:', JSON.parse(e.data));
  });

  eventSource.addEventListener('inference_complete', (e) => {
    const data = JSON.parse(e.data);
    console.log(`Inference completed in ${data.totalTimeMs}ms`);
    if (data.tokenUsage) {
      console.log(`Tokens: ${data.tokenUsage.totalTokens}`);
    }
  });

  // Error events
  eventSource.addEventListener('error', (e) => {
    const data = JSON.parse(e.data);
    console.error('Error:', data.error);
  });

  // LM Studio log events (when log monitoring enabled)

  // Raw debug logs - ALL LM Studio log entries
  eventSource.addEventListener('debug_log', (e) => {
    const data = JSON.parse(e.data);
    console.log(`[${data.timestamp}][${data.level}] ${data.message}`);
    // data.raw contains the complete original log line
  });

  eventSource.addEventListener('lmstudio_sampling_params', (e) => {
    const data = JSON.parse(e.data);
    console.log('Sampling params:', data);
  });

  eventSource.addEventListener('lmstudio_prompt_progress', (e) => {
    const data = JSON.parse(e.data);
    console.log(`Prompt processing: ${data.progress}%`);
  });

  eventSource.addEventListener('lmstudio_cache_stats', (e) => {
    const data = JSON.parse(e.data);
    console.log(`Cache reuse: ${data.reused}/${data.total} (${data.percentage}%)`);
  });

  eventSource.addEventListener('lmstudio_token_info', (e) => {
    const data = JSON.parse(e.data);
    console.log(`Context: ${data.n_ctx}, Batch: ${data.n_batch}, Tokens: ${data.totalPromptTokens}`);
  });

  eventSource.addEventListener('lmstudio_month_transition', (e) => {
    const data = JSON.parse(e.data);
    console.log(`Log directory switched: ${data.oldDirectory} -> ${data.newDirectory}`);
  });
};
```

### Python (using requests)

```python
import requests
import json

BASE_URL = "http://localhost:8002"
API_KEY = "your-secret-key"

headers = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json"
}

# Admin: Load a model
def load_model():
    response = requests.post(
        f"{BASE_URL}/admin/models/load",
        headers=headers,
        json={
            "modelKey": "qwen2-1.5b-instruct",
            "activate": True,
            "defaultInference": {
                "temperature": 0.7,
                "maxTokens": 1024
            }
        }
    )
    print("Model loaded:", response.json())

# Inference: Chat completion
def chat_completion():
    response = requests.post(
        f"{BASE_URL}/v1/chat/completions",
        headers=headers,
        json={
            "messages": [
                {"role": "user", "content": "What is Python?"}
            ]
        }
    )
    data = response.json()
    print("Response:", data["choices"][0]["message"]["content"])

# Streaming inference
def streaming_chat():
    response = requests.post(
        f"{BASE_URL}/v1/chat/completions",
        headers=headers,
        json={
            "messages": [{"role": "user", "content": "Tell me a story"}],
            "stream": True
        },
        stream=True
    )

    for line in response.iter_lines():
        if line:
            line = line.decode('utf-8')
            if line.startswith('data: ') and line != 'data: [DONE]':
                data = json.loads(line[6:])
                content = data["choices"][0].get("delta", {}).get("content")
                if content:
                    print(content, end='', flush=True)

# Debug: Get metrics
def get_metrics():
    response = requests.get(
        f"{BASE_URL}/debug/metrics",
        headers={"X-API-Key": API_KEY}
    )
    metrics = response.json()

    print(f"Total Requests: {metrics['performance']['totalRequests']}")
    print(f"Avg Response Time: {metrics['performance']['avgResponseTimeMs']}ms")
    print(f"Avg Tokens/Sec: {metrics['performance']['avgTokensPerSec']}")

if __name__ == "__main__":
    load_model()
    chat_completion()
    get_metrics()
```

### cURL Examples

```bash
# List available models
curl -H "X-API-Key: your-secret-key" \
  http://localhost:8002/admin/models

# Load a model
curl -X POST http://localhost:8002/admin/models/load \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-key" \
  -d '{
    "modelKey": "qwen2-1.5b-instruct",
    "activate": true,
    "loadConfig": {
      "contextLength": 8192,
      "gpu": {"ratio": 1.0}
    }
  }'

# Chat completion
curl -X POST http://localhost:8002/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-key" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'

# Streaming chat completion
curl -X POST http://localhost:8002/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-key" \
  -N \
  -d '{
    "messages": [
      {"role": "user", "content": "Tell me a story"}
    ],
    "stream": true
  }'

# Get debug metrics
curl -H "X-API-Key: your-secret-key" \
  http://localhost:8002/debug/metrics

# Monitor debug events (SSE)
curl -H "X-API-Key: your-secret-key" \
  -H "Accept: text/event-stream" \
  -N \
  http://localhost:8002/debug/stream
```

---

## Additional Resources

- **[SDK Integration Guide](SDK_INTEGRATION.md)** - LM Studio SDK integration details
- **[Claude Code Integration](CLAUDE_CODE_INTEGRATION.md)** - Using the gateway with Claude Code
- **[Implementation Plan](IMPLEMENTATION_PLAN_TYPESCRIPT.md)** - Technical implementation details

---

## Troubleshooting

### Common Issues

**1. 401 Unauthorized**
- Verify `X-API-Key` header is set correctly
- Check `.env` file has `GATEWAY_API_KEY` configured

**2. 403 Forbidden**
- Verify client IP is in `IP_ALLOWLIST`
- Check CIDR notation is correct (e.g., `192.168.0.0/24`)

**3. 503 Service Unavailable**
- Ensure LM Studio is running
- Verify LM Studio API server is enabled (Settings → Developer → Local Server)
- Test direct connection: `curl http://127.0.0.1:1234/v1/models`

**4. Model Auto-Loads Different Model**
- Check `activeModel` in `/debug/status`
- Verify `instanceId` matches when using multi-instance loading
- Use explicit `model` parameter in requests

**5. No Token Metrics**
- Token stats only work for **non-streaming** requests
- Ensure LM Studio returns OpenAI-compatible `usage` field
- Check `/debug/metrics` - `requestsWithTokenData` shows count

**6. Timeout Errors**
- For streaming: Set `PROXY_STREAM_TIMEOUT=0` (no timeout)
- For non-streaming: Increase `PROXY_TIMEOUT` (default: 120000ms)
- Enable debug logging: `LOG_LEVEL=debug`

---

**Version**: 1.0.0
**Last Updated**: 2025-11-16
**License**: MIT
