// test/hook-inheritance.test.ts
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from '../src/dsl';

/**
 * This test verifies hook inheritance behavior:
 * - Child describes inherit all hooks from parent describes
 * - All inherited hooks run in addition to the child's own hooks
 * - Child describes cannot disable or replace parent hooks
 * - Hooks are additive as you nest deeper
 */

describe('Hook Inheritance', () => {
  // Track execution order
  const executionOrder: string[] = [];

  // Track which hooks were called (using Set for easier checking)
  const parentHooksCalled = new Set<string>();
  const childHooksCalled = new Set<string>();
  const grandchildHooksCalled = new Set<string>();

  // Parent hooks
  beforeAll(() => {
    executionOrder.push('Parent beforeAll');
    parentHooksCalled.add('beforeAll');
  });

  beforeEach(() => {
    executionOrder.push('Parent beforeEach');
    parentHooksCalled.add('beforeEach');
  });

  afterEach(() => {
    executionOrder.push('Parent afterEach');
    parentHooksCalled.add('afterEach');
  });

  afterAll(() => { // <<< PARENT afterAll (Outermost)
    executionOrder.push('Parent afterAll');
    parentHooksCalled.add('afterAll');

    // Verify all parent hooks were called
    expect(parentHooksCalled.has('beforeAll')).toBe(true);
    expect(parentHooksCalled.has('beforeEach')).toBe(true);
    expect(parentHooksCalled.has('afterEach')).toBe(true);
    expect(parentHooksCalled.has('afterAll')).toBe(true);

    // --- MOVED ASSERTION HERE ---
    // Verify the execution order for afterAll hooks (if child/grandchild ran)
    if (executionOrder.includes('Grandchild test')) { // Check if inner tests actually ran
      const grandchildAfterAllIndex = executionOrder.lastIndexOf('Grandchild afterAll');
      const childAfterAllIndex = executionOrder.lastIndexOf('Child afterAll');
      const parentAfterAllIndex = executionOrder.lastIndexOf('Parent afterAll'); // Should be the last one

      // Check they exist before comparing indices
      expect(grandchildAfterAllIndex).toBeGreaterThan(-1);
      expect(childAfterAllIndex).toBeGreaterThan(-1);
      expect(parentAfterAllIndex).toBeGreaterThan(-1);

      // Grandchild afterAll should run before child afterAll (innermost to outermost)
      expect(grandchildAfterAllIndex).toBeLessThan(childAfterAllIndex);
      // Child afterAll should run before parent afterAll
      expect(childAfterAllIndex).toBeLessThan(parentAfterAllIndex);
    }
    // --- END MOVED ASSERTION ---
  });

  // Parent test
  it('should run parent hooks', () => {
    executionOrder.push('Parent test');

    // Verify parent hooks ran before this test
    expect(executionOrder).toContain('Parent beforeAll');
    const testIndex = executionOrder.lastIndexOf('Parent test');
    const lastParentBeforeEach = executionOrder.slice(0, testIndex).lastIndexOf('Parent beforeEach');
    expect(lastParentBeforeEach).toBeGreaterThan(-1);

    // Verify child hooks haven't run yet
    expect(childHooksCalled.size).toBe(0);
    expect(grandchildHooksCalled.size).toBe(0);
  });

  // Child describe
  describe('Child Suite', () => {
    // Child hooks
    beforeAll(() => {
      executionOrder.push('Child beforeAll');
      childHooksCalled.add('beforeAll');

      // Verify parent beforeAll was already called
      expect(executionOrder).toContain('Parent beforeAll');
      // Check order relative to this hook start
      const childStart = executionOrder.lastIndexOf('Child beforeAll');
      const parentEnd = executionOrder.slice(0, childStart).lastIndexOf('Parent beforeAll');
      expect(parentEnd).toBeGreaterThan(-1);
      expect(parentEnd).toBeLessThan(childStart);
    });

    beforeEach(() => {
      executionOrder.push('Child beforeEach');
      childHooksCalled.add('beforeEach');

      // Verify parent beforeEach was already called for this test run
      const childStart = executionOrder.lastIndexOf('Child beforeEach');
      const parentEnd = executionOrder.slice(0, childStart).lastIndexOf('Parent beforeEach');
      expect(parentEnd).toBeGreaterThan(-1);
      expect(parentEnd).toBeLessThan(childStart); // Parent end should be before child start
    });

    afterEach(() => {
      executionOrder.push('Child afterEach');
      childHooksCalled.add('afterEach');
    });

    afterAll(() => { // <<< CHILD afterAll
      executionOrder.push('Child afterAll');
      childHooksCalled.add('afterAll');

      // Verify all child hooks were called by the end
      expect(childHooksCalled.has('beforeAll')).toBe(true);
      expect(childHooksCalled.has('beforeEach')).toBe(true);
      expect(childHooksCalled.has('afterEach')).toBe(true);
      expect(childHooksCalled.has('afterAll')).toBe(true);

      // ASSERTION REMOVED FROM HERE
    });

    // Child test
    it('should run both parent and child hooks', () => {
      executionOrder.push('Child test');

      // Verify relevant hooks ran before this test
      expect(executionOrder).toContain('Parent beforeAll');
      expect(executionOrder).toContain('Child beforeAll');

      const testIndex = executionOrder.lastIndexOf('Child test');
      const beforeTestEntries = executionOrder.slice(0, testIndex);
      const lastParentBeforeEach = beforeTestEntries.lastIndexOf('Parent beforeEach');
      const lastChildBeforeEach = beforeTestEntries.lastIndexOf('Child beforeEach');

      expect(lastParentBeforeEach).toBeGreaterThan(-1);
      expect(lastChildBeforeEach).toBeGreaterThan(-1);

      // Verify the order: parent beforeEach then child beforeEach
      expect(lastParentBeforeEach).toBeLessThan(lastChildBeforeEach);
      expect(lastChildBeforeEach).toBeLessThan(testIndex); // And before test
    });

    // Grandchild describe
    describe('Grandchild Suite', () => {
      // Grandchild hooks
      beforeAll(() => {
        executionOrder.push('Grandchild beforeAll');
        grandchildHooksCalled.add('beforeAll');

        // Verify parent and child beforeAll were already called
        expect(executionOrder).toContain('Parent beforeAll');
        expect(executionOrder).toContain('Child beforeAll');
        // Check order relative to this hook start
        const grandchildStart = executionOrder.lastIndexOf('Grandchild beforeAll');
        const childEnd = executionOrder.slice(0, grandchildStart).lastIndexOf('Child beforeAll');
        expect(childEnd).toBeGreaterThan(-1);
        expect(childEnd).toBeLessThan(grandchildStart);
      });

      beforeEach(() => {
        executionOrder.push('Grandchild beforeEach');
        grandchildHooksCalled.add('beforeEach');

        // Verify parent and child beforeEach were already called for this test run
        const grandchildStart = executionOrder.lastIndexOf('Grandchild beforeEach');
        const childEnd = executionOrder.slice(0, grandchildStart).lastIndexOf('Child beforeEach');
        const parentEnd = executionOrder.slice(0, grandchildStart).lastIndexOf('Parent beforeEach');

        expect(parentEnd).toBeGreaterThan(-1);
        expect(childEnd).toBeGreaterThan(-1);
        expect(parentEnd).toBeLessThan(childEnd); // Parent before child
        expect(childEnd).toBeLessThan(grandchildStart); // Child before grandchild start
      });

      afterEach(() => {
        executionOrder.push('Grandchild afterEach');
        grandchildHooksCalled.add('afterEach');
      });

      afterAll(() => { // <<< GRANDCHILD afterAll
        executionOrder.push('Grandchild afterAll');
        grandchildHooksCalled.add('afterAll');

        // Verify all grandchild hooks were called by the end
        expect(grandchildHooksCalled.has('beforeAll')).toBe(true);
        expect(grandchildHooksCalled.has('beforeEach')).toBe(true);
        expect(grandchildHooksCalled.has('afterEach')).toBe(true);
        expect(grandchildHooksCalled.has('afterAll')).toBe(true);

        // --- ASSERTION REMOVED FROM HERE ---
      });

      // Grandchild test
      it('should run parent, child, and grandchild hooks', () => {
        executionOrder.push('Grandchild test');

        // Verify relevant hooks ran before this test
        expect(executionOrder).toContain('Parent beforeAll');
        expect(executionOrder).toContain('Child beforeAll');
        expect(executionOrder).toContain('Grandchild beforeAll');

        const testIndex = executionOrder.lastIndexOf('Grandchild test');
        const beforeTestEntries = executionOrder.slice(0, testIndex);
        const lastParentBeforeEach = beforeTestEntries.lastIndexOf('Parent beforeEach');
        const lastChildBeforeEach = beforeTestEntries.lastIndexOf('Child beforeEach');
        const lastGrandchildBeforeEach = beforeTestEntries.lastIndexOf('Grandchild beforeEach');

        expect(lastParentBeforeEach).toBeGreaterThan(-1);
        expect(lastChildBeforeEach).toBeGreaterThan(-1);
        expect(lastGrandchildBeforeEach).toBeGreaterThan(-1);

        // Verify the order: parent beforeEach, then child beforeEach, then grandchild beforeEach
        expect(lastParentBeforeEach).toBeLessThan(lastChildBeforeEach);
        expect(lastChildBeforeEach).toBeLessThan(lastGrandchildBeforeEach);
        expect(lastGrandchildBeforeEach).toBeLessThan(testIndex); // And before test
      });
    });
  });
});