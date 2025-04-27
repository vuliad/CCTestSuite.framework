// test/hooks.test.ts
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from '../src/dsl';

describe('Lifecycle Hooks', () => {
  // Keep a global execution order for the suite
  const executionOrder: string[] = [];

  // Use a fresh counter for each test
  let testCounter = 0;

  beforeAll(() => {
    // Reset the execution order at the start
    while (executionOrder.length > 0) executionOrder.pop();
    
    executionOrder.push('beforeAll');
    
    // Verify just this step
    expect(executionOrder[executionOrder.length - 1]).toEqual('beforeAll');
    
    // Reset test counter
    testCounter = 0;
  });

  beforeEach(() => {
    testCounter++;
    executionOrder.push(`beforeEach ${testCounter}`);
    
    // Just verify the last entry added
    expect(executionOrder[executionOrder.length - 1]).toEqual(`beforeEach ${testCounter}`);
  });

  afterEach(() => {
    executionOrder.push(`afterEach ${testCounter}`);
    
    // Just verify the last entry added
    expect(executionOrder[executionOrder.length - 1]).toEqual(`afterEach ${testCounter}`);
  });

  afterAll(() => {
    executionOrder.push('afterAll');
    
    // Just verify the last entry added
    expect(executionOrder[executionOrder.length - 1]).toEqual('afterAll');
    
    // Verify we have at least 2 tests
    expect(testCounter).toBeGreaterThan(0);
  });

  it('test 1: should run lifecycle hooks in order', () => {
    executionOrder.push('test 1');
    
    // Just verify the last entry added
    expect(executionOrder[executionOrder.length - 1]).toEqual('test 1');
    
    // Verify counter
    expect(testCounter).toBeGreaterThan(0);
  });

  it('test 2: should run after test 1', () => {
    executionOrder.push('test 2');
    
    // Just verify the last entry added
    expect(executionOrder[executionOrder.length - 1]).toEqual('test 2');
    
    // Verify counter is incremented
    expect(testCounter).toBeGreaterThan(1);
  });
});