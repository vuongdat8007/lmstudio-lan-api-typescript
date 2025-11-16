# Real-Time Debug API Documentation

## Overview

The LM Studio LAN Gateway provides a comprehensive real-time debugging API that allows you to monitor model operations, inference requests, and system performance through Server-Sent Events (SSE) and REST endpoints.

## Debug Endpoints

### 1. Server-Sent Events Stream

**Endpoint:** `GET /debug/stream`

**Description:** Real-time event stream for monitoring all gateway operations.

**Headers Required:**
```
X-API-Key: your-api-key
Accept: text/event-stream
```

**Example:**
```bash
curl -N -H "X-API-Key: change-me-please" \
     -H "Accept: text/event-stream" \
     http://localhost:8002/debug/stream
```

**Events Broadcasted:**

#### Connection Event
```
event: connected
data: {"timestamp":"2025-11-15T18:00:00Z","message":"Debug stream connected"}
```

#### Model Load Events
```
event: model_load_start
data: {
  "modelKey": "qwen2-1.5b-instruct",
  "instanceId": null,
  "loadConfig": {"contextLength": 8192},
  "timestamp": "2025-11-15T18:00:01Z"
}

event: model_load_complete
data: {
  "modelKey": "qwen2-1.5b-instruct",
  "instanceId": null,
  "activated": true,
  "totalTimeMs": 5432,
  "timestamp": "2025-11-15T18:00:06Z"
}
```

#### Model Unload Events
```
event: model_unload_start
data: {
  "modelKey": "qwen2-1.5b-instruct",
  "instanceId": null,
  "timestamp": "2025-11-15T18:05:00Z"
}

event: model_unload_complete
data: {
  "modelKey": "qwen2-1.5b-instruct",
  "instanceId": null,
  "totalTimeMs": 234,
  "timestamp": "2025-11-15T18:05:00Z"
}
```

#### Model Activate Event
```
event: model_activate
data: {
  "modelKey": "qwen2-1.5b-instruct",
  "instanceId": null,
  "defaultInference": {"temperature": 0.7, "maxTokens": 1024},
  "timestamp": "2025-11-15T18:10:00Z"
}
```

#### Inference Events
```
event: inference_start
data: {
  "requestId": "req_1234567890_abc123",
  "method": "POST",
  "path": "/v1/chat/completions",
  "timestamp": "2025-11-15T18:15:00Z"
}

event: inference_complete
data: {
  "requestId": "req_1234567890_abc123",
  "totalTimeMs": 1520,
  "timestamp": "2025-11-15T18:15:02Z"
}
```

#### Error Events
```
event: error
data: {
  "operation": "model_load",
  "modelKey": "invalid-model",
  "error": "Model not found",
  "totalTimeMs": 100,
  "timestamp": "2025-11-15T18:20:00Z"
}
```

#### Keep-Alive
Every 30 seconds, a keep-alive ping is sent:
```
: keep-alive
```

---

### 2. Debug Status Snapshot

**Endpoint:** `GET /debug/status`

**Description:** Get current gateway status and recent activity.

**Headers Required:**
```
X-API-Key: your-api-key
```

**Example:**
```bash
curl -H "X-API-Key: change-me-please" \
     http://localhost:8002/debug/status
```

**Response:**
```json
{
  "status": "idle",
  "currentOperation": null,
  "activeModel": {
    "modelKey": "qwen2-1.5b-instruct",
    "instanceId": null,
    "defaultInference": {
      "temperature": 0.7,
      "maxTokens": 1024
    }
  },
  "recentRequests": [
    {
      "requestId": "req_1234567890_abc123",
      "status": "completed",
      "timeMs": 1520,
      "timestamp": "2025-11-15T18:15:02Z"
    }
  ],
  "totalRequests": 42,
  "totalErrors": 1
}
```

**Fields:**
- `status`: Current gateway status (`idle`, `loading_model`, `processing_inference`, `error`)
- `currentOperation`: Details of ongoing operation (if any)
  - `type`: Operation type (`model_load`, `model_unload`, `inference`)
  - `modelKey`: Model being operated on
  - `progress`: Progress percentage (0-100)
  - `startedAt`: ISO timestamp when operation started
- `activeModel`: Currently active model configuration
- `recentRequests`: Last 10 requests (most recent last)
- `totalRequests`: Total number of requests processed
- `totalErrors`: Total number of errors encountered

---

### 3. Performance Metrics

**Endpoint:** `GET /debug/metrics`

**Description:** Detailed performance metrics and statistics.

**Headers Required:**
```
X-API-Key: your-api-key
```

**Example:**
```bash
curl -H "X-API-Key: change-me-please" \
     http://localhost:8002/debug/metrics
```

**Response:**
```json
{
  "modelInfo": {
    "modelKey": "qwen2-1.5b-instruct",
    "instanceId": null,
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
    "last10Requests": [
      {
        "requestId": "req_1234567890_abc123",
        "status": "completed",
        "timeMs": 1520,
        "timestamp": "2025-11-15T18:15:02Z"
      }
    ]
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
    "memoryUsageRaw": {
      "rss": 96837632,
      "heapTotal": 20004864,
      "heapUsed": 18049240,
      "external": 4627124,
      "arrayBuffers": 44169
    },
    "nodeVersion": "v20.10.0",
    "platform": "win32"
  },
  "currentOperation": null
}
```

**Performance Metrics Explained:**
- `errorRate`: Percentage of requests that resulted in errors
- `avgResponseTimeMs`: Average response time across all completed requests
- `minResponseTimeMs`: Fastest response time
- `maxResponseTimeMs`: Slowest response time
- `medianResponseTimeMs`: Median response time (middle value)

**Memory Usage (in MB):**
- `rss`: Resident Set Size - total memory allocated
- `heapTotal`: Total heap allocated by V8
- `heapUsed`: Heap actually used
- `external`: Memory used by C++ objects bound to JavaScript

---

## Usage Examples

### Real-Time Monitoring with JavaScript

```javascript
const eventSource = new EventSource('http://localhost:8002/debug/stream', {
  headers: {
    'X-API-Key': 'your-api-key'
  }
});

eventSource.addEventListener('connected', (e) => {
  console.log('Connected:', JSON.parse(e.data));
});

eventSource.addEventListener('model_load_start', (e) => {
  const data = JSON.parse(e.data);
  console.log(`Loading model: ${data.modelKey}`);
});

eventSource.addEventListener('model_load_complete', (e) => {
  const data = JSON.parse(e.data);
  console.log(`Model loaded in ${data.totalTimeMs}ms`);
});

eventSource.addEventListener('inference_start', (e) => {
  const data = JSON.parse(e.data);
  console.log(`Inference started: ${data.requestId}`);
});

eventSource.addEventListener('inference_complete', (e) => {
  const data = JSON.parse(e.data);
  console.log(`Inference completed in ${data.totalTimeMs}ms`);
});

eventSource.addEventListener('error', (e) => {
  const data = JSON.parse(e.data);
  console.error(`Error in ${data.operation}:`, data.error);
});

eventSource.onerror = (error) => {
  console.error('EventSource error:', error);
};
```

### Real-Time Monitoring with Python

```python
import requests
import json

def monitor_debug_stream():
    url = 'http://localhost:8002/debug/stream'
    headers = {'X-API-Key': 'your-api-key'}

    with requests.get(url, headers=headers, stream=True) as response:
        for line in response.iter_lines():
            if line:
                line = line.decode('utf-8')

                # Parse SSE format
                if line.startswith('event:'):
                    event_type = line.split(':', 1)[1].strip()
                elif line.startswith('data:'):
                    data = json.loads(line.split(':', 1)[1].strip())
                    print(f"{event_type}: {data}")

if __name__ == '__main__':
    monitor_debug_stream()
```

### Polling Metrics with cURL

```bash
#!/bin/bash
# Poll metrics every 5 seconds

while true; do
  echo "=== Metrics at $(date) ==="
  curl -s -H "X-API-Key: change-me-please" \
    http://localhost:8002/debug/metrics | jq '.performance'
  echo ""
  sleep 5
done
```

### Dashboard Example (HTML)

```html
<!DOCTYPE html>
<html>
<head>
  <title>LM Studio Gateway Monitor</title>
  <style>
    body { font-family: monospace; padding: 20px; }
    .metric { margin: 10px 0; }
    .event { padding: 5px; margin: 2px 0; border-left: 3px solid #007bff; }
    .error { border-left-color: #dc3545; }
  </style>
</head>
<body>
  <h1>LM Studio Gateway Monitor</h1>

  <h2>Current Status</h2>
  <div id="status"></div>

  <h2>Performance Metrics</h2>
  <div id="metrics"></div>

  <h2>Real-Time Events</h2>
  <div id="events"></div>

  <script>
    const API_KEY = 'change-me-please';
    const BASE_URL = 'http://localhost:8002';

    // SSE Connection
    const eventSource = new EventSource(`${BASE_URL}/debug/stream`);

    eventSource.onmessage = (e) => {
      const events = document.getElementById('events');
      const div = document.createElement('div');
      div.className = 'event';
      div.textContent = `${new Date().toLocaleTimeString()}: ${e.data}`;
      events.insertBefore(div, events.firstChild);

      // Keep only last 50 events
      while (events.children.length > 50) {
        events.removeChild(events.lastChild);
      }
    };

    eventSource.addEventListener('error', (e) => {
      const events = document.getElementById('events');
      const div = document.createElement('div');
      div.className = 'event error';
      div.textContent = `ERROR: ${JSON.stringify(e.data)}`;
      events.insertBefore(div, events.firstChild);
    });

    // Poll status and metrics
    async function updateDashboard() {
      try {
        const [statusRes, metricsRes] = await Promise.all([
          fetch(`${BASE_URL}/debug/status`, {
            headers: {'X-API-Key': API_KEY}
          }),
          fetch(`${BASE_URL}/debug/metrics`, {
            headers: {'X-API-Key': API_KEY}
          })
        ]);

        const status = await statusRes.json();
        const metrics = await metricsRes.json();

        // Update status
        document.getElementById('status').innerHTML = `
          <div class="metric">Status: ${status.status}</div>
          <div class="metric">Active Model: ${status.activeModel.modelKey || 'None'}</div>
          <div class="metric">Total Requests: ${status.totalRequests}</div>
          <div class="metric">Total Errors: ${status.totalErrors}</div>
        `;

        // Update metrics
        document.getElementById('metrics').innerHTML = `
          <div class="metric">Avg Response Time: ${metrics.performance.avgResponseTimeMs.toFixed(2)}ms</div>
          <div class="metric">Error Rate: ${metrics.performance.errorRate.toFixed(2)}%</div>
          <div class="metric">Memory (Heap Used): ${metrics.system.memoryUsage.heapUsed} MB</div>
          <div class="metric">Uptime: ${metrics.system.uptimeFormatted}</div>
        `;
      } catch (error) {
        console.error('Error updating dashboard:', error);
      }
    }

    // Update every 2 seconds
    updateDashboard();
    setInterval(updateDashboard, 2000);
  </script>
</body>
</html>
```

---

## Event Flow Examples

### Model Loading Flow

1. **Client requests model load:**
   ```bash
   POST /admin/models/load
   {"modelKey": "qwen2-1.5b-instruct", "activate": true}
   ```

2. **SSE Events broadcasted:**
   - `model_load_start` - Model loading begins
   - `model_load_complete` - Model loaded successfully

3. **Status updated:**
   - `status`: `loading_model` → `idle`
   - `activeModel.modelKey`: `null` → `"qwen2-1.5b-instruct"`

### Inference Flow

1. **Client makes inference request:**
   ```bash
   POST /v1/chat/completions
   {"messages": [{"role": "user", "content": "Hello"}]}
   ```

2. **SSE Events broadcasted:**
   - `inference_start` - Request received
   - `inference_complete` - Response returned

3. **Metrics updated:**
   - `totalRequests`: incremented
   - `recentRequests`: new entry added
   - `avgResponseTimeMs`: recalculated

### Error Flow

1. **Invalid model load attempt:**
   ```bash
   POST /admin/models/load
   {"modelKey": "nonexistent-model"}
   ```

2. **SSE Events broadcasted:**
   - `model_load_start` - Loading begins
   - `error` - Error occurred with details

3. **Status updated:**
   - `status`: `error`
   - `totalErrors`: incremented

---

## Best Practices

### Monitoring Production Systems

1. **Use SSE for Real-Time Monitoring:**
   - Connect a monitoring dashboard to `/debug/stream`
   - Alert on `error` events
   - Track model load times

2. **Poll Metrics Regularly:**
   - Check `/debug/metrics` every 30-60 seconds
   - Monitor `errorRate` and alert if > threshold
   - Track `avgResponseTimeMs` for performance degradation

3. **Status Snapshots for Health Checks:**
   - Use `/debug/status` in health monitoring systems
   - Check `currentOperation` for stuck operations
   - Verify `activeModel` matches expected state

### Performance Tuning

Monitor these metrics to optimize performance:

- **avgResponseTimeMs** - High values indicate slow inference
- **errorRate** - High rates suggest configuration issues
- **memoryUsage.heapUsed** - Growing heap indicates memory leak
- **maxResponseTimeMs** - Outliers may indicate system issues

### Security Considerations

⚠️ **Important:**
- Debug endpoints expose sensitive operational data
- Always require API key authentication (controlled by `GATEWAY_API_KEY`)
- Restrict access to trusted networks via `IP_ALLOWLIST`
- Consider disabling debug endpoints in production or use a separate API key
- Never expose SSE streams to public internet

---

## Troubleshooting

### SSE Connection Drops

**Problem:** EventSource connection closes unexpectedly

**Solutions:**
- Check network connectivity
- Verify firewall isn't blocking long-lived connections
- Ensure reverse proxy (if any) supports SSE (disable buffering)
- Check gateway logs for errors

### No Events Received

**Problem:** Connected to `/debug/stream` but no events appear

**Solutions:**
- Verify API operations are actually happening (try loading a model)
- Check that events are being broadcast (look for `broadcastDebugEvent` calls in code)
- Ensure event listener is registered before operations occur
- Check browser console for EventSource errors

### Metrics Show Zero

**Problem:** All metrics show 0 values

**Solutions:**
- Make some inference requests first to generate data
- Verify requests are reaching the gateway
- Check that debug state is being updated properly
- Confirm gateway restarted recently (metrics reset on restart)

---

## Summary

The debug API provides comprehensive real-time monitoring through:

✅ **Server-Sent Events** - Live event stream for all operations
✅ **Status Snapshots** - Current state and recent activity
✅ **Performance Metrics** - Detailed statistics and system info

Use these endpoints to build monitoring dashboards, track performance, debug issues, and ensure your LM Studio gateway is running optimally! 🚀
