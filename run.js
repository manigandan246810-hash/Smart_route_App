import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('====== SmartRoute Workspace Launcher ======');
console.log('Admin Console will start on: http://localhost:5173');
console.log('Backend API server will start on: http://localhost:5000');
console.log('------------------------------------------------------------');
console.log('To run the Driver Mobile App on your Android Phone:');
console.log('  1. Connect your physical phone via USB (with USB Debugging enabled)');
console.log('  2. Run `cd driver_app` and `flutter run` in a separate terminal');
console.log('  3. In the login screen, enter your PC\'s Wi-Fi IP address (e.g. 10.89.11.1)');
console.log('------------------------------------------------------------');
console.log('Starting services...');

// 1. Launch Backend Server
const serverPath = path.join(__dirname, 'backend');
const serverProcess = spawn('node', ['server.js'], {
  cwd: serverPath,
  shell: true,
  stdio: 'inherit'
});

// 2. Launch Client React Server
const clientPath = path.join(__dirname, 'client');
const clientProcess = spawn('npm', ['run', 'dev', '--', '--port', '5173'], {
    cwd: clientPath,
    shell: true,
    stdio: 'inherit'
});

serverProcess.on('error', (err) => {
    console.error('Failed to start Backend Server:', err);
});

clientProcess.on('error', (err) => {
    console.error('Failed to start Frontend Client:', err);
});

process.on('SIGINT', () => {
    console.log('\nShutting down all processes...');
    serverProcess.kill();
    clientProcess.kill();
    process.exit();
});
