import fs from 'fs';
import path from 'path';

const srcDir = path.join(process.cwd(), 'i18n-manifest');
const destDir = process.cwd();

if (fs.existsSync(srcDir)) {
  const files = fs.readdirSync(srcDir);
  for (const file of files) {
    if (file.startsWith('package.nls') && file.endsWith('.json')) {
      fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
    }
  }
}
