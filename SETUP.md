# Setup Guide - LM Studio LAN API Gateway (TypeScript)

## Prerequisites Checklist

Before you can run this project, ensure you have:

- [ ] **Node.js 20+** installed ([Download here](https://nodejs.org/))
- [ ] **LM Studio** running locally (default: `http://127.0.0.1:1234`)
- [ ] **Git** (already installed, since you cloned this repo)

## Installation Steps

### 1. Verify Node.js Installation

```bash
node --version   # Should show v20.x.x or higher
npm --version    # Should show 10.x.x or higher
```

**If Node.js is not installed:**
- Download from https://nodejs.org/ (LTS version recommended)
- Install with default settings
- Restart your terminal/VS Code
- Verify installation with commands above

### 2. Install Dependencies

```bash
npm install
```

This will install all required packages:
- express, cors, helmet (web framework)
- winston (logging)
- axios (HTTP client)
- zod (validation)
- TypeScript and dev tools

**Expected time:** 1-2 minutes

### 3. Configure Environment

✅ **Already done!** The `.env` file has been created for you.

**Important settings to review in `.env`:**

```bash
# Change this for production!
GATEWAY_API_KEY=change-me-please

# Adjust IP allowlist for your network
IP_ALLOWLIST=192.168.0.0/24,10.0.0.0/24

# Verify LM Studio is running at this URL
LMSTUDIO_BASE_URL=http://127.0.0.1:1234
```

**Security recommendations:**
- Set a strong `GATEWAY_API_KEY` before deploying
- Restrict `IP_ALLOWLIST` to your LAN subnet
- Never expose this gateway to the public internet directly

### 4. Verify Setup

Run these commands to ensure everything is configured correctly:

```bash
# Type check (verify TypeScript compiles)
npm run type-check

# Run linting
npm run lint

# Run unit tests
npm test
```

### 5. Build the Project

```bash
# Compile TypeScript to JavaScript
npm run build
```

This creates the `dist/` directory with compiled JavaScript.

### 6. Start the Development Server

```bash
# Development mode with auto-reload
npm run dev
```

The gateway will start on `http://0.0.0.0:8001` (or your configured port).

You should see output like:
```
2025-11-15 10:30:00 [info]: Server started { port: 8001, host: '0.0.0.0' }
```

## Verifying the Installation

### Health Check

```bash
curl http://localhost:8001/health
```

Expected response: `{"status":"ok"}`

### Test API Key Authentication

```bash
# Without API key (should fail with 401)
curl http://localhost:8001/admin/models

# With API key (should succeed)
curl -H "X-API-Key: change-me-please" http://localhost:8001/admin/models
```

### Test LM Studio Connection

Ensure LM Studio is running, then:

```bash
curl -H "X-API-Key: change-me-please" http://localhost:8001/admin/models
```

If successful, you'll see a list of available models.

## Available NPM Scripts

```bash
# Development
npm run dev          # Start with auto-reload (tsx watch)
npm start            # Start production build (requires npm run build first)

# Building
npm run build        # Compile TypeScript to JavaScript
npm run clean        # Remove dist/ directory

# Code Quality
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint errors automatically
npm run format       # Format code with Prettier
npm run type-check   # TypeScript type checking

# Testing
npm test             # Run all tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report

# All checks
npm run check        # Run lint + type-check + tests
```

## Project Structure

```
lmstudio-lan-api-typescript/
├── src/
│   ├── config/           # Configuration and logging
│   ├── middleware/       # Auth and security middleware
│   ├── routes/           # API route handlers
│   ├── types/            # TypeScript types and Zod schemas
│   ├── utils/            # Utility functions
│   └── index.ts          # Application entry point
├── tests/
│   └── unit/             # Unit tests
├── .env                  # Environment configuration (created)
├── .env.example          # Environment template
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── README.md             # Project documentation
```

## Common Issues

### Issue: "npm: command not found"
**Solution:** Node.js is not installed or not in PATH. Install from nodejs.org

### Issue: "ECONNREFUSED" when accessing /admin/models
**Solution:** LM Studio is not running. Start LM Studio and enable the API server.

### Issue: "401 Unauthorized"
**Solution:** Include the API key header: `-H "X-API-Key: your-key-here"`

### Issue: "403 Forbidden"
**Solution:** Your IP is not in the allowlist. Update `IP_ALLOWLIST` in `.env` or use `IP_ALLOWLIST=*` for testing.

### Issue: Port 8001 already in use
**Solution:** Change port in `.env`: `GATEWAY_PORT=8002`

## Next Steps

Once the server is running:

1. **Load a model** via the admin API
2. **Test inference** through the `/v1/chat/completions` proxy
3. **Monitor in real-time** using the debug SSE stream
4. **Review logs** for troubleshooting

## API Documentation

See [README.md](README.md) for complete API documentation including:
- Admin endpoints (model management)
- Debug endpoints (real-time monitoring)
- Proxy endpoints (OpenAI-compatible)

## Development Workflow

1. Make code changes in `src/`
2. Server auto-reloads (if using `npm run dev`)
3. Run tests: `npm test`
4. Check types: `npm run type-check`
5. Format code: `npm run format`
6. Commit changes

## Production Deployment

### Option 1: Windows Service (Recommended for Windows)

Install as a Windows service for automatic startup on reboot:

```bash
# 1. Build the project
npm run build

# 2. Configure production settings in .env
# - Set strong GATEWAY_API_KEY
# - Restrict IP_ALLOWLIST to your network
# - Set NODE_ENV=production

# 3. Install as Windows service (run as Administrator)
npm run service:install
```

**Benefits:**
- ✅ Automatic startup on Windows reboot
- ✅ Runs in background without keeping terminal open
- ✅ Managed through Windows Services console
- ✅ Automatic restart on failure

See [WINDOWS_SERVICE.md](WINDOWS_SERVICE.md) for complete instructions.

### Option 2: Manual Production Run

For production use without Windows service:

```bash
# 1. Set production environment
NODE_ENV=production

# 2. Set strong API key
GATEWAY_API_KEY=<strong-random-key>

# 3. Restrict IP allowlist
IP_ALLOWLIST=192.168.1.0/24

# 4. Build and run
npm run build
npm start
```

### Option 3: Docker

Or use Docker:

```bash
docker-compose up -d
```

---

**Need help?** Check [CLAUDE.md](CLAUDE.md) for detailed architecture documentation or [WINDOWS_SERVICE.md](WINDOWS_SERVICE.md) for Windows service setup.
