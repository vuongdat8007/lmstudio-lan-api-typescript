# LM Studio Log Monitoring - Implementation Guide

## Overview

The LM Studio LAN Gateway includes a sophisticated log monitoring system that watches LM Studio's server log files and broadcasts parsed events in real-time via Server-Sent Events (SSE). This guide explains how to utilize these logs to display accurate debug information in any environment.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Configuration](#configuration)
3. [Available Event Types](#available-event-types)
4. [Client Implementation Examples](#client-implementation-examples)
5. [Practical Use Cases](#practical-use-cases)
6. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### How It Works

```
┌─────────────────┐
│   LM Studio     │
│  (localhost)    │
└────────┬────────┘
         │ Writes logs
         ▼
┌─────────────────────────────────────┐
│  ~/.lmstudio/server-logs/          │
│  ├── 2025-11/                      │
│  │   ├── 2025-11-17.1.log         │
│  │   └── 2025-11-16.1.log         │
│  └── 2025-12/                      │
│      └── 2025-12-01.1.log         │
└──────────┬──────────────────────────┘
           │ File monitoring (chokidar)
           ▼
┌─────────────────────────────────────┐
│  Log Monitor Service                │
│  - Tail logs in real-time           │
│  - Parse log entries                │
│  - Extract structured data          │
│  - Auto-switch months               │
└──────────┬──────────────────────────┘
           │ Broadcast events
           ▼
┌─────────────────────────────────────┐
│  Debug Stream (SSE)                 │
│  GET /debug/stream                  │
└──────────┬──────────────────────────┘
           │ Server-Sent Events
           ▼
┌─────────────────────────────────────┐
│  Your Application                   │
│  - Web UI                           │
│  - CLI Tool                         │
│  - Monitoring Dashboard             │
└─────────────────────────────────────┘
```

### Key Features

1. **Real-time Monitoring**: Tails log files as they're written
2. **Automatic Month Transitions**: Switches from `2025-11` to `2025-12` automatically
3. **Structured Event Broadcasting**: Parses raw logs into typed events
4. **No Polling Required**: Uses SSE for efficient push notifications
5. **Deep Visibility**: Exposes internal LM Studio operations

---

## Configuration

### Step 1: Enable Log Monitoring

Edit your `.env` file:

```bash
# Enable real-time log monitoring
ENABLE_LOG_MONITORING=true

# Set the LM Studio log directory path
# Windows:
LMSTUDIO_LOG_DIR=C:\Users\YourUsername\.lmstudio\server-logs

# Linux/macOS:
LMSTUDIO_LOG_DIR=/home/username/.lmstudio/server-logs
```

### Step 2: Verify Configuration

Start the gateway and check the startup logs:

```bash
npm run dev
```

Expected output:
```
2025-11-17 12:00:00 [info]: ============================================================
2025-11-17 12:00:00 [info]: LM Studio LAN Gateway (TypeScript) v1.0.0
2025-11-17 12:00:00 [info]: ============================================================
2025-11-17 12:00:00 [info]: Log Monitoring: enabled
2025-11-17 12:00:00 [info]: Log Directory: C:\Users\YourUsername\.lmstudio\server-logs
2025-11-17 12:00:00 [info]: ============================================================
2025-11-17 12:00:00 [info]: Starting LM Studio log monitoring
2025-11-17 12:00:00 [info]: Monitoring log file: C:\Users\...\2025-11\2025-11-17.1.log
2025-11-17 12:00:00 [info]: LM Studio log monitoring started successfully
```

### Step 3: Find Your Log Directory

**Windows:**
```powershell
dir $env:USERPROFILE\.lmstudio\server-logs
```

**Linux/macOS:**
```bash
ls -la ~/.lmstudio/server-logs
```

Expected structure:
```
server-logs/
├── 2025-11/
│   ├── 2025-11-17.1.log
│   ├── 2025-11-16.1.log
│   └── 2025-11-15.1.log
└── 2025-10/
    └── ...
```

---

## Available Event Types

### 1. LM Studio Log Events

#### `lmstudio_log`
Raw log entry from LM Studio.

**Data Fields:**
```typescript
{
  timestamp: string;    // ISO 8601 timestamp
  level: 'INFO' | 'DEBUG' | 'WARN' | 'ERROR';
  message: string;      // Raw log message
}
```

**Example:**
```json
{
  "timestamp": "2025-11-17 10:59:23",
  "level": "INFO",
  "message": "Running chat completion on conversation with 158 messages"
}
```

---

#### `lmstudio_chat_start`
Emitted when a chat completion request begins.

**Data Fields:**
```typescript
{
  message: string;      // Details about the chat
  timestamp: string;    // ISO 8601 timestamp
}
```

**Example:**
```json
{
  "message": "Running chat completion on conversation with 158 messages",
  "timestamp": "2025-11-17T10:59:23Z"
}
```

**Use Case:** Display "Processing request..." in your UI

---

#### `lmstudio_sampling_params`
Sampling parameters used for the current inference.

**Data Fields:**
```typescript
{
  repeat_last_n?: number;      // Context for repetition penalty
  repeat_penalty?: number;     // Repetition penalty value
  top_k?: number;              // Top-K sampling
  top_p?: number;              // Nucleus sampling (top-p)
  temp?: number;               // Temperature
  penalty_repeat?: number;     // Alternative penalty field
  timestamp: string;
}
```

**Example:**
```json
{
  "repeat_penalty": 1.1,
  "top_k": 40,
  "top_p": 0.95,
  "temp": 0.8,
  "timestamp": "2025-11-17T10:59:23Z"
}
```

**Use Case:** Display inference settings to users, audit parameter usage

---

#### `lmstudio_prompt_progress`
Prompt processing progress (0-100%).

**Data Fields:**
```typescript
{
  progress: number;    // Percentage (0-100)
  message: string;     // Human-readable progress message
  timestamp: string;
}
```

**Example:**
```json
{
  "progress": 36.6,
  "message": "Prompt processing progress: 36.6%",
  "timestamp": "2025-11-17T10:59:24Z"
}
```

**Use Case:** Show a progress bar during prompt encoding

**UI Implementation:**
```javascript
eventSource.addEventListener('lmstudio_prompt_progress', (e) => {
  const data = JSON.parse(e.data);
  updateProgressBar(data.progress); // 0-100
  updateStatusText(`Processing prompt: ${data.progress.toFixed(1)}%`);
});
```

---

#### `lmstudio_cache_stats`
KV cache reuse statistics.

**Data Fields:**
```typescript
{
  reused: number;      // Number of tokens reused from cache
  total: number;       // Total prompt tokens
  percentage: number;  // Reuse percentage
  prefix: number;      // Prefix tokens cached
  nonPrefix: number;   // Non-prefix tokens cached
  message: string;     // Human-readable summary
  timestamp: string;
}
```

**Example:**
```json
{
  "reused": 2158,
  "total": 5889,
  "percentage": 36.64,
  "prefix": 2158,
  "nonPrefix": 0,
  "message": "Cache reuse summary: 2158/5889 of prompt (36.6446%), 2158 prefix, 0 non-prefix",
  "timestamp": "2025-11-17T10:59:24Z"
}
```

**Use Case:** Performance monitoring, optimization insights

**UI Implementation:**
```javascript
eventSource.addEventListener('lmstudio_cache_stats', (e) => {
  const data = JSON.parse(e.data);

  // Display cache efficiency
  showCacheEfficiency(`${data.percentage.toFixed(1)}% cache hit`);

  // Show performance improvement
  const speedup = data.percentage / 100;
  showSpeedupEstimate(speedup);
});
```

---

#### `lmstudio_token_info`
Token and batch configuration for current request.

**Data Fields:**
```typescript
{
  n_ctx: number;              // Context window size
  n_batch: number;            // Batch size
  n_predict: number;          // Max tokens to predict (-1 = unlimited)
  n_keep: number;             // Tokens to keep in context
  totalPromptTokens: number;  // Total prompt token count
  promptTokensToDecode: number; // Tokens to decode
  timestamp: string;
}
```

**Example:**
```json
{
  "n_ctx": 12032,
  "n_batch": 512,
  "n_predict": -1,
  "n_keep": 2198,
  "totalPromptTokens": 5889,
  "promptTokensToDecode": 3731,
  "timestamp": "2025-11-17T10:59:24Z"
}
```

**Use Case:** Debug context overflow issues, monitor token usage

**UI Implementation:**
```javascript
eventSource.addEventListener('lmstudio_token_info', (e) => {
  const data = JSON.parse(e.data);

  // Display context usage
  const contextUsage = (data.totalPromptTokens / data.n_ctx) * 100;
  updateContextBar(contextUsage);

  // Warn if approaching context limit
  if (contextUsage > 90) {
    showWarning('Context window nearly full!');
  }

  // Show token details
  showTokenStats({
    prompt: data.totalPromptTokens,
    context: data.n_ctx,
    batch: data.n_batch
  });
});
```

---

#### `lmstudio_processing_start`
Emitted when prompt processing begins.

**Data Fields:**
```typescript
{
  message: string;     // Always "BeginProcessingPrompt"
  timestamp: string;
}
```

**Example:**
```json
{
  "message": "BeginProcessingPrompt",
  "timestamp": "2025-11-17T10:59:24Z"
}
```

**Use Case:** Mark the exact moment processing starts

---

#### `lmstudio_month_transition`
Emitted when log monitoring switches to a new month directory.

**Data Fields:**
```typescript
{
  oldDirectory: string;  // Previous month directory
  newDirectory: string;  // New month directory
  newLogFile: string;    // Path to new log file
  timestamp: string;
}
```

**Example:**
```json
{
  "oldDirectory": "C:\\Users\\...\\2025-11",
  "newDirectory": "C:\\Users\\...\\2025-12",
  "newLogFile": "C:\\Users\\...\\2025-12\\2025-12-01.1.log",
  "timestamp": "2025-12-01T00:00:15Z"
}
```

**Use Case:** Audit log transitions, confirm continuous monitoring

---

### 2. Gateway Events

These events are generated by the gateway itself (not from LM Studio logs):

#### `inference_start`
```typescript
{
  requestId: string;
  method: string;      // "POST"
  path: string;        // "/v1/chat/completions"
  timestamp: string;
}
```

#### `inference_complete`
```typescript
{
  requestId: string;
  totalTimeMs: number;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  timestamp: string;
}
```

#### `error`
```typescript
{
  requestId: string;
  error: string;
  operation?: string;
  timestamp: string;
}
```

---

## Client Implementation Examples

### JavaScript/TypeScript (Browser)

```javascript
/**
 * Complete example: Real-time inference monitoring with LM Studio logs
 */

class LMStudioMonitor {
  constructor(gatewayUrl, apiKey) {
    this.gatewayUrl = gatewayUrl;
    this.apiKey = apiKey;
    this.eventSource = null;
    this.currentRequest = null;
  }

  connect() {
    // Connect to debug stream
    this.eventSource = new EventSource(
      `${this.gatewayUrl}/debug/stream`,
      { headers: { 'X-API-Key': this.apiKey } }
    );

    // Connection events
    this.eventSource.addEventListener('connected', (e) => {
      console.log('Connected to debug stream');
      this.updateStatus('Connected', 'success');
    });

    // Gateway events
    this.eventSource.addEventListener('inference_start', (e) => {
      const data = JSON.parse(e.data);
      this.currentRequest = {
        id: data.requestId,
        startTime: Date.now(),
        phase: 'starting'
      };
      this.updateUI('Request started', 'info');
    });

    this.eventSource.addEventListener('inference_complete', (e) => {
      const data = JSON.parse(e.data);
      const duration = data.totalTimeMs;

      this.updateUI(`Completed in ${duration}ms`, 'success');

      if (data.tokenUsage) {
        this.showTokenUsage(data.tokenUsage);
      }

      this.currentRequest = null;
    });

    // LM Studio log events
    this.setupLMStudioEventHandlers();

    // Error handling
    this.eventSource.addEventListener('error', (e) => {
      const data = JSON.parse(e.data);
      this.showError(data.error);
    });

    this.eventSource.onerror = (error) => {
      console.error('EventSource error:', error);
      this.updateStatus('Disconnected', 'error');
    };
  }

  setupLMStudioEventHandlers() {
    // Chat start
    this.eventSource.addEventListener('lmstudio_chat_start', (e) => {
      const data = JSON.parse(e.data);
      if (this.currentRequest) {
        this.currentRequest.phase = 'chat_started';
      }
      this.updateUI(data.message, 'info');
    });

    // Sampling parameters
    this.eventSource.addEventListener('lmstudio_sampling_params', (e) => {
      const data = JSON.parse(e.data);
      this.showSamplingParams({
        temperature: data.temp,
        topP: data.top_p,
        topK: data.top_k,
        repeatPenalty: data.repeat_penalty
      });
    });

    // Prompt processing progress
    this.eventSource.addEventListener('lmstudio_prompt_progress', (e) => {
      const data = JSON.parse(e.data);
      if (this.currentRequest) {
        this.currentRequest.phase = 'processing_prompt';
      }
      this.updateProgressBar('prompt', data.progress);
      this.updateUI(`Processing prompt: ${data.progress.toFixed(1)}%`, 'info');
    });

    // Cache statistics
    this.eventSource.addEventListener('lmstudio_cache_stats', (e) => {
      const data = JSON.parse(e.data);
      this.showCacheStats({
        reused: data.reused,
        total: data.total,
        percentage: data.percentage,
        efficiency: data.percentage > 30 ? 'good' : 'low'
      });
    });

    // Token information
    this.eventSource.addEventListener('lmstudio_token_info', (e) => {
      const data = JSON.parse(e.data);

      // Calculate context usage
      const contextUsage = (data.totalPromptTokens / data.n_ctx) * 100;

      this.showTokenInfo({
        promptTokens: data.totalPromptTokens,
        contextSize: data.n_ctx,
        contextUsage: contextUsage.toFixed(1),
        batchSize: data.n_batch
      });

      // Warn if context is filling up
      if (contextUsage > 90) {
        this.showWarning('Context window is nearly full!');
      }
    });

    // Processing start
    this.eventSource.addEventListener('lmstudio_processing_start', (e) => {
      if (this.currentRequest) {
        this.currentRequest.phase = 'generating';
      }
      this.updateUI('Generating response...', 'info');
      this.startSpinner();
    });

    // Month transition (informational)
    this.eventSource.addEventListener('lmstudio_month_transition', (e) => {
      const data = JSON.parse(e.data);
      console.log(`Log monitoring switched to ${data.newDirectory}`);
    });
  }

  // UI update methods
  updateStatus(message, type) {
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.className = `status status-${type}`;
    }
  }

  updateUI(message, type) {
    const logEl = document.getElementById('activity-log');
    if (logEl) {
      const entry = document.createElement('div');
      entry.className = `log-entry log-${type}`;
      entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
      logEl.prepend(entry);

      // Keep only last 50 entries
      while (logEl.children.length > 50) {
        logEl.removeChild(logEl.lastChild);
      }
    }
  }

  updateProgressBar(name, percentage) {
    const progressEl = document.getElementById(`progress-${name}`);
    if (progressEl) {
      const bar = progressEl.querySelector('.progress-bar');
      const text = progressEl.querySelector('.progress-text');

      if (bar) bar.style.width = `${percentage}%`;
      if (text) text.textContent = `${percentage.toFixed(1)}%`;
    }
  }

  showSamplingParams(params) {
    const container = document.getElementById('sampling-params');
    if (container) {
      container.innerHTML = `
        <div class="param">Temperature: ${params.temperature}</div>
        <div class="param">Top-P: ${params.topP}</div>
        <div class="param">Top-K: ${params.topK}</div>
        <div class="param">Repeat Penalty: ${params.repeatPenalty}</div>
      `;
    }
  }

  showCacheStats(stats) {
    const container = document.getElementById('cache-stats');
    if (container) {
      const efficiencyClass = stats.efficiency === 'good' ? 'good' : 'warning';
      container.innerHTML = `
        <div class="stat">
          <span class="label">Cache Hits:</span>
          <span class="value">${stats.reused} / ${stats.total}</span>
        </div>
        <div class="stat">
          <span class="label">Efficiency:</span>
          <span class="value ${efficiencyClass}">${stats.percentage.toFixed(1)}%</span>
        </div>
      `;
    }
  }

  showTokenInfo(info) {
    const container = document.getElementById('token-info');
    if (container) {
      const usageClass = parseFloat(info.contextUsage) > 90 ? 'danger' : 'normal';
      container.innerHTML = `
        <div class="stat">
          <span class="label">Prompt Tokens:</span>
          <span class="value">${info.promptTokens}</span>
        </div>
        <div class="stat">
          <span class="label">Context Usage:</span>
          <span class="value ${usageClass}">${info.contextUsage}%</span>
        </div>
        <div class="stat">
          <span class="label">Context Size:</span>
          <span class="value">${info.contextSize}</span>
        </div>
      `;
    }
  }

  showTokenUsage(usage) {
    const container = document.getElementById('token-usage');
    if (container) {
      container.innerHTML = `
        <div>Prompt: ${usage.promptTokens}</div>
        <div>Completion: ${usage.completionTokens}</div>
        <div>Total: ${usage.totalTokens}</div>
      `;
    }
  }

  showWarning(message) {
    // Display warning banner
    const warningEl = document.getElementById('warnings');
    if (warningEl) {
      const warning = document.createElement('div');
      warning.className = 'warning-message';
      warning.textContent = message;
      warningEl.appendChild(warning);

      // Auto-remove after 10 seconds
      setTimeout(() => warning.remove(), 10000);
    }
  }

  showError(message) {
    this.updateUI(`Error: ${message}`, 'error');
  }

  startSpinner() {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) spinner.style.display = 'block';
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}

// Usage
const monitor = new LMStudioMonitor('http://localhost:8001', 'your-api-key');
monitor.connect();
```

---

### Python Example

```python
import requests
import json
import sseclient

class LMStudioMonitor:
    def __init__(self, gateway_url, api_key):
        self.gateway_url = gateway_url
        self.api_key = api_key
        self.current_request = None

    def connect(self):
        """Connect to debug stream and process events"""
        url = f"{self.gateway_url}/debug/stream"
        headers = {
            'X-API-Key': self.api_key,
            'Accept': 'text/event-stream'
        }

        response = requests.get(url, headers=headers, stream=True)
        client = sseclient.SSEClient(response)

        for event in client.events():
            self.handle_event(event)

    def handle_event(self, event):
        """Process individual SSE events"""
        event_type = event.event
        data = json.loads(event.data)

        # Gateway events
        if event_type == 'inference_start':
            self.on_inference_start(data)
        elif event_type == 'inference_complete':
            self.on_inference_complete(data)

        # LM Studio log events
        elif event_type == 'lmstudio_chat_start':
            self.on_chat_start(data)
        elif event_type == 'lmstudio_sampling_params':
            self.on_sampling_params(data)
        elif event_type == 'lmstudio_prompt_progress':
            self.on_prompt_progress(data)
        elif event_type == 'lmstudio_cache_stats':
            self.on_cache_stats(data)
        elif event_type == 'lmstudio_token_info':
            self.on_token_info(data)
        elif event_type == 'lmstudio_processing_start':
            self.on_processing_start(data)

        # Error events
        elif event_type == 'error':
            self.on_error(data)

    def on_inference_start(self, data):
        self.current_request = {
            'id': data['requestId'],
            'phase': 'starting'
        }
        print(f"[{data['timestamp']}] Request started: {data['requestId']}")

    def on_inference_complete(self, data):
        duration = data['totalTimeMs']
        print(f"[{data['timestamp']}] Completed in {duration}ms")

        if 'tokenUsage' in data:
            usage = data['tokenUsage']
            print(f"  Tokens: {usage['promptTokens']} prompt + "
                  f"{usage['completionTokens']} completion = "
                  f"{usage['totalTokens']} total")

        self.current_request = None

    def on_chat_start(self, data):
        print(f"[{data['timestamp']}] {data['message']}")

    def on_sampling_params(self, data):
        print(f"Sampling params:")
        print(f"  Temperature: {data.get('temp', 'N/A')}")
        print(f"  Top-P: {data.get('top_p', 'N/A')}")
        print(f"  Top-K: {data.get('top_k', 'N/A')}")
        print(f"  Repeat Penalty: {data.get('repeat_penalty', 'N/A')}")

    def on_prompt_progress(self, data):
        progress = data['progress']
        print(f"\rProcessing prompt: {progress:.1f}%", end='', flush=True)

    def on_cache_stats(self, data):
        print(f"\nCache stats: {data['reused']}/{data['total']} "
              f"({data['percentage']:.1f}% hit rate)")

    def on_token_info(self, data):
        context_usage = (data['totalPromptTokens'] / data['n_ctx']) * 100
        print(f"Token info:")
        print(f"  Prompt tokens: {data['totalPromptTokens']}")
        print(f"  Context size: {data['n_ctx']}")
        print(f"  Context usage: {context_usage:.1f}%")

        if context_usage > 90:
            print("  WARNING: Context window nearly full!")

    def on_processing_start(self, data):
        print(f"\n[{data['timestamp']}] Generating response...")

    def on_error(self, data):
        print(f"ERROR: {data['error']}")

# Usage
if __name__ == '__main__':
    monitor = LMStudioMonitor('http://localhost:8001', 'your-api-key')
    try:
        monitor.connect()
    except KeyboardInterrupt:
        print("\nDisconnected")
```

---

### Node.js CLI Example

```javascript
const EventSource = require('eventsource');
const chalk = require('chalk');

class LMStudioCLIMonitor {
  constructor(gatewayUrl, apiKey) {
    this.gatewayUrl = gatewayUrl;
    this.apiKey = apiKey;
    this.eventSource = null;
  }

  connect() {
    const url = `${this.gatewayUrl}/debug/stream`;

    this.eventSource = new EventSource(url, {
      headers: { 'X-API-Key': this.apiKey }
    });

    // Connection
    this.eventSource.addEventListener('connected', (e) => {
      console.log(chalk.green('✓ Connected to debug stream'));
    });

    // Inference lifecycle
    this.eventSource.addEventListener('inference_start', (e) => {
      const data = JSON.parse(e.data);
      console.log(chalk.blue(`\n→ Request ${data.requestId} started`));
    });

    this.eventSource.addEventListener('inference_complete', (e) => {
      const data = JSON.parse(e.data);
      console.log(chalk.green(`✓ Completed in ${data.totalTimeMs}ms`));

      if (data.tokenUsage) {
        const { promptTokens, completionTokens, totalTokens } = data.tokenUsage;
        console.log(chalk.gray(`  Tokens: ${promptTokens}+${completionTokens}=${totalTokens}`));
      }
    });

    // LM Studio events
    this.eventSource.addEventListener('lmstudio_sampling_params', (e) => {
      const data = JSON.parse(e.data);
      console.log(chalk.cyan('  Sampling:'), {
        temp: data.temp,
        top_p: data.top_p,
        top_k: data.top_k
      });
    });

    this.eventSource.addEventListener('lmstudio_prompt_progress', (e) => {
      const data = JSON.parse(e.data);
      process.stdout.write(chalk.yellow(`\r  Processing prompt: ${data.progress.toFixed(1)}%`));
    });

    this.eventSource.addEventListener('lmstudio_cache_stats', (e) => {
      const data = JSON.parse(e.data);
      const color = data.percentage > 30 ? chalk.green : chalk.yellow;
      console.log(color(`\n  Cache: ${data.reused}/${data.total} (${data.percentage.toFixed(1)}%)`));
    });

    this.eventSource.addEventListener('lmstudio_token_info', (e) => {
      const data = JSON.parse(e.data);
      const usage = (data.totalPromptTokens / data.n_ctx * 100).toFixed(1);
      console.log(chalk.gray(`  Context: ${data.totalPromptTokens}/${data.n_ctx} (${usage}%)`));
    });

    // Error handling
    this.eventSource.addEventListener('error', (e) => {
      const data = JSON.parse(e.data);
      console.error(chalk.red(`✗ Error: ${data.error}`));
    });

    this.eventSource.onerror = (error) => {
      console.error(chalk.red('Connection error'), error);
    };
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
    }
  }
}

// Usage
const monitor = new LMStudioCLIMonitor('http://localhost:8001', process.env.API_KEY);
monitor.connect();

process.on('SIGINT', () => {
  console.log('\nDisconnecting...');
  monitor.disconnect();
  process.exit(0);
});
```

---

## Practical Use Cases

### Use Case 1: Real-Time Progress Indicators

**Problem:** Users don't know what's happening during long inference requests.

**Solution:** Combine multiple events to show detailed progress.

```javascript
class InferenceProgressTracker {
  constructor() {
    this.phases = {
      'starting': 0,
      'chat_started': 10,
      'processing_prompt': 30,  // Will update 30-70% based on prompt progress
      'generating': 70,
      'complete': 100
    };
    this.currentPhase = 'idle';
  }

  onInferenceStart(data) {
    this.currentPhase = 'starting';
    this.updateProgress(0, 'Starting request...');
  }

  onChatStart(data) {
    this.currentPhase = 'chat_started';
    this.updateProgress(10, 'Initializing chat...');
  }

  onPromptProgress(data) {
    this.currentPhase = 'processing_prompt';
    // Map 0-100% prompt progress to 30-70% overall progress
    const overallProgress = 30 + (data.progress * 0.4);
    this.updateProgress(overallProgress, `Processing prompt: ${data.progress.toFixed(1)}%`);
  }

  onProcessingStart(data) {
    this.currentPhase = 'generating';
    this.updateProgress(70, 'Generating response...');
  }

  onInferenceComplete(data) {
    this.currentPhase = 'complete';
    this.updateProgress(100, `Complete (${data.totalTimeMs}ms)`);
  }

  updateProgress(percentage, message) {
    // Update your UI progress bar
    document.getElementById('progress-bar').style.width = `${percentage}%`;
    document.getElementById('progress-text').textContent = message;
  }
}
```

---

### Use Case 2: Performance Monitoring Dashboard

**Objective:** Track LM Studio performance metrics over time.

```javascript
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      cacheHitRates: [],
      tokenThroughput: [],
      contextUsage: []
    };
  }

  onCacheStats(data) {
    this.metrics.cacheHitRates.push({
      timestamp: new Date(data.timestamp),
      percentage: data.percentage
    });

    // Calculate moving average
    const recent = this.metrics.cacheHitRates.slice(-10);
    const avgCacheHit = recent.reduce((sum, m) => sum + m.percentage, 0) / recent.length;

    // Alert if cache efficiency drops
    if (avgCacheHit < 20) {
      this.alertLowCacheEfficiency(avgCacheHit);
    }

    this.updateChart('cache-chart', this.metrics.cacheHitRates);
  }

  onTokenInfo(data) {
    const usage = (data.totalPromptTokens / data.n_ctx) * 100;

    this.metrics.contextUsage.push({
      timestamp: new Date(data.timestamp),
      usage: usage
    });

    this.updateChart('context-chart', this.metrics.contextUsage);

    // Warn before hitting context limit
    if (usage > 85) {
      this.showWarning(`Context at ${usage.toFixed(1)}% - consider summarizing conversation`);
    }
  }

  onInferenceComplete(data) {
    if (data.tokenUsage) {
      const tokensPerSecond = data.tokenUsage.completionTokens / (data.totalTimeMs / 1000);

      this.metrics.tokenThroughput.push({
        timestamp: new Date(data.timestamp),
        tokensPerSec: tokensPerSecond
      });

      this.updateChart('throughput-chart', this.metrics.tokenThroughput);
    }
  }

  updateChart(chartId, dataPoints) {
    // Use your charting library (Chart.js, D3, etc.)
    // Example with Chart.js:
    const chart = Chart.getChart(chartId);
    if (chart) {
      chart.data.datasets[0].data = dataPoints;
      chart.update();
    }
  }

  alertLowCacheEfficiency(rate) {
    console.warn(`Cache efficiency dropped to ${rate.toFixed(1)}%`);
    // Send alert, update dashboard, etc.
  }

  showWarning(message) {
    // Display warning in UI
  }
}
```

---

### Use Case 3: Debug Troubleshooting

**Scenario:** User reports "slow responses"

**Solution:** Capture and analyze all events for a single request.

```javascript
class RequestDebugger {
  constructor() {
    this.currentRequest = null;
    this.requestHistory = [];
  }

  startCapture(requestId) {
    this.currentRequest = {
      id: requestId,
      events: [],
      startTime: Date.now()
    };
  }

  captureEvent(eventType, data) {
    if (this.currentRequest) {
      this.currentRequest.events.push({
        type: eventType,
        data: data,
        relativeTime: Date.now() - this.currentRequest.startTime
      });
    }
  }

  finishCapture() {
    if (this.currentRequest) {
      this.requestHistory.push(this.currentRequest);
      this.analyzeRequest(this.currentRequest);
      this.currentRequest = null;
    }
  }

  analyzeRequest(request) {
    const timeline = this.buildTimeline(request.events);

    console.log('Request Timeline:');
    timeline.forEach(event => {
      console.log(`  +${event.time}ms: ${event.type}`);
      if (event.details) {
        console.log(`    ${event.details}`);
      }
    });

    // Identify bottlenecks
    const slowPhases = timeline.filter(e => e.duration > 1000);
    if (slowPhases.length > 0) {
      console.warn('Slow phases detected:');
      slowPhases.forEach(phase => {
        console.warn(`  ${phase.type}: ${phase.duration}ms`);
      });
    }
  }

  buildTimeline(events) {
    return events.map((event, index) => {
      const nextEvent = events[index + 1];
      const duration = nextEvent ? nextEvent.relativeTime - event.relativeTime : null;

      let details = null;
      if (event.type === 'lmstudio_cache_stats') {
        details = `Cache: ${event.data.percentage.toFixed(1)}%`;
      } else if (event.type === 'lmstudio_token_info') {
        details = `Tokens: ${event.data.totalPromptTokens}`;
      }

      return {
        type: event.type,
        time: event.relativeTime,
        duration: duration,
        details: details
      };
    });
  }

  exportDebugInfo(requestId) {
    const request = this.requestHistory.find(r => r.id === requestId);
    if (request) {
      return JSON.stringify(request, null, 2);
    }
  }
}
```

---

## Troubleshooting

### Issue 1: No Events Received

**Symptoms:** EventSource connects but no events appear.

**Checklist:**
1. Verify log monitoring is enabled:
   ```bash
   # Check .env
   ENABLE_LOG_MONITORING=true
   ```

2. Verify log directory exists and is readable:
   ```bash
   # Windows
   dir "C:\Users\YourUsername\.lmstudio\server-logs"

   # Linux/macOS
   ls -la ~/.lmstudio/server-logs
   ```

3. Check gateway logs for errors:
   ```bash
   npm run dev
   # Look for "LM Studio log monitoring started successfully"
   ```

4. Verify LM Studio is running and generating logs:
   ```bash
   # Make a test request to LM Studio
   curl http://localhost:1234/v1/models
   ```

---

### Issue 2: Events Stop After Month Change

**Symptoms:** Events stop flowing on the 1st of a new month.

**Cause:** Month transition may have failed.

**Solution:**
- Check gateway logs for "Switched to new month directory"
- Verify new month directory exists
- Restart gateway if necessary

---

### Issue 3: Missing Token Usage

**Symptoms:** `inference_complete` has no `tokenUsage` field.

**Cause:** Only non-streaming requests include token usage.

**Solution:**
- For streaming requests, use `lmstudio_token_info` event instead
- Track prompt tokens from `lmstudio_token_info`
- Count completion tokens by tracking generated chunks

---

### Issue 4: High Memory Usage

**Symptoms:** Gateway uses excessive memory over time.

**Cause:** Too many debug events stored in memory.

**Solution:**
- Recent requests are limited to last 100 by default
- Implement client-side event pruning
- Don't store full event history indefinitely

---

## Best Practices

### 1. Event Buffering

Don't update UI for every single event - buffer rapid updates:

```javascript
class EventBuffer {
  constructor(delay = 100) {
    this.buffer = [];
    this.delay = delay;
    this.timeoutId = null;
  }

  add(event) {
    this.buffer.push(event);

    if (!this.timeoutId) {
      this.timeoutId = setTimeout(() => this.flush(), this.delay);
    }
  }

  flush() {
    if (this.buffer.length > 0) {
      this.processEvents(this.buffer);
      this.buffer = [];
    }
    this.timeoutId = null;
  }

  processEvents(events) {
    // Batch UI updates
    const latestProgress = events.reverse().find(e => e.type === 'lmstudio_prompt_progress');
    if (latestProgress) {
      updateProgressBar(latestProgress.data.progress);
    }
  }
}
```

### 2. Error Recovery

Implement reconnection logic:

```javascript
class RobustEventSource {
  constructor(url, options) {
    this.url = url;
    this.options = options;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    this.connect();
  }

  connect() {
    this.eventSource = new EventSource(this.url, this.options);

    this.eventSource.onerror = () => {
      console.warn(`Connection lost, reconnecting in ${this.reconnectDelay}ms`);

      setTimeout(() => {
        this.connect();
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      }, this.reconnectDelay);
    };

    this.eventSource.addEventListener('connected', () => {
      this.reconnectDelay = 1000; // Reset on successful connection
    });
  }
}
```

### 3. Performance Optimization

For high-volume scenarios:

```javascript
// Use event delegation for multiple listeners
const eventHandlers = {
  'lmstudio_prompt_progress': handlePromptProgress,
  'lmstudio_cache_stats': handleCacheStats,
  'lmstudio_token_info': handleTokenInfo
};

eventSource.addEventListener('message', (e) => {
  const handler = eventHandlers[e.type];
  if (handler) {
    handler(JSON.parse(e.data));
  }
});
```

---

## Conclusion

The LM Studio log monitoring system provides unprecedented visibility into the internal workings of your language model server. By implementing the patterns in this guide, you can:

- Build responsive UIs with real-time progress indicators
- Monitor and optimize performance
- Debug issues with detailed request timelines
- Create production-ready monitoring dashboards

The event-driven architecture ensures minimal latency and efficient resource usage, making it suitable for both development and production environments.

For additional help, see [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for complete API reference.
