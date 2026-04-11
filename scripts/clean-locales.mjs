import fs from 'fs';
import path from 'path';

const root = process.cwd();

fs.readdirSync(root)
  .filter(f => f.startsWith('package.nls') && f.endsWith('.json'))
  .forEach(f => {
    try { fs.unlinkSync(path.join(root, f)); } catch (e) {}
  });
