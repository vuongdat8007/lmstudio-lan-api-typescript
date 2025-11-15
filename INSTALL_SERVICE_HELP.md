# Service Installation Help

## ⚠️ Issue: Service Installation Failed

If you see "Service installed successfully" but the service doesn't actually exist, this means the installation script ran **without Administrator privileges**.

### Symptoms

```powershell
PS> Get-Service LMStudioLANGateway
Get-Service : Cannot find any service with service name 'LMStudioLANGateway'.
```

The script appeared to succeed but the service wasn't actually registered with Windows.

## ✅ Solution: Run as Administrator

You **MUST** run the installation with Administrator privileges. Here are three methods:

### Method 1: Using the Batch File (Easiest)

Simply double-click on this file:
```
scripts\install-service.bat
```

This will:
1. Automatically detect if you're running as Administrator
2. Request elevation (UAC prompt will appear)
3. Install the service with proper privileges

**Uninstall:**
```
scripts\uninstall-service.bat
```

### Method 2: PowerShell as Administrator

1. **Right-click** on PowerShell icon
2. Select **"Run as Administrator"**
3. Navigate to project directory:
   ```powershell
   cd C:\Dat\lmstudio-lan-api-typescript
   ```
4. If you get execution policy error, run:
   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   ```
5. Install the service:
   ```powershell
   npm run service:install
   ```

### Method 3: Command Prompt as Administrator

1. **Right-click** on Command Prompt icon
2. Select **"Run as Administrator"**
3. Navigate to project directory:
   ```cmd
   cd C:\Dat\lmstudio-lan-api-typescript
   ```
4. Install the service:
   ```cmd
   npm run service:install
   ```

## Verifying Installation

After installing with Administrator privileges, verify the service exists:

```powershell
# PowerShell
Get-Service LMStudioLANGateway

# Command Prompt
sc query LMStudioLANGateway
```

You should see:

```
Status Name                 DisplayName
------ ----                 -----------
Running LMStudioLANGateway   LMStudioLANGateway
```

## Testing the Service

Test that the gateway is responding:

```bash
# Health check
curl http://localhost:8002/health

# Should return:
# {"status":"ok","timestamp":"...","uptime":...}
```

## PowerShell Execution Policy Error

If you see:

```
npm : File C:\Program Files\nodejs\npm.ps1 cannot be loaded because
running scripts is disabled on this system.
```

**Fix:** Either use Command Prompt instead, or temporarily bypass the policy:

```powershell
# Option 1: For current PowerShell session only (safe)
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

# Then run:
npm run service:install
```

```powershell
# Option 2: Use Command Prompt
cmd
npm run service:install
```

## Still Having Issues?

### Check if build exists

```bash
dir dist\index.js
```

If not found:
```bash
npm run build
```

### Check Event Viewer for errors

1. Press `Win + X`, select **Event Viewer**
2. Navigate to: **Windows Logs → Application**
3. Look for recent errors from source "LMStudioLANGateway" or "node-windows"

### Manual service check

List all services containing "LM":
```cmd
sc query type= service state= all | findstr /i "lm"
```

### Check daemon directory

If installation was successful, you should see:
```bash
dir daemon
```

This directory contains the service wrapper files.

## Clean Slate Reinstall

If you attempted installation without Administrator privileges:

1. **Delete any partial installation:**
   ```bash
   rd /s /q daemon
   ```

2. **Install with Administrator privileges** using one of the methods above

3. **Verify the service:**
   ```cmd
   sc query LMStudioLANGateway
   ```

## Summary

The key points:

✅ **MUST run as Administrator** - Both installation and uninstallation
✅ **Use batch files** - They auto-request elevation (easiest method)
✅ **PowerShell policy** - Use Command Prompt if you encounter execution policy errors
✅ **Verify installation** - Use `Get-Service` or `sc query` to confirm
✅ **Build first** - Ensure `npm run build` was run before installing

---

**Quick Install (Recommended):**

1. Build: `npm run build`
2. Double-click: `scripts\install-service.bat`
3. Click "Yes" on UAC prompt
4. Wait for "Service started successfully!"
5. Verify: `Get-Service LMStudioLANGateway`

That's it! The service will now start automatically on Windows reboot. 🚀
