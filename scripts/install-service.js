/**
 * Windows Service Installation Script
 *
 * This script installs the LM Studio LAN Gateway as a Windows service
 * that will automatically start on system boot.
 *
 * Prerequisites:
 * - Run this script as Administrator
 * - Build the project first: npm run build
 *
 * Usage:
 *   node scripts/install-service.js
 */

const Service = require('node-windows').Service;
const path = require('path');

// Project root directory
const projectRoot = path.join(__dirname, '..');

// Path to the compiled JavaScript entry point
const scriptPath = path.join(projectRoot, 'dist', 'index.js');

// Create a new service object
const svc = new Service({
  name: 'LMStudioLANGateway',
  description: 'LM Studio LAN API Gateway - TypeScript Edition',
  script: scriptPath,
  nodeOptions: [
    '--max_old_space_size=4096'
  ],
  env: [
    {
      name: 'NODE_ENV',
      value: 'production'
    }
  ],
  workingDirectory: projectRoot,
  allowServiceLogon: true,
  // Restart the service if it crashes
  wait: 2,
  grow: 0.5,
  maxRestarts: 10
});

// Listen for the "install" event
svc.on('install', function() {
  console.log('✅ Service installed successfully!');
  console.log('   Name:', svc.name);
  console.log('   Description:', svc.description);
  console.log('   Script:', scriptPath);
  console.log('\nStarting the service...');
  svc.start();
});

// Listen for the "start" event
svc.on('start', function() {
  console.log('✅ Service started successfully!');
  console.log('\nService Details:');
  console.log('   Status: Running');
  console.log('   Startup Type: Automatic');
  console.log('\nYou can manage the service using:');
  console.log('   - Windows Services (services.msc)');
  console.log('   - PowerShell: Get-Service LMStudioLANGateway');
  console.log('   - Command: sc query LMStudioLANGateway');
  console.log('\nTo uninstall the service, run:');
  console.log('   node scripts/uninstall-service.js');
  console.log('\n⚠️  Note: The service will start automatically on system reboot.');
});

// Listen for errors
svc.on('error', function(err) {
  console.error('❌ Error installing service:', err);
  process.exit(1);
});

// Listen for "alreadyinstalled" event
svc.on('alreadyinstalled', function() {
  console.log('⚠️  Service is already installed!');
  console.log('   To reinstall:');
  console.log('   1. Run: node scripts/uninstall-service.js');
  console.log('   2. Wait for service to uninstall');
  console.log('   3. Run: node scripts/install-service.js');
  process.exit(0);
});

// Pre-installation checks
console.log('🔧 Installing LM Studio LAN Gateway as Windows Service...\n');
console.log('Project Root:', projectRoot);
console.log('Script Path:', scriptPath);
console.log('Service Name:', svc.name);
console.log('\n⚠️  IMPORTANT NOTES:');
console.log('   1. This script must be run as Administrator');
console.log('   2. The project must be built first (npm run build)');
console.log('   3. The .env file will be loaded from project root');
console.log('   4. Service logs will be in Windows Event Viewer\n');

// Check if the script file exists
const fs = require('fs');
if (!fs.existsSync(scriptPath)) {
  console.error('❌ Error: Compiled script not found!');
  console.error('   Expected location:', scriptPath);
  console.error('\n   Please run: npm run build');
  process.exit(1);
}

// Check if .env file exists
const envPath = path.join(projectRoot, '.env');
if (!fs.existsSync(envPath)) {
  console.warn('⚠️  Warning: .env file not found!');
  console.warn('   Expected location:', envPath);
  console.warn('   The service will use default configuration.');
  console.warn('\n   Consider creating .env from .env.example\n');
}

console.log('Starting installation...\n');

// Install the service
svc.install();
