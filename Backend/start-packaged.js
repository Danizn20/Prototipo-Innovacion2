import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

function getDefaultPersistDir() {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(process.env.USERPROFILE || 'C:\', 'AppData', 'Roaming'), 'PrototipoInnovacion');
  }

  if (process.platform === 'darwin') {
    return path.join(process.env.HOME || '/', 'Library', 'Application Support', 'PrototipoInnovacion');
  }

  return path.join(process.env.HOME || '/', '.prototipo_innovacion');
}

async function ensurePersistDb() {
  const persistDir = process.env.PROTOTIPO_DATA_DIR || getDefaultPersistDir();
  if (!fs.existsSync(persistDir)) {
    fs.mkdirSync(persistDir, { recursive: true });
  }

  const targetDb = path.join(persistDir, 'app.db');
  if (fs.existsSync(targetDb)) {
    return persistDir;
  }

  // possible bundled locations to copy initial DB from
  const candidates = [
    path.join(process.cwd(), 'Backend', 'data', 'app.db'),
    path.join(process.cwd(), 'data', 'app.db'),
    path.join(path.dirname(process.execPath), 'data', 'app.db'),
    path.join(path.dirname(process.execPath), 'app.db')
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      fs.copyFileSync(candidate, targetDb);
      console.log('Copied bundled DB from', candidate, 'to', targetDb);
      return persistDir;
    }
  }

  console.warn('No bundled app.db found in candidates; backend will start with a new DB at', targetDb);
  return persistDir;
}

async function main() {
  const persistDir = await ensurePersistDb();
  process.env.PROTOTIPO_DATA_DIR = persistDir;
  process.env.PROTOTIPO_UPLOADS_DIR = path.join(persistDir, 'uploads');

  // ensure uploads dir exists
  if (!fs.existsSync(process.env.PROTOTIPO_UPLOADS_DIR)) {
    fs.mkdirSync(process.env.PROTOTIPO_UPLOADS_DIR, { recursive: true });
  }

  // spawn the server
  const node = process.execPath || 'node';
  const serverPath = path.join(process.cwd(), 'Backend', 'src', 'server.js');

  const child = spawn(node, [serverPath], {
    stdio: 'inherit',
    env: { ...process.env }
  });

  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}

main().catch((err) => {
  console.error('Failed to start packaged backend:', err);
  process.exit(1);
});
