// test/nested-hooks.test.ts
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from '../src/dsl';

// This test demonstrates how hooks behave with multiple describe blocks
// Hooks are now scoped to their describe blocks
// Each describe block's hooks only run for tests in that describe block

// We'll use these arrays to track execution order
const executionOrder: string[] = [];
const firstSuiteHooksCalled: string[] = [];
const secondSuiteHooksCalled: string[] = [];

describe('First Test Suite', () => {
  // First suite hooks
  beforeAll(() => {
    executionOrder.push('First Suite beforeAll');
    firstSuiteHooksCalled.push('beforeAll');

    // Verify this hook was called
    expect(firstSuiteHooksCalled).toContain('beforeAll');
    // Verify second suite hooks haven't been called yet
    expect(secondSuiteHooksCalled.length).toBe(0);
  });

  beforeEach(() => {
    executionOrder.push('First Suite beforeEach');
    firstSuiteHooksCalled.push('beforeEach');

    // Verify this hook was called
    expect(firstSuiteHooksCalled).toContain('beforeEach');
  });

  afterEach(() => {
    executionOrder.push('First Suite afterEach');
    firstSuiteHooksCalled.push('afterEach');

    // Verify this hook was called
    expect(firstSuiteHooksCalled).toContain('afterEach');
  });

  afterAll(() => {
    executionOrder.push('First Suite afterAll');
    firstSuiteHooksCalled.push('afterAll');

    // Verify this hook was called
    expect(firstSuiteHooksCalled).toContain('afterAll');
  });

  it('should run only first suite hooks', () => {
    executionOrder.push('First Suite test');

    // With scoped hooks, only the hooks from this describe block should run
    expect(executionOrder).toContain('First Suite beforeAll');
    expect(executionOrder).toContain('First Suite beforeEach');

    // Second suite hooks should not have run yet
    expect(executionOrder).not.toContain('Second Suite beforeAll');
    expect(executionOrder).not.toContain('Second Suite beforeEach');

    // The test should be the last item in the execution order
    expect(executionOrder[executionOrder.length - 1]).toBe('First Suite test');
  });
});

describe('Second Test Suite', () => {
  // Second suite hooks
  beforeAll(() => {
    executionOrder.push('Second Suite beforeAll');
    secondSuiteHooksCalled.push('beforeAll');

    // Verify this hook was called
    expect(secondSuiteHooksCalled).toContain('beforeAll');

    // First suite should have completed all its hooks by now
    expect(firstSuiteHooksCalled).toContain('beforeAll');
    expect(firstSuiteHooksCalled).toContain('beforeEach');
    expect(firstSuiteHooksCalled).toContain('afterEach');
    expect(firstSuiteHooksCalled).toContain('afterAll');
  });

  beforeEach(() => {
    executionOrder.push('Second Suite beforeEach');
    secondSuiteHooksCalled.push('beforeEach');

    // Verify this hook was called
    expect(secondSuiteHooksCalled).toContain('beforeEach');
  });

  afterEach(() => {
    executionOrder.push('Second Suite afterEach');
    secondSuiteHooksCalled.push('afterEach');

    // Verify this hook was called
    expect(secondSuiteHooksCalled).toContain('afterEach');
  });

  afterAll(() => {
    executionOrder.push('Second Suite afterAll');
    secondSuiteHooksCalled.push('afterAll');

    // Verify this hook was called
    expect(secondSuiteHooksCalled).toContain('afterAll');

    // Verify the execution order with scoped hooks
    // First suite hooks and test
    expect(executionOrder).toContain('First Suite beforeAll');
    expect(executionOrder).toContain('First Suite beforeEach');
    expect(executionOrder).toContain('First Suite test');
    expect(executionOrder).toContain('First Suite afterEach');
    expect(executionOrder).toContain('First Suite afterAll');

    // Second suite hooks and test
    expect(executionOrder).toContain('Second Suite beforeAll');
    expect(executionOrder).toContain('Second Suite beforeEach');
    expect(executionOrder).toContain('Second Suite test');
    expect(executionOrder).toContain('Second Suite afterEach');
    expect(executionOrder).toContain('Second Suite afterAll');

    // Verify the order of execution between suites
    const firstBeforeAllIndex = executionOrder.indexOf('First Suite beforeAll');
    const firstAfterAllIndex = executionOrder.indexOf('First Suite afterAll');
    const secondBeforeAllIndex = executionOrder.indexOf('Second Suite beforeAll');

    // First suite's beforeAll should run before its afterAll
    expect(firstBeforeAllIndex).toBeLessThan(firstAfterAllIndex);

    // Second suite's beforeAll should run after first suite's afterAll
    expect(firstAfterAllIndex).toBeLessThan(secondBeforeAllIndex);
  });

  it('should run only second suite hooks', () => {
    executionOrder.push('Second Suite test');

    // With scoped hooks, only the hooks from this describe block should run for this test
    expect(executionOrder).toContain('Second Suite beforeAll');
    expect(executionOrder).toContain('Second Suite beforeEach');

    // First suite's beforeEach and afterEach should not run for this test
    const testIndex = executionOrder.indexOf('Second Suite test');
    const beforeTestEntries = executionOrder.slice(0, testIndex);
    const firstSuiteBeforeEachAfterFirstSuiteTest = beforeTestEntries.lastIndexOf('First Suite beforeEach');

    // There should be no First Suite beforeEach after the First Suite test and before this test
    expect(firstSuiteBeforeEachAfterFirstSuiteTest).toBeLessThan(executionOrder.indexOf('First Suite test'));

    // The test should be the last item in the execution order
    expect(executionOrder[executionOrder.length - 1]).toBe('Second Suite test');
  });
});
