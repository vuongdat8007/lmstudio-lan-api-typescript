# Windows Service Setup Guide

This guide explains how to install the LM Studio LAN Gateway as a Windows service that automatically starts on system boot.

## Overview

Installing as a Windows service provides several benefits:
- ✅ Automatic startup on system reboot
- ✅ Runs in the background without keeping a terminal open
- ✅ Managed through Windows Services console
- ✅ Automatic restart on failure
- ✅ Runs even when no user is logged in

## Prerequisites

Before installing the service:

1. **Administrator Access** - You must run the installation as Administrator
2. **Build the Project** - The TypeScript code must be compiled to JavaScript
3. **Configure Environment** - Set up your `.env` file with production settings

## Quick Start

### Step 1: Build the Project

Open a terminal in the project directory and build:

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

### Step 2: Configure for Production

Edit your `.env` file with production settings:

```env
# LM Studio API Configuration
LMSTUDIO_BASE_URL=http://127.0.0.1:1234

# Gateway Server Configuration
GATEWAY_HOST=0.0.0.0
GATEWAY_PORT=8002

# Security Configuration - CHANGE THIS!
GATEWAY_API_KEY=your-strong-random-api-key-here

# IP Allow-listing - RESTRICT THIS!
IP_ALLOWLIST=192.168.1.0/24

# Allow unauthenticated health checks
REQUIRE_AUTH_FOR_HEALTH=false

# Logging Configuration
LOG_LEVEL=info

# Node Environment
NODE_ENV=production
```

**Important Security Notes:**
- ⚠️ Change `GATEWAY_API_KEY` to a strong, random value
- ⚠️ Restrict `IP_ALLOWLIST` to your specific network range
- ⚠️ Never use `IP_ALLOWLIST=*` in production

### Step 3: Install the Service

Open **PowerShell or Command Prompt as Administrator**:

```bash
# Method 1: Using npm script (recommended)
npm run service:install

# Method 2: Direct script execution
node scripts/install-service.js
```

The installation script will:
1. ✅ Verify the build exists
2. ✅ Create the Windows service
3. ✅ Configure automatic startup
4. ✅ Start the service immediately

You should see output like:

```
✅ Service installed successfully!
   Name: LMStudioLANGateway
   Description: LM Studio LAN API Gateway - TypeScript Edition
   Script: C:\Dat\lmstudio-lan-api-typescript\dist\index.js

Starting the service...
✅ Service started successfully!

Service Details:
   Status: Running
   Startup Type: Automatic

⚠️  Note: The service will start automatically on system reboot.
```

### Step 4: Verify the Service

Check that the service is running:

```bash
# PowerShell
Get-Service LMStudioLANGateway

# Command Prompt
sc query LMStudioLANGateway
```

Test the gateway:

```bash
# Health check
curl http://localhost:8002/health

# With API key
curl -H "X-API-Key: your-api-key" http://localhost:8002/admin/models
```

## Managing the Service

### Using Windows Services Console

1. Press `Win + R`
2. Type `services.msc` and press Enter
3. Find "LMStudioLANGateway" in the list
4. Right-click for options:
   - **Start** - Start the service
   - **Stop** - Stop the service
   - **Restart** - Restart the service
   - **Properties** - View/modify service settings

### Using PowerShell

```powershell
# Check service status
Get-Service LMStudioLANGateway

# Start the service
Start-Service LMStudioLANGateway

# Stop the service
Stop-Service LMStudioLANGateway

# Restart the service
Restart-Service LMStudioLANGateway

# Get detailed info
Get-Service LMStudioLANGateway | Format-List *
```

### Using Command Prompt (sc)

```cmd
# Query service status
sc query LMStudioLANGateway

# Start the service
sc start LMStudioLANGateway

# Stop the service
sc stop LMStudioLANGateway

# Get service configuration
sc qc LMStudioLANGateway
```

## Uninstalling the Service

When you need to remove the service:

### Step 1: Stop the Service (if running)

```bash
# PowerShell
Stop-Service LMStudioLANGateway

# Or use Command Prompt
sc stop LMStudioLANGateway
```

### Step 2: Uninstall the Service

Open **PowerShell or Command Prompt as Administrator**:

```bash
# Method 1: Using npm script (recommended)
npm run service:uninstall

# Method 2: Direct script execution
node scripts/uninstall-service.js
```

You should see:

```
✅ Service uninstalled successfully!
   The service has been removed from Windows Services.
   It will no longer start automatically on system boot.
```

## Service Configuration Details

The service is configured with the following settings:

- **Service Name:** `LMStudioLANGateway`
- **Display Name:** LMStudioLANGateway
- **Description:** LM Studio LAN API Gateway - TypeScript Edition
- **Startup Type:** Automatic
- **Recovery:**
  - First failure: Restart the service
  - Second failure: Restart the service
  - Subsequent failures: Restart the service
  - Restart delay: 2 seconds (with exponential backoff)
  - Maximum restarts: 10 attempts

## Viewing Service Logs

The service logs to **Windows Event Viewer**:

1. Press `Win + R`
2. Type `eventvwr.msc` and press Enter
3. Navigate to: **Windows Logs → Application**
4. Look for events with source containing "LMStudioLANGateway"

Alternatively, the service inherits the application's Winston logging configuration, which logs to:
- **Console output** (captured by Windows service wrapper)
- **Event Viewer** (Application log)

## Troubleshooting

### Service Won't Start

**Problem:** Service status shows "Stopped" or "Error"

**Solutions:**

1. **Check the build exists:**
   ```bash
   dir dist\index.js
   ```
   If not found, run: `npm run build`

2. **Verify .env file:**
   ```bash
   dir .env
   ```
   If not found, copy from `.env.example`

3. **Check Event Viewer for errors:**
   - Open Event Viewer (`eventvwr.msc`)
   - Look for recent errors in Application log

4. **Test the build manually:**
   ```bash
   node dist/index.js
   ```
   This will show any runtime errors

### Port Already in Use

**Problem:** Service fails with "EADDRINUSE" error

**Solutions:**

1. **Find what's using the port:**
   ```bash
   netstat -ano | findstr :8002
   ```

2. **Change the port in `.env`:**
   ```env
   GATEWAY_PORT=8003
   ```

3. **Restart the service:**
   ```bash
   Restart-Service LMStudioLANGateway
   ```

### Service Can't Connect to LM Studio

**Problem:** Service returns "503 Service Unavailable" or "LM Studio API unreachable"

**Solutions:**

1. **Ensure LM Studio is running:**
   - Start LM Studio application
   - Enable the API server in LM Studio settings

2. **Verify LM Studio URL in `.env`:**
   ```env
   LMSTUDIO_BASE_URL=http://127.0.0.1:1234
   ```

3. **Test LM Studio API directly:**
   ```bash
   curl http://127.0.0.1:1234/v1/models
   ```

### Permission Denied / Access Denied

**Problem:** Installation fails with permission errors

**Solutions:**

1. **Run as Administrator:**
   - Right-click PowerShell or Command Prompt
   - Select "Run as Administrator"

2. **Check User Account Control (UAC):**
   - Ensure UAC is not blocking the installation
   - Temporarily disable antivirus if needed

3. **Verify file permissions:**
   - Ensure the project directory is accessible
   - Check that `dist/index.js` is readable

### Service Installed but Not Auto-Starting

**Problem:** Service doesn't start on reboot

**Solutions:**

1. **Verify startup type:**
   ```bash
   sc qc LMStudioLANGateway
   ```
   Look for: `START_TYPE: 2 AUTO_START`

2. **Set to automatic if needed:**
   ```bash
   sc config LMStudioLANGateway start= auto
   ```

3. **Check service dependencies:**
   - LM Studio must also be running for the gateway to work
   - Consider starting LM Studio automatically as well

## Updating the Service

When you update the code:

1. **Stop the service:**
   ```bash
   Stop-Service LMStudioLANGateway
   ```

2. **Pull/make your changes**

3. **Rebuild:**
   ```bash
   npm run build
   ```

4. **Start the service:**
   ```bash
   Start-Service LMStudioLANGateway
   ```

**Note:** You don't need to uninstall/reinstall for code updates, just rebuild and restart!

## Security Recommendations

When running as a service in production:

1. **Use a Strong API Key:**
   ```bash
   # Generate a random key (PowerShell)
   -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
   ```

2. **Restrict IP Access:**
   ```env
   # Only allow local network
   IP_ALLOWLIST=192.168.1.0/24
   ```

3. **Use HTTPS:**
   - Put the gateway behind a reverse proxy (nginx, IIS, Caddy)
   - Terminate SSL at the reverse proxy

4. **Monitor Logs:**
   - Regularly check Event Viewer for suspicious activity
   - Set up alerts for repeated failures

5. **Keep Updated:**
   - Regularly update dependencies: `npm update`
   - Check for security vulnerabilities: `npm audit`

## Advanced Configuration

### Running as a Different User

By default, the service runs as Local System. To run as a different user:

1. Open Services console (`services.msc`)
2. Right-click "LMStudioLANGateway" → Properties
3. Go to "Log On" tab
4. Select "This account" and enter credentials
5. Apply and restart the service

### Custom Service Recovery Options

To customize restart behavior:

1. Open Services console (`services.msc`)
2. Right-click "LMStudioLANGateway" → Properties
3. Go to "Recovery" tab
4. Configure:
   - First failure action
   - Second failure action
   - Subsequent failures action
   - Reset fail count after (days)
   - Restart service after (minutes)

## Alternative: NSSM (Non-Sucking Service Manager)

If you prefer an alternative to node-windows, you can use NSSM:

### Install NSSM

1. Download from: https://nssm.cc/download
2. Extract to a folder (e.g., `C:\nssm`)
3. Add to PATH or use full path

### Install Service with NSSM

```bash
# Open Command Prompt as Administrator
cd C:\Dat\lmstudio-lan-api-typescript

# Install service
nssm install LMStudioLANGateway "C:\Program Files\nodejs\node.exe" "C:\Dat\lmstudio-lan-api-typescript\dist\index.js"

# Set working directory
nssm set LMStudioLANGateway AppDirectory "C:\Dat\lmstudio-lan-api-typescript"

# Set environment variables
nssm set LMStudioLANGateway AppEnvironmentExtra NODE_ENV=production

# Start the service
nssm start LMStudioLANGateway
```

### Uninstall with NSSM

```bash
nssm stop LMStudioLANGateway
nssm remove LMStudioLANGateway confirm
```

## Getting Help

If you encounter issues:

1. **Check logs in Event Viewer**
2. **Test the build manually:** `node dist/index.js`
3. **Verify configuration:** Check `.env` file
4. **Review this guide** for common solutions
5. **Check GitHub Issues** for similar problems

## Summary

After following this guide, you should have:
- ✅ LM Studio LAN Gateway running as a Windows service
- ✅ Automatic startup on system reboot
- ✅ Proper security configuration
- ✅ Knowledge of how to manage and troubleshoot the service

The gateway will now start automatically whenever Windows boots, ensuring continuous availability of your LM Studio API! 🚀
