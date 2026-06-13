import { spawnSync } from 'child_process';

console.log('[*] Starting build process for Commit-Copilot...');
console.log();

console.log('[*] Step 1: Installing dependencies...');
console.log();

const installResult = spawnSync('npm', ['install'], {
  stdio: 'inherit',
  shell: true,
});
if (installResult.status !== 0) {
  console.error('[!] npm install failed');
  process.exit(installResult.status ?? 1);
}

console.log();
console.log('[*] Step 2: Packaging VS Code Extension (.vsix)...');
console.log();

const packageResult = spawnSync('npx', ['vsce', 'package'], {
  stdio: 'inherit',
  shell: true,
});
const cleanResult = spawnSync('npm', ['run', 'clean'], {
  stdio: 'inherit',
  shell: true,
});

if (packageResult.status !== 0 || cleanResult.status !== 0) {
  console.error('[!] vsce package failed');
  process.exit(
    packageResult.status !== 0
      ? (packageResult.status ?? 1)
      : (cleanResult.status ?? 1),
  );
}

console.log('[*] Build completed successfully!');
console.log();
