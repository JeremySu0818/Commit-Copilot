const esbuild = require("esbuild");

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const esbuildProblemMatcherPlugin = {
    name: 'esbuild-problem-matcher',
    setup(build) {
        build.onStart(() => {
            console.log('[*] esbuild started...');
        });
        build.onEnd((result) => {
            result.errors.forEach(({ text, location }) => {
                console.error(`[!] Error: ${text}`);
                console.error(`    ${location.file}:${location.line}:${location.column}:`);
            });
            if (result.errors.length === 0) {
                console.log('[*] esbuild finished successfully.');
            }
        });
    },
};

async function main() {
    const ctx = await esbuild.context({
        entryPoints: [
            'src/extension.ts'
        ],
        bundle: true,
        format: 'cjs',
        minify: production,
        sourcemap: !production,
        sourcesContent: false,
        platform: 'node',
        outfile: 'out/extension.js',
        external: ['vscode'],
        logLevel: 'silent',
        plugins: [
            esbuildProblemMatcherPlugin,
        ],
    });

    if (watch) {
        await ctx.watch();
    } else {
        await ctx.rebuild();
        await ctx.dispose();
    }
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});