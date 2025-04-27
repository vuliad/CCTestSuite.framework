// src/dsl.ts
import { DescribeBlock, TestCase, HookFn, TestFn } from './types';
import { expect as assertionExpect } from './assertion'; // Import assertion 'expect'

// Root of the describe tree
export const rootDescribeBlock: DescribeBlock = createDescribeBlock('Root', null);

// Pointer to the currently active describe block during test file parsing
let currentDescribeBlock: DescribeBlock = rootDescribeBlock;

function createDescribeBlock(name: string, parent: DescribeBlock | null): DescribeBlock {
  return {
    name,
    parent,
    children: [],
    tests: [],
    beforeAllHooks: [],
    beforeEachHooks: [],
    afterEachHooks: [],
    afterAllHooks: [],
    ranBeforeAll: false,
    executed: false, // Initialize executed state
  };
}

function extractTags(name: string): { clean: string, tags: string[] } {
  const tagPattern = /@\w+/g;
  const tags: string[] = [];
  const clean = name.replace(tagPattern, (match) => {
    tags.push(match.slice(1)); // remove @
    return '';
  }).trim();
  return { clean, tags };
}

// --- Public DSL Functions ---

export function describe(name: string, fn: () => void): void {
  const parent = currentDescribeBlock;
  const { clean: blockName } = extractTags(name);
  const newBlock = createDescribeBlock(blockName, parent);
  parent.children.push(newBlock);

  // Set context for nested calls
  currentDescribeBlock = newBlock;
  try {
    fn(); // Execute the describe body to register its contents
  } finally {
    // Restore context
    currentDescribeBlock = parent;
  }
}

export function it(name: string, fn: TestFn): void {
  if (!currentDescribeBlock) {
    throw new Error("Cannot call 'it' outside of a 'describe' block (or globally if supported).");
  }
  const { clean: testName, tags: testTags } = extractTags(name);
  const testCase: TestCase = {
    name: testName,
    fn,
    tags: testTags, // Combine with suite tags if needed later
    describeBlock: currentDescribeBlock,
  };
  currentDescribeBlock.tests.push(testCase);
}

export function beforeAll(fn: HookFn): void {
  if (!currentDescribeBlock) throw new Error("Cannot call 'beforeAll' outside of a 'describe' block.");
  currentDescribeBlock.beforeAllHooks.push(fn);
}

export function beforeEach(fn: HookFn): void {
  if (!currentDescribeBlock) throw new Error("Cannot call 'beforeEach' outside of a 'describe' block.");
  currentDescribeBlock.beforeEachHooks.push(fn);
}

export function afterEach(fn: HookFn): void {
  if (!currentDescribeBlock) throw new Error("Cannot call 'afterEach' outside of a 'describe' block.");
  currentDescribeBlock.afterEachHooks.push(fn);
}

export function afterAll(fn: HookFn): void {
  if (!currentDescribeBlock) throw new Error("Cannot call 'afterAll' outside of a 'describe' block.");
  currentDescribeBlock.afterAllHooks.push(fn);
}

// Export assertion 'expect'
export const expect = assertionExpect;

// --- Helper Functions for Runner (Exported for runner.ts) ---

export function getSuitePath(block: DescribeBlock): string {
  const path: string[] = [];
  let current: DescribeBlock | null = block;
  while (current && current.parent) { // Stop before adding Root
    path.unshift(current.name);
    current = current.parent;
  }
  return path.join(' > ');
}

// Collect hooks respecting inheritance and order
export function collectHooks(block: DescribeBlock, type: 'beforeAll' | 'beforeEach' | 'afterEach' | 'afterAll'): HookFn[] {
  const hooks: HookFn[] = [];
  let current: DescribeBlock | null = block;
  const blockChain: DescribeBlock[] = [];

  // Walk up to root
  while (current) {
    blockChain.push(current);
    current = current.parent;
  }

  // Order depends on hook type
  if (type === 'beforeAll' || type === 'beforeEach') {
    // Outermost first (root is last in blockChain)
    for (let i = blockChain.length - 1; i >= 0; i--) {
      hooks.push(...blockChain[i][`${type}Hooks`]);
    }
  } else { // afterEach or afterAll
    // Innermost first (current block is first in blockChain)
    for (let i = 0; i < blockChain.length; i++) {
      hooks.push(...blockChain[i][`${type}Hooks`]);
    }
  }
  return hooks;
}


// Execute hooks sequentially, awaiting promises
export async function runHooks(hooks: HookFn[], hookType: string, context: string): Promise<{ success: boolean, error?: unknown }> {
  for (const hook of hooks) {
    try {
      await hook();
    } catch (error) {
      console.error(`Error in ${hookType} hook for ${context}:`, error);
      return { success: false, error };
    }
  }
  return { success: true };
}

// Reset state (useful for testing the runner itself or running multiple times in one process)
export function resetRegistry(): void {
  function resetBlock(block: DescribeBlock) {
    block.children = [];
    block.tests = [];
    block.beforeAllHooks = [];
    block.beforeEachHooks = [];
    block.afterEachHooks = [];
    block.afterAllHooks = [];
    block.ranBeforeAll = false;
    block.executed = false;
  }
  resetBlock(rootDescribeBlock);
  currentDescribeBlock = rootDescribeBlock;
}

// Re-export runTests from runner - will be defined in runner.ts
// We do this here to keep the public API consolidated if desired
// This creates a circular dependency at module load time, which is usually fine
// for functions but can be tricky. We'll import runner dynamically inside runTests caller if needed,
// or structure exports carefully. For now, let's assume runner.ts imports dsl.ts.
// We will export runTests from runner.ts directly later.