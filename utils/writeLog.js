import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USAGE_LOG_PATH = path.join(__dirname, '..', 'logs', 'usage.log');

const ensureLogDir = () => {
  const logDir = path.dirname(USAGE_LOG_PATH);
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch (_) {
    // ignore if exists
  }
};

export const writeLog = (message) => {
  ensureLogDir();
  const line = typeof message === 'object'
    ? JSON.stringify(message)
    : String(message);
  fs.appendFileSync(USAGE_LOG_PATH, line + '\n');
};
