# Debug API Consumption Guide

## For Claude Code & Developers

This guide explains how to consume debug information from the LM Studio LAN Gateway's real-time debug stream API. Whether you're building a monitoring dashboard, CLI tool, or integrating debug capabilities into your application, this document provides everything you need.

---

## Quick Start

### What You Get

The gateway provides a **Server-Sent Events (SSE)** stream at `GET /debug/stream` that broadcasts:

1. **Gateway Events**: Model loading, inference lifecycle, errors
2. **LM Studio Internal Logs**: Sampling parameters, prompt processing, cache stats, token usage

### Basic Connection

```javascript
const eventSource = new EventSource('http://localhost:8001/debug/stream', {
  headers: { 'X-API-Key': 'your-api-key' }
});

eventSource.addEventListener('inference_start', (e) => {
  const data = JSON.parse(e.data);
  console.log('Request started:', data.requestId);
});

eventSource.addEventListener('inference_complete', (e) => {
  const data = JSON.parse(e.data);
  console.log('Completed in', data.totalTimeMs, 'ms');
});
```

---

## Understanding the Event Flow

### Complete Request Lifecycle

When a client makes an inference request, here's the typical event sequence:

```
1. inference_start              → Gateway receives request
2. lmstudio_chat_start         → LM Studio begins processing
3. lmstudio_sampling_params    → Inference parameters logged
4. lmstudio_token_info         → Token/context configuration
5. lmstudio_prompt_progress    → Prompt encoding (may emit multiple times: 0% → 100%)
6. lmstudio_cache_stats        → KV cache statistics
7. lmstudio_processing_start   → Generation begins
8. inference_complete          → Response delivered
```

### Visual Timeline

```
Time (ms) │ Event                      │ Description
──────────┼────────────────────────────┼─────────────────────────────────
0         │ inference_start            │ Request received by gateway
10        │ lmstudio_chat_start        │ LM Studio starts processing
15        │ lmstudio_sampling_params   │ temp=0.8, top_p=0.95, etc.
20        │ lmstudio_token_info        │ 5889 prompt tokens, 12032 ctx
25        │ lmstudio_prompt_progress   │ 0%
150       │ lmstudio_prompt_progress   │ 25.3%
300       │ lmstudio_prompt_progress   │ 50.1%
450       │ lmstudio_prompt_progress   │ 75.8%
600       │ lmstudio_prompt_progress   │ 100%
610       │ lmstudio_cache_stats       │ 2158/5889 cached (36.6%)
615       │ lmstudio_processing_start  │ Begin generating tokens
7850      │ inference_complete         │ Done! 75 tokens generated
```

---

## Event Reference

### 1. Gateway Events

#### `connected`
**When:** Client connects to debug stream
**Frequency:** Once per connection

```typescript
{
  timestamp: "2025-11-17T12:00:00Z",
  message: "Debug stream connected"
}
```

**What to do:** Update connection status indicator

---

#### `inference_start`
**When:** Gateway receives inference request
**Frequency:** Once per request

```typescript
{
  requestId: "req_abc123",
  method: "POST",
  path: "/v1/chat/completions",
  timestamp: "2025-11-17T12:00:00Z"
}
```

**What to do:**
- Store `requestId` to track this specific request
- Show "Processing..." indicator
- Start timer for duration tracking

---

#### `inference_complete`
**When:** Response fully sent to client
**Frequency:** Once per request (matches `inference_start`)

```typescript
{
  requestId: "req_abc123",
  totalTimeMs: 7850,
  tokenUsage: {                    // Only for non-streaming requests
    promptTokens: 25,
    completionTokens: 50,
    totalTokens: 75
  },
  timestamp: "2025-11-17T12:00:08Z"
}
```

**What to do:**
- Clear "Processing..." indicator
- Display completion time
- Show token usage (if available)
- Calculate tokens/second: `completionTokens / (totalTimeMs / 1000)`

**Important:** Streaming requests won't have `tokenUsage`. Use `lmstudio_token_info` instead.

---

#### `model_load_start`
**When:** Model loading begins
**Frequency:** Once per model load operation

```typescript
{
  modelKey: "qwen2.5-7b-instruct",
  instanceId: "primary",
  loadConfig: {
    contextLength: 8192,
    gpu: { ratio: 1.0 }
  },
  timestamp: "2025-11-17T12:00:00Z"
}
```

**What to do:** Show "Loading model..." with model name

---

#### `model_load_progress`
**When:** During model loading
**Frequency:** Multiple times (0% → 100%)

```typescript
{
  modelKey: "qwen2.5-7b-instruct",
  instanceId: "primary",
  progress: 45.3,      // 0-100
  progressRaw: 0.453,  // 0.0-1.0
  timestamp: "2025-11-17T12:00:03Z"
}
```

**What to do:** Update progress bar with `progress` value

---

#### `model_load_complete`
**When:** Model fully loaded
**Frequency:** Once per model load operation

```typescript
{
  modelKey: "qwen2.5-7b-instruct",
  activated: true,
  totalTimeMs: 5432,
  timestamp: "2025-11-17T12:00:05Z"
}
```

**What to do:**
- Hide progress bar
- Show "Model loaded" confirmation
- Display load time

---

#### `error`
**When:** Error occurs (gateway or LM Studio)
**Frequency:** As needed

```typescript
{
  requestId: "req_abc123",        // May be null for non-request errors
  error: "Model not found",
  operation: "load_model",        // Optional context
  timestamp: "2025-11-17T12:00:00Z"
}
```

**What to do:**
- Display error message to user
- Log for debugging
- Clear any pending operations for this `requestId`

---

### 2. LM Studio Log Events

These events are parsed from LM Studio's internal logs and provide deep visibility into inference operations.

#### `lmstudio_log`
**When:** Any log entry from LM Studio
**Frequency:** Continuous (raw log stream)

```typescript
{
  timestamp: "2025-11-17 10:59:23",
  level: "INFO" | "DEBUG" | "WARN" | "ERROR",
  message: "Running chat completion on conversation with 158 messages"
}
```

**What to do:**
- Display in debug console/terminal
- Filter by `level` if needed
- Usually not shown to end users

---

#### `lmstudio_chat_start`
**When:** Chat completion request begins in LM Studio
**Frequency:** Once per chat inference

```typescript
{
  message: "Running chat completion on conversation with 158 messages",
  timestamp: "2025-11-17T10:59:23Z"
}
```

**What to do:**
- Extract conversation message count from `message`
- Show "Initializing chat..." status

---

#### `lmstudio_sampling_params`
**When:** LM Studio logs inference parameters
**Frequency:** Once per inference (right after chat_start)

```typescript
{
  repeat_last_n: 64,
  repeat_penalty: 1.1,
  top_k: 40,
  top_p: 0.95,
  temp: 0.8,
  timestamp: "2025-11-17T10:59:23Z"
}
```

**What to do:**
- Display parameters in settings panel
- Audit/log parameter usage
- Compare against expected values

**Example Display:**
```
Inference Settings:
  Temperature: 0.8
  Top-P: 0.95
  Top-K: 40
  Repeat Penalty: 1.1
```

---

#### `lmstudio_prompt_progress`
**When:** During prompt encoding/processing
**Frequency:** Multiple times (0% → 100%)

```typescript
{
  progress: 36.6,     // Percentage
  message: "Prompt processing progress: 36.6%",
  timestamp: "2025-11-17T10:59:24Z"
}
```

**What to do:**
- Update progress bar (0-100%)
- Show percentage in status text
- This is the **most useful event for real-time progress**

**Example Implementation:**
```javascript
eventSource.addEventListener('lmstudio_prompt_progress', (e) => {
  const { progress } = JSON.parse(e.data);

  // Update progress bar
  document.getElementById('progress-bar').style.width = `${progress}%`;

  // Update text
  document.getElementById('status').textContent =
    `Processing prompt: ${progress.toFixed(1)}%`;
});
```

---

#### `lmstudio_cache_stats`
**When:** After prompt processing completes
**Frequency:** Once per inference

```typescript
{
  reused: 2158,
  total: 5889,
  percentage: 36.64,
  prefix: 2158,
  nonPrefix: 0,
  message: "Cache reuse summary: 2158/5889 of prompt (36.6446%), 2158 prefix, 0 non-prefix",
  timestamp: "2025-11-17T10:59:24Z"
}
```

**What to do:**
- Display cache efficiency
- Monitor performance (higher % = faster)
- Alert if efficiency drops below threshold

**Example Display:**
```
Cache Efficiency: 36.6% (2158/5889 tokens)
Status: Good ✓
```

**Interpretation:**
- `> 30%`: Good efficiency, prompt is similar to previous
- `< 10%`: Poor efficiency, mostly new content
- `0%`: No cache hits, completely new prompt

---

#### `lmstudio_token_info`
**When:** After prompt processing, before generation
**Frequency:** Once per inference

```typescript
{
  n_ctx: 12032,              // Total context window
  n_batch: 512,              // Batch processing size
  n_predict: -1,             // Max tokens to generate (-1 = unlimited)
  n_keep: 2198,              // Tokens to keep in context
  totalPromptTokens: 5889,   // Total prompt size
  promptTokensToDecode: 3731, // Tokens to process
  timestamp: "2025-11-17T10:59:24Z"
}
```

**What to do:**
- Calculate context usage: `(totalPromptTokens / n_ctx) * 100`
- Warn if usage > 90%
- Display token counts

**Example Implementation:**
```javascript
eventSource.addEventListener('lmstudio_token_info', (e) => {
  const data = JSON.parse(e.data);
  const usage = (data.totalPromptTokens / data.n_ctx) * 100;

  console.log(`Context: ${data.totalPromptTokens}/${data.n_ctx} (${usage.toFixed(1)}%)`);

  if (usage > 90) {
    alert('Warning: Context window is nearly full!');
  }
});
```

**Why this matters:**
- Context overflow = truncated conversation history
- High usage = may need to summarize or clear history
- Essential for long conversations

---

#### `lmstudio_processing_start`
**When:** Token generation begins
**Frequency:** Once per inference

```typescript
{
  message: "BeginProcessingPrompt",
  timestamp: "2025-11-17T10:59:24Z"
}
```

**What to do:**
- Change status from "Processing prompt" to "Generating response"
- Show spinner/loading animation
- This is when actual text generation starts

---

#### `lmstudio_month_transition`
**When:** Log directory switches months (e.g., Nov → Dec)
**Frequency:** Once per month

```typescript
{
  oldDirectory: "C:\\Users\\...\\2025-11",
  newDirectory: "C:\\Users\\...\\2025-12",
  newLogFile: "C:\\Users\\...\\2025-12\\2025-12-01.1.log",
  timestamp: "2025-12-01T00:00:15Z"
}
```

**What to do:**
- Log the transition (informational)
- Confirm monitoring is continuous
- Usually not displayed to end users

---

## Practical Implementation Patterns

### Pattern 1: Progress Tracking

Map events to a unified progress indicator:

```javascript
class ProgressTracker {
  constructor() {
    this.phase = 'idle';
    this.percentage = 0;
  }

  onInferenceStart() {
    this.phase = 'starting';
    this.updateUI(0, 'Connecting...');
  }

  onChatStart() {
    this.phase = 'initializing';
    this.updateUI(10, 'Initializing...');
  }

  onPromptProgress(data) {
    this.phase = 'processing';
    // Map 0-100% prompt progress to 10-70% overall
    const overall = 10 + (data.progress * 0.6);
    this.updateUI(overall, `Processing: ${data.progress.toFixed(1)}%`);
  }

  onProcessingStart() {
    this.phase = 'generating';
    this.updateUI(70, 'Generating...');
  }

  onInferenceComplete(data) {
    this.phase = 'complete';
    this.updateUI(100, `Done (${data.totalTimeMs}ms)`);
  }

  updateUI(percentage, message) {
    this.percentage = percentage;
    // Update your UI elements
    console.log(`[${this.percentage}%] ${message}`);
  }
}
```

---

### Pattern 2: Real-Time Monitoring

Track multiple requests concurrently:

```javascript
class RequestMonitor {
  constructor() {
    this.activeRequests = new Map();
  }

  onInferenceStart(data) {
    this.activeRequests.set(data.requestId, {
      id: data.requestId,
      startTime: Date.now(),
      events: []
    });
  }

  onEvent(requestId, eventType, data) {
    const request = this.activeRequests.get(requestId);
    if (request) {
      request.events.push({
        type: eventType,
        data: data,
        time: Date.now() - request.startTime
      });
    }
  }

  onInferenceComplete(data) {
    const request = this.activeRequests.get(data.requestId);
    if (request) {
      request.totalTime = data.totalTimeMs;
      this.logRequest(request);
      this.activeRequests.delete(data.requestId);
    }
  }

  logRequest(request) {
    console.log(`Request ${request.id}:`);
    request.events.forEach(e => {
      console.log(`  +${e.time}ms: ${e.type}`);
    });
  }
}
```

---

### Pattern 3: Performance Metrics

Calculate and display performance stats:

```javascript
class PerformanceTracker {
  constructor() {
    this.metrics = {
      tokensPerSec: [],
      cacheHits: [],
      contextUsage: []
    };
  }

  onInferenceComplete(data) {
    if (data.tokenUsage) {
      const tps = data.tokenUsage.completionTokens / (data.totalTimeMs / 1000);
      this.metrics.tokensPerSec.push(tps);

      console.log(`Performance: ${tps.toFixed(1)} tokens/sec`);
    }
  }

  onCacheStats(data) {
    this.metrics.cacheHits.push(data.percentage);

    // Calculate moving average
    const recent = this.metrics.cacheHits.slice(-10);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;

    console.log(`Cache efficiency: ${avg.toFixed(1)}% (avg last 10)`);
  }

  onTokenInfo(data) {
    const usage = (data.totalPromptTokens / data.n_ctx) * 100;
    this.metrics.contextUsage.push(usage);

    if (usage > 85) {
      console.warn(`Context usage high: ${usage.toFixed(1)}%`);
    }
  }

  getAverageTokensPerSec() {
    if (this.metrics.tokensPerSec.length === 0) return 0;
    const sum = this.metrics.tokensPerSec.reduce((a, b) => a + b, 0);
    return sum / this.metrics.tokensPerSec.length;
  }

  getAverageCacheHit() {
    if (this.metrics.cacheHits.length === 0) return 0;
    const sum = this.metrics.cacheHits.reduce((a, b) => a + b, 0);
    return sum / this.metrics.cacheHits.length;
  }
}
```

---

## Complete Working Example

### Full-Featured Monitor

```javascript
class LMStudioDebugMonitor {
  constructor(gatewayUrl, apiKey) {
    this.gatewayUrl = gatewayUrl;
    this.apiKey = apiKey;
    this.eventSource = null;
    this.activeRequests = new Map();
  }

  connect() {
    this.eventSource = new EventSource(
      `${this.gatewayUrl}/debug/stream`,
      { headers: { 'X-API-Key': this.apiKey } }
    );

    // Connection status
    this.eventSource.addEventListener('connected', (e) => {
      console.log('✓ Connected to debug stream');
    });

    // Request lifecycle
    this.eventSource.addEventListener('inference_start', (e) => {
      const data = JSON.parse(e.data);
      this.handleInferenceStart(data);
    });

    this.eventSource.addEventListener('inference_complete', (e) => {
      const data = JSON.parse(e.data);
      this.handleInferenceComplete(data);
    });

    // LM Studio events
    this.eventSource.addEventListener('lmstudio_chat_start', (e) => {
      const data = JSON.parse(e.data);
      console.log('  Chat started:', data.message);
    });

    this.eventSource.addEventListener('lmstudio_sampling_params', (e) => {
      const data = JSON.parse(e.data);
      this.displaySamplingParams(data);
    });

    this.eventSource.addEventListener('lmstudio_prompt_progress', (e) => {
      const data = JSON.parse(e.data);
      this.updateProgress(data.progress);
    });

    this.eventSource.addEventListener('lmstudio_cache_stats', (e) => {
      const data = JSON.parse(e.data);
      this.displayCacheStats(data);
    });

    this.eventSource.addEventListener('lmstudio_token_info', (e) => {
      const data = JSON.parse(e.data);
      this.checkContextUsage(data);
    });

    this.eventSource.addEventListener('lmstudio_processing_start', (e) => {
      console.log('  Generating tokens...');
    });

    // Errors
    this.eventSource.addEventListener('error', (e) => {
      const data = JSON.parse(e.data);
      console.error('Error:', data.error);
    });

    this.eventSource.onerror = () => {
      console.error('Connection lost, reconnecting...');
      // Implement reconnection logic
    };
  }

  handleInferenceStart(data) {
    console.log(`\n→ Request ${data.requestId} started`);
    this.activeRequests.set(data.requestId, {
      id: data.requestId,
      startTime: Date.now()
    });
  }

  handleInferenceComplete(data) {
    console.log(`✓ Request ${data.requestId} completed in ${data.totalTimeMs}ms`);

    if (data.tokenUsage) {
      const tps = data.tokenUsage.completionTokens / (data.totalTimeMs / 1000);
      console.log(`  Tokens: ${data.tokenUsage.totalTokens} (${tps.toFixed(1)} tok/s)`);
    }

    this.activeRequests.delete(data.requestId);
  }

  displaySamplingParams(params) {
    console.log('  Sampling:', {
      temp: params.temp,
      top_p: params.top_p,
      top_k: params.top_k
    });
  }

  updateProgress(percentage) {
    process.stdout.write(`\r  Progress: ${percentage.toFixed(1)}%`);
    if (percentage >= 100) {
      console.log(); // New line
    }
  }

  displayCacheStats(stats) {
    const efficiency = stats.percentage > 30 ? 'Good' : 'Low';
    console.log(`  Cache: ${stats.percentage.toFixed(1)}% (${efficiency})`);
  }

  checkContextUsage(data) {
    const usage = (data.totalPromptTokens / data.n_ctx) * 100;
    console.log(`  Context: ${data.totalPromptTokens}/${data.n_ctx} (${usage.toFixed(1)}%)`);

    if (usage > 90) {
      console.warn('  ⚠ Warning: Context nearly full!');
    }
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
    }
  }
}

// Usage
const monitor = new LMStudioDebugMonitor(
  'http://localhost:8001',
  process.env.API_KEY
);
monitor.connect();
```

### Expected Output

```
✓ Connected to debug stream

→ Request req_abc123 started
  Chat started: Running chat completion on conversation with 158 messages
  Sampling: { temp: 0.8, top_p: 0.95, top_k: 40 }
  Context: 5889/12032 (48.9%)
  Progress: 0.0%
  Progress: 25.3%
  Progress: 50.1%
  Progress: 75.8%
  Progress: 100.0%
  Cache: 36.6% (Good)
  Generating tokens...
✓ Request req_abc123 completed in 7850ms
  Tokens: 75 (9.6 tok/s)
```

---

## Common Scenarios

### Scenario 1: Display Loading Progress

**Goal:** Show user what's happening during long requests

```javascript
function displayLoadingState(eventSource) {
  let currentState = 'idle';

  eventSource.addEventListener('inference_start', () => {
    currentState = 'starting';
    showStatus('Starting request...');
  });

  eventSource.addEventListener('lmstudio_chat_start', () => {
    currentState = 'initializing';
    showStatus('Initializing chat...');
  });

  eventSource.addEventListener('lmstudio_prompt_progress', (e) => {
    const { progress } = JSON.parse(e.data);
    currentState = 'processing';
    showStatus(`Processing prompt: ${progress.toFixed(0)}%`);
    updateProgressBar(progress);
  });

  eventSource.addEventListener('lmstudio_processing_start', () => {
    currentState = 'generating';
    showStatus('Generating response...');
    showSpinner();
  });

  eventSource.addEventListener('inference_complete', (e) => {
    currentState = 'complete';
    const { totalTimeMs } = JSON.parse(e.data);
    showStatus(`Complete (${totalTimeMs}ms)`);
    hideSpinner();
  });
}
```

---

### Scenario 2: Monitor Performance

**Goal:** Track and alert on performance issues

```javascript
function monitorPerformance(eventSource) {
  const metrics = { tokensPerSec: [], cacheHits: [] };

  eventSource.addEventListener('inference_complete', (e) => {
    const data = JSON.parse(e.data);
    if (data.tokenUsage) {
      const tps = data.tokenUsage.completionTokens / (data.totalTimeMs / 1000);
      metrics.tokensPerSec.push(tps);

      // Alert if performance degrades
      const avgTps = metrics.tokensPerSec.reduce((a, b) => a + b) / metrics.tokensPerSec.length;
      if (avgTps < 5) {
        alert('Performance warning: Average speed below 5 tok/s');
      }
    }
  });

  eventSource.addEventListener('lmstudio_cache_stats', (e) => {
    const { percentage } = JSON.parse(e.data);
    metrics.cacheHits.push(percentage);

    // Alert if cache efficiency drops
    if (percentage < 10) {
      console.warn('Low cache efficiency:', percentage);
    }
  });
}
```

---

### Scenario 3: Debug Request Issues

**Goal:** Capture detailed timeline for troubleshooting

```javascript
function debugRequest(eventSource, requestId) {
  const timeline = [];
  const startTime = Date.now();

  const eventTypes = [
    'inference_start',
    'lmstudio_chat_start',
    'lmstudio_sampling_params',
    'lmstudio_token_info',
    'lmstudio_prompt_progress',
    'lmstudio_cache_stats',
    'lmstudio_processing_start',
    'inference_complete'
  ];

  eventTypes.forEach(eventType => {
    eventSource.addEventListener(eventType, (e) => {
      const data = JSON.parse(e.data);
      if (!data.requestId || data.requestId === requestId) {
        timeline.push({
          event: eventType,
          time: Date.now() - startTime,
          data: data
        });
      }
    });
  });

  // Export timeline
  eventSource.addEventListener('inference_complete', (e) => {
    const data = JSON.parse(e.data);
    if (data.requestId === requestId) {
      console.log('Request Timeline:');
      timeline.forEach(t => {
        console.log(`  +${t.time}ms: ${t.event}`);
      });
    }
  });
}
```

---

## Troubleshooting

### Issue: No Events Received

**Check:**
1. API key is correct
2. Gateway is running and log monitoring is enabled
3. LM Studio is running and generating logs
4. EventSource connection established

```javascript
eventSource.addEventListener('open', () => {
  console.log('Connection opened');
});

eventSource.addEventListener('error', (e) => {
  console.error('Connection error:', e);
});
```

---

### Issue: Missing Token Usage

**Problem:** `inference_complete` doesn't have `tokenUsage`

**Reason:** You're using streaming mode

**Solution:** Use `lmstudio_token_info` instead:

```javascript
let promptTokens = 0;

eventSource.addEventListener('lmstudio_token_info', (e) => {
  const data = JSON.parse(e.data);
  promptTokens = data.totalPromptTokens;
});

// For completion tokens in streaming, count the chunks
```

---

### Issue: Events Out of Order

**Problem:** Events don't follow expected sequence

**Reason:** Multiple concurrent requests

**Solution:** Track by `requestId`:

```javascript
const requests = new Map();

function handleEvent(eventType, data) {
  if (!data.requestId) return; // Skip events without requestId

  if (!requests.has(data.requestId)) {
    requests.set(data.requestId, { events: [] });
  }

  requests.get(data.requestId).events.push({ type: eventType, data });
}
```

---

## Best Practices

### 1. Always Track Request IDs

```javascript
// Good
const currentRequest = data.requestId;
console.log(`Processing ${currentRequest}`);

// Bad
console.log('Processing request'); // Which request?
```

### 2. Handle Connection Loss

```javascript
class RobustMonitor {
  constructor(url, apiKey) {
    this.url = url;
    this.apiKey = apiKey;
    this.reconnectDelay = 1000;
    this.connect();
  }

  connect() {
    this.eventSource = new EventSource(this.url, {
      headers: { 'X-API-Key': this.apiKey }
    });

    this.eventSource.onerror = () => {
      console.log(`Reconnecting in ${this.reconnectDelay}ms...`);
      setTimeout(() => {
        this.connect();
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
      }, this.reconnectDelay);
    };

    this.eventSource.addEventListener('connected', () => {
      this.reconnectDelay = 1000; // Reset on success
    });
  }
}
```

### 3. Buffer Rapid Updates

```javascript
class ProgressBuffer {
  constructor() {
    this.latestProgress = 0;
    this.updateTimeout = null;
  }

  onProgress(percentage) {
    this.latestProgress = percentage;

    if (!this.updateTimeout) {
      this.updateTimeout = setTimeout(() => {
        this.flushUpdate();
      }, 100); // Update UI max every 100ms
    }
  }

  flushUpdate() {
    updateProgressBar(this.latestProgress);
    this.updateTimeout = null;
  }
}
```

### 4. Clean Up Resources

```javascript
// Always disconnect when done
window.addEventListener('beforeunload', () => {
  if (monitor) {
    monitor.disconnect();
  }
});
```

---

## Quick Reference Card

| Event | When | Key Data | Use For |
|-------|------|----------|---------|
| `inference_start` | Request begins | `requestId` | Start tracking |
| `inference_complete` | Request done | `totalTimeMs`, `tokenUsage` | Show results |
| `lmstudio_prompt_progress` | Prompt encoding | `progress` (0-100) | Progress bar |
| `lmstudio_cache_stats` | After encoding | `percentage` | Performance |
| `lmstudio_token_info` | Before generation | `totalPromptTokens`, `n_ctx` | Context usage |
| `lmstudio_processing_start` | Generation starts | - | Show "generating" |
| `error` | Error occurs | `error` | Show error |

---

## Next Steps

1. **Start Simple:** Connect and log all events
2. **Add Progress:** Implement `lmstudio_prompt_progress` handler
3. **Add Metrics:** Track performance with cache stats
4. **Add Alerts:** Warn on context usage, low cache hits
5. **Polish UI:** Buffer updates, add animations

For complete API reference, see [API_DOCUMENTATION.md](API_DOCUMENTATION.md).

For implementation examples, see [LMSTUDIO_LOG_MONITORING_GUIDE.md](LMSTUDIO_LOG_MONITORING_GUIDE.md).
