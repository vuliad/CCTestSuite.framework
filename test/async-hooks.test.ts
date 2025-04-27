// test/async-hooks.test.ts
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from '../src/dsl';

/**
 * This test verifies async hook behavior:
 * - Hooks can return promises
 * - The framework awaits async hooks before continuing
 * - Hooks execute sequentially, not in parallel
 */

describe('Async Hooks', () => {
  // Track execution order and timing
  const executionOrder: string[] = [];
  const executionTimes: { [key: string]: number } = {};

  // Helper to record execution time
  const recordExecution = (name: string) => {
    executionOrder.push(name);
    executionTimes[name] = Date.now();
  };

  // Async beforeAll hook with delay
  beforeAll(async () => {
    recordExecution('beforeAll start');
    await new Promise(resolve => setTimeout(resolve, 50));
    recordExecution('beforeAll end');
    expect(executionTimes['beforeAll end'] - executionTimes['beforeAll start']).toBeGreaterThanOrEqual(40);
  });

  // Async beforeEach hook with delay
  beforeEach(async () => {
    recordExecution('beforeEach start');
    await new Promise(resolve => setTimeout(resolve, 30));
    recordExecution('beforeEach end');
    // Check relative to start time *of this specific hook instance*
    const startTime = executionTimes['beforeEach start'];
    const endTime = executionTimes['beforeEach end'];
    // Find the most recent start time corresponding to this end time if hooks run multiple times
    const relevantStartTime = executionOrder.slice(0, executionOrder.lastIndexOf('beforeEach end')).lastIndexOf('beforeEach start');
    if (relevantStartTime !== -1) {
      expect(endTime - executionTimes[executionOrder[relevantStartTime]]).toBeGreaterThanOrEqual(20);
    } else {
      // Fallback if structure is unexpected, though less precise
      expect(endTime - startTime).toBeGreaterThanOrEqual(20);
    }
  });

  // Async afterEach hook with delay
  afterEach(async () => {
    recordExecution('afterEach start');
    await new Promise(resolve => setTimeout(resolve, 30));
    recordExecution('afterEach end');
    // Check relative to start time *of this specific hook instance*
    const startTime = executionTimes['afterEach start'];
    const endTime = executionTimes['afterEach end'];
    // Find the most recent start time corresponding to this end time
    const relevantStartTime = executionOrder.slice(0, executionOrder.lastIndexOf('afterEach end')).lastIndexOf('afterEach start');
    if (relevantStartTime !== -1) {
      expect(endTime - executionTimes[executionOrder[relevantStartTime]]).toBeGreaterThanOrEqual(20);
    } else {
      expect(endTime - startTime).toBeGreaterThanOrEqual(20);
    }
  });

  // Async afterAll hook with delay
  afterAll(async () => {
    recordExecution('afterAll start');
    await new Promise(resolve => setTimeout(resolve, 50));
    recordExecution('afterAll end');
    expect(executionTimes['afterAll end'] - executionTimes['afterAll start']).toBeGreaterThanOrEqual(40);

    // Verify the complete execution order for this specific suite
    expect(executionOrder).toEqual([
      'beforeAll start',
      'beforeAll end',
      'beforeEach start',
      'beforeEach end',
      'test 1',
      'afterEach start',
      'afterEach end',
      'beforeEach start',
      'beforeEach end',
      'test 2',
      'afterEach start',
      'afterEach end',
      'afterAll start',
      'afterAll end'
    ]);
  });

  // Test 1
  it('test 1: should wait for async hooks', () => {
    recordExecution('test 1');
    expect(executionOrder).toContain('beforeAll end');
    // Check the *last* beforeEach before this test
    const testIndex = executionOrder.indexOf('test 1');
    const lastBeforeEachEnd = executionOrder.slice(0, testIndex).lastIndexOf('beforeEach end');
    expect(lastBeforeEachEnd).toBeGreaterThan(-1); // Ensure it ran
    expect(executionOrder[lastBeforeEachEnd]).toBe('beforeEach end'); // Verify content

    // Verify the order
    const beforeAllEndIndex = executionOrder.indexOf('beforeAll end');
    expect(beforeAllEndIndex).toBeLessThan(lastBeforeEachEnd);
    expect(lastBeforeEachEnd).toBeLessThan(testIndex);
  });

  // Test 2
  it('test 2: should run after test 1 and its hooks', () => {
    recordExecution('test 2');
    expect(executionOrder).toContain('test 1');
    // Check the *last* afterEach before this test's beforeEach
    const test2Index = executionOrder.indexOf('test 2');
    const relevantEntries = executionOrder.slice(0, test2Index);
    const lastAfterEachEnd = relevantEntries.lastIndexOf('afterEach end');
    expect(lastAfterEachEnd).toBeGreaterThan(-1);
    expect(executionOrder[lastAfterEachEnd]).toBe('afterEach end');

    // Check the *last* beforeEach before this test
    const lastBeforeEachEnd = relevantEntries.lastIndexOf('beforeEach end');
    expect(lastBeforeEachEnd).toBeGreaterThan(-1);
    expect(executionOrder[lastBeforeEachEnd]).toBe('beforeEach end');


    // Verify the order
    const test1Index = executionOrder.indexOf('test 1');
    expect(test1Index).toBeLessThan(lastAfterEachEnd);
    expect(lastAfterEachEnd).toBeLessThan(lastBeforeEachEnd);
    expect(lastBeforeEachEnd).toBeLessThan(test2Index);
  });
});

// Test nested async hooks
describe('Nested Async Hooks', () => {
  // Track execution order *specifically for this nested suite*
  const nestedExecutionOrder: string[] = []; // Use a separate tracker if needed, or rely on global one if tests run isolated

  // Helper to record execution time
  const recordNestedExecution = (name: string) => {
    nestedExecutionOrder.push(name); // Push to the dedicated tracker
    // Optionally push to the global tracker if you want a single timeline across files (requires clearing global state between runs)
    // executionOrder.push(name);
  };


  // Parent hooks
  beforeAll(async () => {
    recordNestedExecution('Parent beforeAll start');
    await new Promise(resolve => setTimeout(resolve, 20));
    recordNestedExecution('Parent beforeAll end');
  });

  beforeEach(async () => {
    recordNestedExecution('Parent beforeEach start');
    await new Promise(resolve => setTimeout(resolve, 10));
    recordNestedExecution('Parent beforeEach end');
  });

  afterEach(async () => {
    recordNestedExecution('Parent afterEach start');
    await new Promise(resolve => setTimeout(resolve, 10));
    recordNestedExecution('Parent afterEach end');
  });

  afterAll(async () => { // <<< PARENT afterAll (Outermost in this context)
    recordNestedExecution('Parent afterAll start');
    await new Promise(resolve => setTimeout(resolve, 20));
    recordNestedExecution('Parent afterAll end');

    // --- MOVED ASSERTION HERE ---
    // Verify afterAll order (if child ran)
    if (nestedExecutionOrder.includes('Child test')) {
      const childAfterAllEndIndex = nestedExecutionOrder.lastIndexOf('Child afterAll end');
      const parentAfterAllStartIndex = nestedExecutionOrder.lastIndexOf('Parent afterAll start'); // Compare end of child with start of parent

      expect(childAfterAllEndIndex).toBeGreaterThan(-1); // Make sure it exists

      // Child afterAll should finish before parent afterAll starts
      expect(childAfterAllEndIndex).toBeLessThan(parentAfterAllStartIndex);
    }
    // --- END MOVED ASSERTION ---

    // Optional: Verify final order for the nested suite if using dedicated tracker
    // expect(nestedExecutionOrder).toEqual([ ... expected order ... ]);
  });

  // Parent test
  it('should wait for parent async hooks', async () => {
    recordNestedExecution('Parent test');

    // Verify hooks completed in order just before this test
    // Find the last relevant hooks before 'Parent test'
    const testIndex = nestedExecutionOrder.lastIndexOf('Parent test');
    const beforeTestEntries = nestedExecutionOrder.slice(0, testIndex);
    const lastParentBeforeAllEnd = beforeTestEntries.lastIndexOf('Parent beforeAll end');
    const lastParentBeforeEachEnd = beforeTestEntries.lastIndexOf('Parent beforeEach end');

    expect(lastParentBeforeAllEnd).toBeGreaterThan(-1);
    expect(lastParentBeforeEachEnd).toBeGreaterThan(-1);

    // Verify order relative to test
    expect(lastParentBeforeAllEnd).toBeLessThan(lastParentBeforeEachEnd);
    expect(lastParentBeforeEachEnd).toBeLessThan(testIndex);

    // Verify specific sequence up to this point if needed
    // This can be fragile if other tests exist at the same level
    // expect(beforeTestEntries.slice(lastParentBeforeAllEnd -1)).toEqual([
    //   'Parent beforeAll start',
    //   'Parent beforeAll end',
    //   'Parent beforeEach start',
    //   'Parent beforeEach end'
    // ]);
  });

  // Child describe with async hooks
  describe('Child Suite', () => {
    // Child hooks
    beforeAll(async () => {
      recordNestedExecution('Child beforeAll start');
      await new Promise(resolve => setTimeout(resolve, 20));
      recordNestedExecution('Child beforeAll end');

      // Verify parent beforeAll completed *before this hook started*
      const childStart = nestedExecutionOrder.lastIndexOf('Child beforeAll start');
      const parentEnd = nestedExecutionOrder.slice(0, childStart).lastIndexOf('Parent beforeAll end');
      expect(parentEnd).toBeGreaterThan(-1);
      expect(parentEnd).toBeLessThan(childStart);
    });

    beforeEach(async () => {
      recordNestedExecution('Child beforeEach start');
      await new Promise(resolve => setTimeout(resolve, 10));
      recordNestedExecution('Child beforeEach end');

      // Verify parent beforeEach completed for this test *before this hook started*
      const childStart = nestedExecutionOrder.lastIndexOf('Child beforeEach start');
      const parentEnd = nestedExecutionOrder.slice(0, childStart).lastIndexOf('Parent beforeEach end');
      expect(parentEnd).toBeGreaterThan(-1);
      expect(parentEnd).toBeLessThan(childStart); // Parent end should be before child start
    });

    afterEach(async () => {
      recordNestedExecution('Child afterEach start');
      await new Promise(resolve => setTimeout(resolve, 10));
      recordNestedExecution('Child afterEach end');
    });

    afterAll(async () => { // <<< CHILD afterAll
      recordNestedExecution('Child afterAll start');
      await new Promise(resolve => setTimeout(resolve, 20));
      recordNestedExecution('Child afterAll end');

      // ASSERTION REMOVED FROM HERE
    });

    // Child test
    it('should wait for both parent and child async hooks', async () => {
      recordNestedExecution('Child test');

      // Get the indices for verification relative to this test
      const testIndex = nestedExecutionOrder.lastIndexOf('Child test');
      const beforeTestEntries = nestedExecutionOrder.slice(0, testIndex);

      const lastParentBeforeEachEndIndex = beforeTestEntries.lastIndexOf('Parent beforeEach end');
      const lastChildBeforeEachEndIndex = beforeTestEntries.lastIndexOf('Child beforeEach end');

      expect(lastParentBeforeEachEndIndex).toBeGreaterThan(-1);
      expect(lastChildBeforeEachEndIndex).toBeGreaterThan(-1);

      // Verify hooks completed in order before this test
      expect(lastParentBeforeEachEndIndex).toBeLessThan(lastChildBeforeEachEndIndex);
      expect(lastChildBeforeEachEndIndex).toBeLessThan(testIndex);
    });
  });
});