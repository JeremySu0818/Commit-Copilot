import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

function createTempDir(prefix: string = 'commit-copilot-test-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cleanupTempDir(dirPath: string): void {
  fs.rmSync(dirPath, { recursive: true, force: true });
}

export { createTempDir, cleanupTempDir };
