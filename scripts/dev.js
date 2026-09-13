const path = require('path');
const { spawn, execSync } = require('child_process');

// Ensure System32 is always in PATH and Path on Windows to avoid ENOENT cmd.exe errors
if (process.platform === 'win32') {
  const sys32 = 'C:\\Windows\\System32';
  const winDir = 'C:\\Windows';
  const currentPath = process.env.PATH || process.env.Path || '';
  const newPath = `${sys32};${winDir};${currentPath}`;
  process.env.PATH = newPath;
  process.env.Path = newPath;
  if (!process.env.COMSPEC) process.env.COMSPEC = `${sys32}\\cmd.exe`;
  if (!process.env.ComSpec) process.env.ComSpec = `${sys32}\\cmd.exe`;
}

// Ensure ports 4000 and 3000 aren't held by orphaned processes from previous runs
function freePortIfBusy(port) {
  if (process.platform !== 'win32') return;
  try {
    const output = execSync(`netstat -ano | findstr :${port}`, {
      env: process.env,
      stdio: ['pipe', 'pipe', 'ignore'],
    }).toString();
    const lines = output.split(/\r?\n/);
    for (const line of lines) {
      if (line.includes('LISTENING')) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0' && pid !== String(process.pid)) {
          try {
            execSync(`taskkill /F /PID ${pid}`, { env: process.env, stdio: 'ignore' });
            console.log(`[DEV] Freed port ${port} by terminating lingering process (PID ${pid})`);
          } catch {}
        }
      }
    }
  } catch {}
}

freePortIfBusy(4000);
freePortIfBusy(3000);

const concurrentlyBin = path.resolve(__dirname, '../node_modules/concurrently/dist/bin/concurrently.js');
const args = [
  concurrentlyBin,
  '--kill-others',
  '-n',
  'SERVER,CLIENT',
  '-c',
  'bgBlue.bold,bgMagenta.bold',
  'npm run dev:server',
  'npm run dev:client',
];

const child = spawn(process.execPath, args, {
  stdio: 'inherit',
  env: process.env,
});

const cleanup = () => {
  if (child && !child.killed) {
    if (process.platform === 'win32') {
      try {
        execSync(`taskkill /F /T /PID ${child.pid}`, { env: process.env, stdio: 'ignore' });
      } catch {}
    } else {
      child.kill('SIGTERM');
    }
  }
};

process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});

child.on('exit', (code) => {
  cleanup();
  process.exit(code || 0);
});

