// scripts/run-tests.ts
import * as path from 'path';
import { glob } from 'glob';
import { runTests } from '../src/runner';
import { pathToFileURL } from 'url';

// __dirname helper in ESM
const __dirname = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));

async function main() {
    console.log('🔍 Finding test files…');

    const pattern = path.join(__dirname, '../test/**/*.test.ts').replace(/\\/g, '/');
    const testFiles = await glob(pattern, { absolute: true });

    if (testFiles.length === 0) {
        console.warn('⚠️  No test files found.');
        process.exit(0);
    }

    console.log(`✔️  Found ${testFiles.length} file(s):`);
    testFiles.forEach(f =>
        console.log('   -', path.relative(path.join(__dirname, '..'), f))
    );

    console.log('\n📥 Loading tests…');
    for (const file of testFiles) {
        const fileUrl = pathToFileURL(file).href;
        try {
            await import(fileUrl);
            console.log('   ✓', path.relative(path.join(__dirname, '..'), file));
        } catch (err) {
            console.error(`   ✗ Failed to load ${file}:`, err);
            process.exit(1);
        }
    }

    console.log('\n🏃‍ Running tests…');
    const results = await runTests({
        onEvent: evt => {
            switch (evt.type) {
                case 'start':
                    console.log(`[START] ${evt.suite} > ${evt.test}`);
                    break;
                case 'pass':
                    console.log(`[PASS]  ${evt.suite} > ${evt.test} (${evt.duration.toFixed(1)}ms)`);
                    break;
                case 'fail':
                    console.error(`[FAIL]  ${evt.suite} > ${evt.test} (${evt.duration.toFixed(1)}ms)`);
                    if (evt.error) {
                        const err = evt.error as any;
                        console.error(`        Error: ${err.message}`);
                        if (err.file && err.line) {
                            console.error(`        at ${err.file}:${err.line}:${err.column || 0}`);
                        }
                        if (err.stack && Array.isArray(err.stack)) {
                            console.error('        Stack trace:');
                            err.stack.slice(0, 5).forEach((line: string) => {
                                console.error(`          ${line}`);
                            });
                        }
                    }
                    break;
                case 'complete':
                    console.log(`\n✅  ${evt.results.filter(r => r.status === 'passed').length} passed, ${evt.results.filter(r => r.status === 'failed').length} failed.`);
                    break;
            }
        }
    });

    process.exit(results.every(r => r.status === 'passed') ? 0 : 1);
}

main().catch(err => {
    console.error('🔥 Uncaught error in test runner:', err);
    process.exit(1);
});
