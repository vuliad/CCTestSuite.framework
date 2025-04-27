// test/execution-order.test.ts
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from '../src/dsl';

/**
 * This test verifies the execution order of hooks:
 * - beforeAll: outermost to innermost (describe nesting)
 * - beforeEach: outermost to innermost
 * - Test execution
 * - afterEach: innermost to outermost
 * - afterAll: innermost to outermost
 */

describe('Hook Execution Order', () => {
  // Track execution order
  const executionOrder: string[] = [];
  
  beforeAll(() => {
    executionOrder.push('Outer beforeAll');
  });
  
  beforeEach(() => {
    executionOrder.push('Outer beforeEach');
  });
  
  afterEach(() => {
    executionOrder.push('Outer afterEach');
  });
  
  afterAll(() => {
    executionOrder.push('Outer afterAll');
    
    // Verify the final execution order for the entire test suite
    // This will run after all tests and all other afterAll hooks
    
    // Find indices for verification
    const outerBeforeAllIndex = executionOrder.indexOf('Outer beforeAll');
    const middleBeforeAllIndex = executionOrder.indexOf('Middle beforeAll');
    const innerBeforeAllIndex = executionOrder.indexOf('Inner beforeAll');
    
    const innerAfterAllIndex = executionOrder.indexOf('Inner afterAll');
    const middleAfterAllIndex = executionOrder.indexOf('Middle afterAll');
    const outerAfterAllIndex = executionOrder.indexOf('Outer afterAll');
    
    // Verify beforeAll order: outermost to innermost
    expect(outerBeforeAllIndex).toBeLessThan(middleBeforeAllIndex);
    expect(middleBeforeAllIndex).toBeLessThan(innerBeforeAllIndex);
    
    // Verify afterAll order: innermost to outermost
    expect(innerAfterAllIndex).toBeLessThan(middleAfterAllIndex);
    expect(middleAfterAllIndex).toBeLessThan(outerAfterAllIndex);
  });
  
  it('outer test', () => {
    executionOrder.push('Outer test');
    
    // Verify hooks executed before this test
    expect(executionOrder).toContain('Outer beforeAll');
    expect(executionOrder).toContain('Outer beforeEach');
    
    // Verify this is the last item in the execution order
    expect(executionOrder[executionOrder.length - 1]).toBe('Outer test');
  });
  
  describe('Middle Level', () => {
    beforeAll(() => {
      executionOrder.push('Middle beforeAll');
      
      // Verify outer beforeAll was already called
      expect(executionOrder).toContain('Outer beforeAll');
      
      // Verify order
      const outerBeforeAllIndex = executionOrder.indexOf('Outer beforeAll');
      const middleBeforeAllIndex = executionOrder.indexOf('Middle beforeAll');
      expect(outerBeforeAllIndex).toBeLessThan(middleBeforeAllIndex);
    });
    
    beforeEach(() => {
      executionOrder.push('Middle beforeEach');
      
      // Verify outer beforeEach was already called for this test
      const testIndex = executionOrder.length - 1;
      const beforeTestEntries = executionOrder.slice(0, testIndex);
      const lastOuterBeforeEach = beforeTestEntries.lastIndexOf('Outer beforeEach');
      expect(lastOuterBeforeEach).toBeGreaterThan(-1);
      
      // Verify order for this test
      const lastOuterBeforeEachIndex = executionOrder.lastIndexOf('Outer beforeEach');
      const middleBeforeEachIndex = executionOrder.lastIndexOf('Middle beforeEach');
      expect(lastOuterBeforeEachIndex).toBeLessThan(middleBeforeEachIndex);
    });
    
    afterEach(() => {
      executionOrder.push('Middle afterEach');
      
      // Verify this runs before outer afterEach
      // (will be verified in outer afterEach)
    });
    
    afterAll(() => {
      executionOrder.push('Middle afterAll');
      
      // Verify inner afterAll was already called (if inner tests ran)
      if (executionOrder.includes('Inner test')) {
        expect(executionOrder).toContain('Inner afterAll');
        
        // Verify order
        const innerAfterAllIndex = executionOrder.indexOf('Inner afterAll');
        const middleAfterAllIndex = executionOrder.indexOf('Middle afterAll');
        expect(innerAfterAllIndex).toBeLessThan(middleAfterAllIndex);
      }
    });
    
    it('middle test', () => {
      executionOrder.push('Middle test');
      
      // Verify hooks executed before this test
      expect(executionOrder).toContain('Outer beforeAll');
      expect(executionOrder).toContain('Middle beforeAll');
      expect(executionOrder).toContain('Outer beforeEach');
      expect(executionOrder).toContain('Middle beforeEach');
      
      // Verify order for this test
      const lastOuterBeforeEachIndex = executionOrder.lastIndexOf('Outer beforeEach');
      const lastMiddleBeforeEachIndex = executionOrder.lastIndexOf('Middle beforeEach');
      const middleTestIndex = executionOrder.lastIndexOf('Middle test');
      
      expect(lastOuterBeforeEachIndex).toBeLessThan(lastMiddleBeforeEachIndex);
      expect(lastMiddleBeforeEachIndex).toBeLessThan(middleTestIndex);
    });
    
    describe('Inner Level', () => {
      beforeAll(() => {
        executionOrder.push('Inner beforeAll');
        
        // Verify outer and middle beforeAll were already called
        expect(executionOrder).toContain('Outer beforeAll');
        expect(executionOrder).toContain('Middle beforeAll');
        
        // Verify order
        const outerBeforeAllIndex = executionOrder.indexOf('Outer beforeAll');
        const middleBeforeAllIndex = executionOrder.indexOf('Middle beforeAll');
        const innerBeforeAllIndex = executionOrder.indexOf('Inner beforeAll');
        
        expect(outerBeforeAllIndex).toBeLessThan(middleBeforeAllIndex);
        expect(middleBeforeAllIndex).toBeLessThan(innerBeforeAllIndex);
      });
      
      beforeEach(() => {
        executionOrder.push('Inner beforeEach');
        
        // Verify outer and middle beforeEach were already called for this test
        const testIndex = executionOrder.length - 1;
        const beforeTestEntries = executionOrder.slice(0, testIndex);
        const lastOuterBeforeEach = beforeTestEntries.lastIndexOf('Outer beforeEach');
        const lastMiddleBeforeEach = beforeTestEntries.lastIndexOf('Middle beforeEach');
        
        expect(lastOuterBeforeEach).toBeGreaterThan(-1);
        expect(lastMiddleBeforeEach).toBeGreaterThan(-1);
        
        // Verify order for this test
        const lastOuterBeforeEachIndex = executionOrder.lastIndexOf('Outer beforeEach');
        const lastMiddleBeforeEachIndex = executionOrder.lastIndexOf('Middle beforeEach');
        const innerBeforeEachIndex = executionOrder.lastIndexOf('Inner beforeEach');
        
        expect(lastOuterBeforeEachIndex).toBeLessThan(lastMiddleBeforeEachIndex);
        expect(lastMiddleBeforeEachIndex).toBeLessThan(innerBeforeEachIndex);
      });
      
      afterEach(() => {
        executionOrder.push('Inner afterEach');
        
        // Verify this runs before middle and outer afterEach
        // (will be verified in middle and outer afterEach)
      });
      
      afterAll(() => {
        executionOrder.push('Inner afterAll');
      });
      
      it('inner test', () => {
        executionOrder.push('Inner test');
        
        // Verify all beforeAll and beforeEach hooks executed before this test
        expect(executionOrder).toContain('Outer beforeAll');
        expect(executionOrder).toContain('Middle beforeAll');
        expect(executionOrder).toContain('Inner beforeAll');
        expect(executionOrder).toContain('Outer beforeEach');
        expect(executionOrder).toContain('Middle beforeEach');
        expect(executionOrder).toContain('Inner beforeEach');
        
        // Verify order for this test
        const lastOuterBeforeEachIndex = executionOrder.lastIndexOf('Outer beforeEach');
        const lastMiddleBeforeEachIndex = executionOrder.lastIndexOf('Middle beforeEach');
        const lastInnerBeforeEachIndex = executionOrder.lastIndexOf('Inner beforeEach');
        const innerTestIndex = executionOrder.lastIndexOf('Inner test');
        
        expect(lastOuterBeforeEachIndex).toBeLessThan(lastMiddleBeforeEachIndex);
        expect(lastMiddleBeforeEachIndex).toBeLessThan(lastInnerBeforeEachIndex);
        expect(lastInnerBeforeEachIndex).toBeLessThan(innerTestIndex);
      });
      
      // Verify afterEach execution order
      it('should verify afterEach execution order', () => {
        executionOrder.push('AfterEach verification test');
        
        // Find the previous test's afterEach hooks
        const previousTestIndex = executionOrder.indexOf('Inner test');
        const afterPreviousTestEntries = executionOrder.slice(previousTestIndex + 1);
        
        // Get indices of afterEach hooks
        const innerAfterEachIndex = afterPreviousTestEntries.indexOf('Inner afterEach');
        const middleAfterEachIndex = afterPreviousTestEntries.indexOf('Middle afterEach');
        const outerAfterEachIndex = afterPreviousTestEntries.indexOf('Outer afterEach');
        
        // Verify innermost to outermost order
        expect(innerAfterEachIndex).toBeLessThan(middleAfterEachIndex);
        expect(middleAfterEachIndex).toBeLessThan(outerAfterEachIndex);
      });
    });
  });
});