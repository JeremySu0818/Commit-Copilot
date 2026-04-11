const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const createProblemMatcherPlugin = (label) => {
  return {
    name: `esbuild-problem-matcher-${label.toLowerCase()}`,
    setup(build) {
      build.onStart(() => {
        console.log(`[*] ${label}: esbuild started...`);
      });
      build.onEnd((result) => {
        result.errors.forEach(({ text, location }) => {
          console.error(`[!] ${label} Error: ${text}`);
          if (location) {
            console.error(
              `    ${location.file}:${location.line}:${location.column}:`,
            );
          }
        });
        if (result.errors.length === 0) {
          console.log(`[*] ${label}: esbuild finished successfully.`);
        }
      });
    },
  };
};

async function main() {
  const extensionCtx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    outfile: 'out/extension.js',
    external: ['vscode'],
    logLevel: 'silent',
    plugins: [createProblemMatcherPlugin('Extension')],
  });

  const webviewCtx = await esbuild.context({
    entryPoints: ['src/webview/side-panel.tsx'],
    bundle: true,
    format: 'iife',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'browser',
    target: ['es2020'],
    outfile: 'out/webview/side-panel.js',
    logLevel: 'silent',
    plugins: [createProblemMatcherPlugin('Webview')],
  });

  if (watch) {
    await Promise.all([extensionCtx.watch(), webviewCtx.watch()]);
    console.log('[*] Watching for changes...');
  } else {
    await Promise.all([extensionCtx.rebuild(), webviewCtx.rebuild()]);
    await Promise.all([extensionCtx.dispose(), webviewCtx.dispose()]);
    console.log('\n');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
