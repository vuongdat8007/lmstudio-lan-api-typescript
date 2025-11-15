# LM Studio LAN Gateway (TypeScript Edition)

A production-ready LAN-based API gateway for LM Studio, enabling secure local network access to LM Studio's language model capabilities.

## Features

- **Admin API**: Load, unload, and manage models remotely with custom configurations
- **Transparent Proxy**: Forward all OpenAI-compatible `/v1/*` requests to LM Studio
- **Security**: API key authentication and IP/CIDR-based access control
- **Real-time Debugging**: Server-Sent Events for live model loading and inference monitoring
- **Production-Ready**: TypeScript, comprehensive error handling, structured logging
- **Auto-Injection**: Automatically inject active model and default parameters into requests

## Tech Stack

- **Runtime**: Node.js 20+ (LTS)
- **Language**: TypeScript 5.3+
- **Framework**: Express.js 4.x
- **Validation**: Zod (schema validation and type inference)
- **Logging**: Winston (structured logging)
- **HTTP Client**: axios (with streaming support)
- **Testing**: Jest + Supertest

## Quick Start

### Prerequisites

- Node.js 20+ installed
- LM Studio running on `http://127.0.0.1:1234` (configurable)

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/lmstudio-lan-api-typescript.git
cd lmstudio-lan-api-typescript
```

2. Install dependencies
```bash
npm install
```

3. Configure environment
```bash
cp .env.example .env
# Edit .env with your settings
```

4. Start development server
```bash
npm run dev
```

5. Build for production
```bash
npm run build
npm start
```

### Windows Service Installation

For automatic startup on Windows reboot, install as a Windows service:

```bash
# 1. Build the project
npm run build

# 2. Install service (run as Administrator)
npm run service:install

# 3. The service will start automatically and run on boot
```

See [WINDOWS_SERVICE.md](WINDOWS_SERVICE.md) for detailed instructions on:
- Installing and managing the Windows service
- Configuring automatic startup
- Troubleshooting service issues
- Viewing service logs in Event Viewer

To uninstall the service:
```bash
# Run as Administrator
npm run service:uninstall
```

## Configuration

### Environment Variables

Create a `.env` file from `.env.example`:

```bash
# LM Studio API URL (typically localhost)
LMSTUDIO_BASE_URL=http://127.0.0.1:1234

# Gateway bind settings
GATEWAY_HOST=0.0.0.0
GATEWAY_PORT=8001

# Security: API key (REQUIRED for production)
GATEWAY_API_KEY=change-me-please

# Security: IP allow-list
# Examples:
#   "*" - allow all (dev only)
#   "192.168.0.0/24" - allow subnet
#   "10.0.0.2,10.0.0.3" - specific IPs
IP_ALLOWLIST=192.168.0.0/24,10.0.0.0/24

# Allow unauthenticated /health checks
REQUIRE_AUTH_FOR_HEALTH=false

# Logging level (error, warn, info, debug)
LOG_LEVEL=info

# Node environment
NODE_ENV=development
```

## API Endpoints

### Admin API

#### List Models
```http
GET /admin/models
Headers:
  X-API-Key: your-secret-key

Response: 200 OK
{
  "data": [
    {"id": "qwen2.5-7b-instruct", ...},
    ...
  ]
}
```

#### Load Model
```http
POST /admin/models/load
Headers:
  X-API-Key: your-secret-key
  Content-Type: application/json

Body:
{
  "modelKey": "qwen2.5-7b-instruct",
  "instanceId": "primary-qwen",
  "loadConfig": {
    "contextLength": 8192,
    "gpu": {"ratio": 1.0}
  },
  "ttlSeconds": 3600,
  "defaultInference": {
    "temperature": 0.4,
    "maxTokens": 2048
  },
  "activate": true
}

Response: 200 OK
{
  "status": "loaded",
  "modelKey": "qwen2.5-7b-instruct",
  "instanceId": "primary-qwen",
  "activated": true
}
```

#### Unload Model
```http
POST /admin/models/unload
Headers:
  X-API-Key: your-secret-key
  Content-Type: application/json

Body:
{
  "modelKey": "qwen2.5-7b-instruct",
  "instanceId": null
}

Response: 200 OK
{
  "status": "unloaded",
  "modelKey": "qwen2.5-7b-instruct"
}
```

#### Activate Model
```http
POST /admin/models/activate
Headers:
  X-API-Key: your-secret-key
  Content-Type: application/json

Body:
{
  "modelKey": "qwen2.5-7b-instruct",
  "instanceId": "primary-qwen",
  "defaultInference": {
    "temperature": 0.3
  }
}

Response: 200 OK
{
  "status": "activated",
  "modelKey": "qwen2.5-7b-instruct"
}
```

### Debug API

#### Stream Debug Events (SSE)
```http
GET /debug/stream
Headers:
  X-API-Key: your-secret-key
  Accept: text/event-stream

Response: Server-Sent Events stream
event: connected
data: {"timestamp": "2025-11-15T10:30:00Z", "message": "Debug stream connected"}

event: model_load_start
data: {"modelKey": "qwen2.5-7b-instruct", "timestamp": "2025-11-15T10:30:00Z"}

event: inference_complete
data: {"requestId": "abc123", "totalTimeMs": 7890}
```

#### Get Current Status
```http
GET /debug/status
Headers:
  X-API-Key: your-secret-key

Response: 200 OK
{
  "status": "idle",
  "currentOperation": null,
  "activeModel": {
    "modelKey": "qwen2.5-7b-instruct",
    "instanceId": "primary-qwen"
  }
}
```

#### Get Performance Metrics
```http
GET /debug/metrics
Headers:
  X-API-Key: your-secret-key

Response: 200 OK
{
  "modelInfo": {
    "modelKey": "qwen2.5-7b-instruct"
  },
  "performance": {
    "totalRequests": 45,
    "totalErrors": 2
  },
  "system": {
    "uptime": 3600.5,
    "memoryUsage": {...}
  }
}
```

### Proxy API (OpenAI-compatible)

All `/v1/*` endpoints are proxied to LM Studio with automatic model injection:

```http
POST /v1/chat/completions
Headers:
  X-API-Key: your-secret-key
  Content-Type: application/json

Body:
{
  "messages": [
    {"role": "user", "content": "Hello!"}
  ]
  // "model" is auto-injected from active model if missing
  // default inference params are auto-injected if missing
}
```

### Health Check

```http
GET /health

Response: 200 OK
{
  "status": "ok",
  "timestamp": "2025-11-15T10:30:00Z",
  "uptime": 3600.5
}
```

## Docker Deployment

```bash
# Build and run with docker-compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Docker Configuration Notes

- For Docker Desktop (Mac/Windows), LM Studio on host is accessible via `host.docker.internal:1234`
- Update `LMSTUDIO_BASE_URL` in `.env` accordingly
- For Linux, use `--network host` or configure bridge networking

## Development

```bash
# Run in development mode with auto-reload
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Fix lint errors
npm run lint:fix

# Format code
npm run format

# Type check
npm run type-check

# Run all checks
npm run check

# Build for production
npm run build

# Clean build artifacts
npm run clean
```

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

## Security

### Best Practices

- **ALWAYS set `GATEWAY_API_KEY` in production** - never run without authentication
- **Use IP allow-listing** - restrict to known LAN subnets
- **Never expose to public internet** - LAN only, use VPN if remote access needed
- **Keep secrets in environment variables** - never commit to git
- **Use HTTPS in production** - terminate SSL at reverse proxy (nginx/Traefik)
- **Rotate API keys regularly** - use secrets management
- **Validate all inputs** - Zod schemas handle this automatically
- **Log security events** - unauthorized access attempts, IP blocks
- **Keep dependencies updated** - run `npm outdated` regularly

### Security Features

- API key authentication via `X-API-Key` header
- IP/CIDR allowlist with IPv4 and IPv6 support
- Security headers via helmet
- Input validation with Zod
- Structured logging with Winston

## Architecture

### Directory Structure

```
lmstudio-lan-api-typescript/
├── src/
│   ├── config/
│   │   ├── settings.ts           # Zod-based configuration
│   │   └── logger.ts             # Winston logger
│   ├── middleware/
│   │   ├── ipAllowlist.ts        # IP/CIDR allowlist
│   │   └── apiKey.ts             # API key auth
│   ├── types/
│   │   └── models.ts             # Zod schemas & types
│   ├── routes/
│   │   ├── admin.ts              # /admin router
│   │   ├── debug.ts              # /debug router
│   │   └── proxy.ts              # /v1 proxy router
│   ├── utils/
│   │   └── eventBroadcaster.ts   # SSE events
│   └── index.ts                  # Express app
├── tests/
│   ├── unit/                     # Unit tests
│   └── integration/              # Integration tests
├── dist/                         # Compiled JS (gitignored)
├── .env.example                  # Environment template
├── Dockerfile                    # Docker config
├── docker-compose.yml            # Docker Compose
└── README.md                     # This file
```

### Key Design Patterns

- **Gateway Pattern**: Separation of concerns between gateway and LM Studio
- **Type Safety**: Zod for runtime validation + TypeScript for compile-time safety
- **Middleware Chain**: Security → Authentication → Route Handling → Error Handling
- **SSE Broadcasting**: Real-time debugging via Server-Sent Events
- **State Management**: Express app locals for application state
- **Error Handling**: Custom error classes + global error handler

## Troubleshooting

### Common Issues

1. **LM Studio connection failed**
   ```
   Error: ECONNREFUSED / Service unavailable

   Solutions:
   - Verify LM Studio is running
   - Check LMSTUDIO_BASE_URL in .env
   - Ensure LM Studio API server is enabled
   - Test: curl http://127.0.0.1:1234/v1/models
   ```

2. **401 Unauthorized**
   ```
   Solutions:
   - Check X-API-Key header matches GATEWAY_API_KEY
   - Verify .env file is loaded
   - For /health, check REQUIRE_AUTH_FOR_HEALTH
   ```

3. **403 Forbidden**
   ```
   Solutions:
   - Check client IP is in IP_ALLOWLIST
   - Verify CIDR notation (e.g., 192.168.0.0/24)
   - Try IP_ALLOWLIST=* for testing (NOT production)
   ```

4. **Port already in use**
   ```
   Solutions:
   - Check if another process is using port 8001
   - Use different port: GATEWAY_PORT=8002 npm run dev
   - Kill existing: lsof -ti:8001 | xargs kill
   ```

## License

MIT

## Contributing

Contributions welcome! Please read CONTRIBUTING.md for guidelines.

## Acknowledgments

- Built with TypeScript, Express.js, and Zod
- Inspired by LM Studio's powerful local AI capabilities
- Designed for secure LAN deployment

---

**Note**: This gateway is designed for LAN use only. Never expose directly to the internet without proper security measures (reverse proxy with SSL, firewall rules, etc.).
