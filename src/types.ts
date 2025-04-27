export type SafeError = {
  /** e.g. "TypeError" */
  name?: string;
  /** e.g. "Cannot read property 'to' of undefined" */
  message: string;
  /** first file path parsed from the stack, if any */
  file?: string;
  /** line number */
  line?: number;
  /** column number */
  column?: number;
  /** full stack split into lines */
  stack?: string[];
};

export type TestStatus = 'passed' | 'failed' | 'skipped';

export interface TestResult {
  suite: string; // Full suite path (e.g., "Outer > Middle")
  test: string;
  status: TestStatus;
  duration: number;
  error?: SafeError;
}

export type TestFn = () => void | Promise<void>;
export type HookFn = () => void | Promise<void>; // Renamed from Hook

// Represents a single test case within a describe block
export interface TestCase {
  name: string;
  fn: TestFn;
  tags: string[]; // Keep tags if you use them
  describeBlock: DescribeBlock; // Link back to its describe block
}

// Represents a describe block (suite)
export interface DescribeBlock {
  name: string;
  parent: DescribeBlock | null; // Link to parent for inheritance
  children: DescribeBlock[]; // Nested describes
  tests: TestCase[]; // Tests defined directly in this block
  beforeAllHooks: HookFn[];
  beforeEachHooks: HookFn[];
  afterEachHooks: HookFn[];
  afterAllHooks: HookFn[];
  // --- State for runner ---
  ranBeforeAll: boolean; // Track if beforeAll has run for this scope
  // ranAfterAll: boolean; // Track if afterAll has run for this scope (handled slightly differently in runner)
  executed: boolean; // Track if the block was entered by the runner at all
}