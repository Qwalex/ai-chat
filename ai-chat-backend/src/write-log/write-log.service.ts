import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

const LOGS_DIR = path.join(process.cwd(), 'logs');
const USAGE_LOG_PATH = path.join(LOGS_DIR, 'usage.log');

const ensureLogDir = (): void => {
  try {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  } catch {
    // ignore
  }
};

@Injectable()
export class WriteLogService {
  writeLog = (message: string | object): void => {
    ensureLogDir();
    const line = typeof message === 'object' ? JSON.stringify(message) : String(message);
    fs.appendFileSync(USAGE_LOG_PATH, line + '\n');
  };
}
