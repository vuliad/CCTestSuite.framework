// mock.ts

export type MockFn<T extends (...args: any[]) => any = (...args: any[]) => any> = T & {
    __isMockFn: true;
    mockName?: string; // Store name as a separate property instead of trying to modify fn.name
    calls: Parameters<T>[];
    results: ReturnType<T>[];
    impl: T;
    mockReturnValue(value: ReturnType<T>): void;
    mockImplementation(impl: T): void;
};

function createMockFn<T extends (...args: any[]) => any>(name?: string): MockFn<T> {
    let impl: T = ((..._args: any[]) => undefined) as T;

    const fn = ((...args: any[]) => {
        const result = impl(...args);
        fn.calls.push(args as Parameters<T>);
        fn.results.push(result);
        return result;
    }) as MockFn<T>;

    fn.__isMockFn = true;
    fn.mockName = name; // Store as a property instead of trying to change function name
    fn.calls = [];
    fn.results = [];
    fn.impl = impl;
    fn.mockReturnValue = (val) => {
        impl = (() => val) as T;
        fn.impl = impl;
    };
    fn.mockImplementation = (newImpl: T) => {
        impl = newImpl;
        fn.impl = impl;
    };

    return fn;
}

// Simple deepEqual using JSON stringify
function deepEqual(a: any, b: any): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

// Argument matcher
function argsMatch(expected: any[], actual: any[]): boolean {
    if (expected.length !== actual.length) return false;
    return expected.every((v, i) => deepEqual(v, actual[i]));
}

// Simple stub registry
type Stub = {
    args: any[];
    value: any;
};
const stubMap = new WeakMap<Function, Stub[]>();

function when<F extends (...args: any[]) => any>(call: ReturnType<F>) {
    const fn = lastCalledMockFn;
    const args = lastCallArgs;

    return {
        thenReturn(value: ReturnType<F>) {
            if (!fn || !args) throw new Error('when() must be called with a mock function invocation');
            const stubs = stubMap.get(fn) ?? [];
            stubs.push({args, value});
            stubMap.set(fn, stubs);
            fn.mockImplementation((...callArgs: any[]) => {
                const stub = stubs.find(s => argsMatch(s.args, callArgs));
                return stub ? stub.value : undefined;
            });
        }
    };
}

// Global tracking for when(fn(...)) style
let lastCalledMockFn: any = null;
let lastCallArgs: any[] | null = null;

function wrapTrack<T extends (...args: any[]) => any>(fn: MockFn<T>): MockFn<T> {
    const proxy = ((...args: any[]) => {
        lastCalledMockFn = fn;
        lastCallArgs = args;
        return fn(...args);
    }) as MockFn<T>;
    Object.assign(proxy, fn);
    return proxy;
}

function verify<T extends (...args: any[]) => any>(fn: MockFn<T>) {
    if (!fn.__isMockFn) throw new Error('verify() only works on mock functions');

    return {
        wasCalledWith: (...expectedArgs: Parameters<T>) => {
            const matched = fn.calls.some((args) => argsMatch(expectedArgs, args));
            if (!matched) {
                throw new Error(
                    `Expected '${fn.mockName ?? 'mockFn'}' to be called with:\n  ${JSON.stringify(expectedArgs)}\nBut calls were:\n  ${fn.calls.map(c => JSON.stringify(c)).join('\n  ')}`
                );
            }
        }
    };
}

function reset(...fns: MockFn[]) {
    for (const fn of fns) {
        fn.calls.length = 0;
        fn.results.length = 0;
        fn.mockImplementation(() => undefined);
        stubMap.delete(fn);
    }
}

export const mock = {
    mockFn: <T extends (...args: any[]) => any>(name?: string) => wrapTrack(createMockFn<T>(name)),
    when,
    verify,
    reset
};