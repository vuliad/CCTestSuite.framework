// src/runner.ts
import { DescribeBlock, TestCase, TestResult, HookFn, SafeError } from './types';
import { rootDescribeBlock, getSuitePath, collectHooks, runHooks } from './dsl';

const perf = performance;

// --- TestEvent, RunOptions, TestMeta, SafeError, parseError, getTestList (Keep as is) ---
export type TestEvent =
    | { type: 'start'; suite: string; test: string }
    | { type: 'pass'; suite: string; test: string; duration: number }
    | { type: 'fail'; suite: string; test: string; duration: number; error: SafeError }
    | { type: 'complete'; results: TestResult[] };

export type RunOptions = {
    filter?: (suite: string, test: string) => boolean;
    only?: { suite?: string; test?: string };
    bail?: boolean;
    onEvent?: (event: TestEvent) => void;
};

export type TestMeta = {
    suite: string;
    test: string;
};

export type { SafeError };

function parseError(e: unknown): SafeError {
    // ... (keep existing parseError implementation) ...
    try {
        if (e instanceof Error) {
            const { name, message, stack } = e;
            const lines = stack
                ? stack.split('\n').map(l => l.trim())
                : [];

            // Stack trace lines are already processed above

            // Store all matched stack frames
            type StackFrame = { file: string; line: number; column: number; isTestFile: boolean };
            const frames: StackFrame[] = [];

            // Look for stack frames with file paths
            // Try different patterns that might appear in stack traces
            for (const frameLine of lines) {
                // Skip lines that don't look like stack frames
                if (!frameLine.startsWith('at ')) continue;

                let file: string|undefined;
                let line: number|undefined;
                let column: number|undefined;

                // Try to match various stack frame patterns

                // Pattern 1: Standard Node.js stack frame with file:/// URL
                // Example: at file:///C:/path/to/file.ts:10:15
                let m = /\bat\s+file:\/\/\/(.+?):(\d+):(\d+)/.exec(frameLine);
                if (m) {
                    file = m[1];
                    line = parseInt(m[2], 10);
                    column = parseInt(m[3], 10);
                }

                // Pattern 2: Stack frame with absolute Windows path
                // Example: at C:\\path\\to\\file.ts:10:15
                if (!file) {
                    m = /\bat\s+([A-Z]:\\[^:]+):(\d+):(\d+)/.exec(frameLine);
                    if (m) {
                        file = m[1];
                        line = parseInt(m[2], 10);
                        column = parseInt(m[3], 10);
                    }
                }

                // Pattern 3: Stack frame with function name and file path
                // Example: at functionName (C:\\path\\to\\file.ts:10:15)
                if (!file) {
                    m = /\bat\s+.+?\s+\(([A-Z]:\\[^:]+):(\d+):(\d+)\)/.exec(frameLine);
                    if (m) {
                        file = m[1];
                        line = parseInt(m[2], 10);
                        column = parseInt(m[3], 10);
                    }
                }

                // Pattern 4: Stack frame with function name and file:/// URL
                // Example: at functionName (file:///C:/path/to/file.ts:10:15)
                if (!file) {
                    m = /\bat\s+.+?\s+\(file:\/\/\/(.+?):(\d+):(\d+)\)/.exec(frameLine);
                    if (m) {
                        file = m[1];
                        line = parseInt(m[2], 10);
                        column = parseInt(m[3], 10);
                    }
                }

                // If we found a file path, add it to our frames
                if (file && line !== undefined && column !== undefined) {
                    // Check if this is a test file
                    const isTestFile = file.includes('\\test\\') || file.includes('/test/') || file.endsWith('.test.ts');
                    frames.push({ file, line, column, isTestFile });
                }
            }

            // Prioritize test files, then take the first frame
            frames.sort((a, b) => {
                if (a.isTestFile && !b.isTestFile) return -1;
                if (!a.isTestFile && b.isTestFile) return 1;
                return 0;
            });

            const bestFrame = frames[0];
            if (bestFrame) {
                // Apply a line number correction for test files
                // This is a hack to compensate for source map issues with ts-node
                let correctedLine = bestFrame.line;
                // REMOVED the line number correction HACK for now, it's unreliable
                // if (bestFrame.isTestFile) {
                // correctedLine = bestFrame.line + 14; // Example offset
                // }

                return {
                    name,
                    message,
                    file: bestFrame.file,
                    line: correctedLine,
                    column: bestFrame.column,
                    stack: lines
                };
            }

            return { name, message, stack: lines };
        }

        // non‑Error values → stringify
        return { message: String(e) };
    }
    catch {
        return { message: `Unknown error (${String(e)})` };
    }
}

export function getTestList(): TestMeta[] {
    // ... (keep existing getTestList implementation) ...
    const list: TestMeta[] = [];
    function traverse(block: DescribeBlock) {
        const currentSuitePath = getSuitePath(block);
        // Only add if suitePath is not empty (i.e., not the rootDescribeBlock itself)
        if (currentSuitePath) {
            block.tests.forEach(test => {
                list.push({ suite: currentSuitePath, test: test.name });
            });
        }
        block.children.forEach(traverse);
    }
    traverse(rootDescribeBlock);
    return list;
}

// --- Core Test Runner Logic ---
export async function runTests(options: RunOptions = {}): Promise<TestResult[]> {
    const results: TestResult[] = [];
    let globalBail = false; // Shared bail flag

    // Reset execution state before running
    function resetExecutionState(block: DescribeBlock) {
        block.ranBeforeAll = false;
        block.executed = false;
        block.children.forEach(resetExecutionState);
    }
    resetExecutionState(rootDescribeBlock);

    // Recursive function to run tests within a describe block
    // Returns true if execution should continue (no bail), false otherwise
    async function runDescribeBlock(block: DescribeBlock): Promise<boolean> {
        // If a bail occurred in a sibling or ancestor, stop immediately.
        if (globalBail) return false;

        const suitePath = getSuitePath(block);
        block.executed = true; // Mark this block as entered *before* hooks

        // --- 1. Run beforeAll hooks ---
        let beforeAllSuccess = true; // Assume success unless a hook fails
        if (!block.ranBeforeAll) {
            // Collect hooks from ancestors + current block that haven't run beforeAll yet
            const beforeAllHooksToRun: HookFn[] = [];
            let current: DescribeBlock | null = block;
            const lineage: DescribeBlock[] = [];
            while (current && !current.ranBeforeAll) {
                lineage.unshift(current); // Build path from root to current
                current = current.parent;
            }
            // Add hooks from the lineage & mark as ran *before* execution
            for (const ancestor of lineage) {
                beforeAllHooksToRun.push(...ancestor.beforeAllHooks);
                ancestor.ranBeforeAll = true;
            }

            if (beforeAllHooksToRun.length > 0) {
                const hookContext = `${suitePath} (beforeAll)`;
                const { success, error } = await runHooks(beforeAllHooksToRun, 'beforeAll', hookContext);
                if (!success) {
                    beforeAllSuccess = false; // Mark failure
                    const beforeAllError = parseError(error);
                    const result: TestResult = { suite: suitePath, test: '(beforeAll hook)', status: 'failed', duration: 0, error: beforeAllError };
                    results.push(result);
                    options.onEvent?.({ type: 'fail', suite: suitePath, test: '(beforeAll hook)', duration: 0, error: beforeAllError });
                    if (options.bail) {
                        globalBail = true;
                        // Do NOT return false immediately - we still need to run afterAll for cleanup
                    }
                }
            }
        } else {
            // If ranBeforeAll was already true, it implies a parent ran it.
            // Check if the parent's execution failed, if so, this block's beforeAll implicitly failed.
            // This logic might be complex. Let's assume ranBeforeAll implies success for now.
        }


        // --- 2. Run tests in *this* block ---
        // Only run tests if the beforeAll hooks for this scope succeeded.
        if (beforeAllSuccess && !globalBail) {
            for (const testCase of block.tests) {
                // Check bail flag *before* each test
                if (globalBail) break;

                const shouldRun =
                    (!options.filter || options.filter(suitePath, testCase.name)) &&
                    (!options.only || (
                        (!options.only.suite || options.only.suite === suitePath) &&
                        (!options.only.test || options.only.test === testCase.name)
                    ));
                if (!shouldRun) continue;

                options.onEvent?.({ type: 'start', suite: suitePath, test: testCase.name });

                let testSuccess = true;
                let testError: SafeError | undefined = undefined;
                const start = perf.now();
                let duration = 0;

                // Run beforeEach hooks
                const beforeEachHooks = collectHooks(testCase.describeBlock, 'beforeEach');
                const beforeEachContext = `${suitePath} > ${testCase.name} (beforeEach)`;
                const { success: beforeSuccess, error: beforeErr } = await runHooks(beforeEachHooks, 'beforeEach', beforeEachContext);

                if (!beforeSuccess) {
                    testSuccess = false;
                    testError = parseError(beforeErr);
                    duration = perf.now() - start;
                    console.log({ suite: suitePath, test: `${testCase.name} (beforeEach hook)`, status: 'failed', duration, error: testError });
                } else {
                    // Run the actual test
                    try {
                        await testCase.fn();
                    } catch (error) {
                        testSuccess = false;
                        testError = parseError(error);
                        console.log({ suite: suitePath, test: testCase.name, status: 'failed', duration: perf.now() - start, error: testError });
                    }
                    duration = perf.now() - start;
                }

                // Run afterEach hooks (always run for cleanup)
                const afterEachHooks = collectHooks(testCase.describeBlock, 'afterEach');
                const afterEachContext = `${suitePath} > ${testCase.name} (afterEach)`;
                const { success: afterSuccess, error: afterErr } = await runHooks(afterEachHooks, 'afterEach', afterEachContext);

                if (!afterSuccess) {
                    const afterEachError = parseError(afterErr);
                    console.log({ suite: suitePath, test: `${testCase.name} (afterEach hook)`, status: 'failed', error: afterEachError });
                    if (testSuccess) { // Override test success if afterEach failed
                        testSuccess = false;
                        testError = afterEachError; // Report afterEach error
                    }
                    // If both beforeEach/test and afterEach failed, the first error (testError) is kept.
                }

                // Record final result
                const status = testSuccess ? 'passed' : 'failed';
                const finalError = testError;
                results.push({ suite: suitePath, test: testCase.name, status, duration, error: finalError });

                if (status === 'passed') {
                    options.onEvent?.({ type: 'pass', suite: suitePath, test: testCase.name, duration });
                } else {
                    options.onEvent?.({ type: 'fail', suite: suitePath, test: testCase.name, duration, error: finalError! });
                    if (options.bail) {
                        globalBail = true;
                        // Break test loop for this block if bail is triggered by a test failure
                        break;
                    }
                }
            } // End of test loop
        }


        // --- 3. Run child describe blocks ---
        // Run children regardless of test failures in parent, but respect beforeAll failure and bail.
        if (beforeAllSuccess && !globalBail) {
            for (const child of block.children) {
                // Check bail flag *before* each child recursion
                if (globalBail) break;

                const continueRunning = await runDescribeBlock(child);
                // If child run signals bail (returns false), set global bail and stop processing siblings.
                if (!continueRunning) {
                    globalBail = true;
                    break;
                }
            }
        }


        // --- 4. Run afterAll hooks for *this* block ---
        // Run ONLY if the block was executed. Crucially, run *after* children have completed.
        // Run even if tests/children failed or bailed *within* this scope, for cleanup.
        // Do NOT run if globalBail was set *before* entering this block or during its beforeAll.
        let runAfterAll = block.executed;
        // Let's refine: Only run afterAll if the corresponding beforeAll succeeded.
        runAfterAll = runAfterAll && beforeAllSuccess;

        // Also, check if a bail occurred *above* this block. If so, maybe skip afterAll?
        // Let's try running if beforeAll succeeded, respecting bail only if it triggers *during* afterAll.
        if (runAfterAll) {
            const afterAllHooks = block.afterAllHooks; // Only hooks defined in *this* block
            if (afterAllHooks.length > 0) {
                const hookContext = `${suitePath} (afterAll)`;
                const { success, error } = await runHooks(afterAllHooks, 'afterAll', hookContext);

                if (!success) {
                    // Report failure for this hook
                    const afterAllError = parseError(error);
                    const result: TestResult = { suite: suitePath, test: '(afterAll hook)', status: 'failed', duration: 0, error: afterAllError };
                    results.push(result);
                    options.onEvent?.({ type: 'fail', suite: suitePath, test: '(afterAll hook)', duration: 0, error: afterAllError });
                    if (options.bail) {
                        globalBail = true;
                        // If afterAll fails with bail, signal upwards to stop further execution
                        return false;
                    }
                }
            }
        }

        // Return true if execution should continue (bail flag is not set), false otherwise.
        return !globalBail;
    }

    // --- Main Execution Start ---
    // Execute top-level describe blocks sequentially.
    for (const topLevelDescribe of rootDescribeBlock.children) {
        await runDescribeBlock(topLevelDescribe);
        // If runDescribeBlock returned false (bail) or globalBail is set, stop.
        if (globalBail) break;
    }

    // --- Final Event ---
    // No separate afterAll queue processing needed now.
    options.onEvent?.({ type: 'complete', results });
    return results;
}