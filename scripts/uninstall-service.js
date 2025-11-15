/**
 * Windows Service Uninstallation Script
 *
 * This script removes the LM Studio LAN Gateway Windows service.
 *
 * Prerequisites:
 * - Run this script as Administrator
 *
 * Usage:
 *   node scripts/uninstall-service.js
 */

const Service = require('node-windows').Service;
const path = require('path');

// Project root directory
const projectRoot = path.join(__dirname, '..');

// Path to the compiled JavaScript entry point
const scriptPath = path.join(projectRoot, 'dist', 'index.js');

// Create a new service object (must match installation config)
const svc = new Service({
  name: 'LMStudioLANGateway',
  script: scriptPath
});

// Listen for the "uninstall" event
svc.on('uninstall', function() {
  console.log('✅ Service uninstalled successfully!');
  console.log('   The service has been removed from Windows Services.');
  console.log('   It will no longer start automatically on system boot.');
  console.log('\nTo reinstall the service, run:');
  console.log('   node scripts/install-service.js');
});

// Listen for errors
svc.on('error', function(err) {
  console.error('❌ Error uninstalling service:', err);
  process.exit(1);
});

// Listen for "alreadyuninstalled" event
svc.on('alreadyuninstalled', function() {
  console.log('⚠️  Service is not installed or already uninstalled.');
  process.exit(0);
});

// Pre-uninstallation info
console.log('🔧 Uninstalling LM Studio LAN Gateway Windows Service...\n');
console.log('Service Name:', svc.name);
console.log('\n⚠️  IMPORTANT: This script must be run as Administrator\n');

// Check if service exists before attempting uninstall
console.log('Checking if service is installed...');
console.log('If the service is running, it will be stopped first.\n');

// Stop the service if it's running
svc.on('stop', function() {
  console.log('Service stopped.');
  console.log('Proceeding with uninstallation...\n');
});

// Uninstall the service
svc.uninstall();
