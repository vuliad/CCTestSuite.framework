// src/assertion.ts

// Helper function for type checking
function getType(value: any): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) return 'array';
    return typeof value;
}

// Enhanced deep equality check
function deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a == null || b == null) return a === b;
    const typeA = getType(a);
    const typeB = getType(b);
    if (typeA !== typeB) return false;
    if (a instanceof Date && b instanceof Date) {
        return a.getTime() === b.getTime();
    }
    if (a instanceof RegExp && b instanceof RegExp) {
        return a.toString() === b.toString();
    }
    if (typeA === 'array') {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (!deepEqual(a[i], b[i])) return false;
        }
        return true;
    }
    if (typeA === 'object') {
        if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        if (keysA.length !== keysB.length) return false;
        for (const key of keysA) {
            if (!Object.prototype.hasOwnProperty.call(b, key) || !deepEqual(a[key], b[key])) {
                return false;
            }
        }
        return true;
    }
    return false;
}

export class Assertion {
    private actual: any;
    private _isNegated: boolean = false;

    constructor(actual: any, negated: boolean = false) {
        this.actual = actual;
        this._isNegated = negated;
    }

    // --- Chaining ---
    get to(): this {
        return this;
    }

    get be(): this {
        return this;
    }

    get an(): this {
        return this;
    }

    get a(): this {
        return this;
    }

    get have(): this {
        return this;
    }

    get has(): this {
        return this;
    }

    get and(): this {
        return this;
    }

    // --- Negation ---
    get not(): Assertion {
        return new Assertion(this.actual, !this._isNegated);
    }

    // --- Helpers ---
// Corrected stringify implementation

// (Assume getType function exists if needed by deepEqual, but not directly by stringify)
// function getType(value: any): string { ... }

    private stringify(value: any): string {
        // Use a Set to track visited objects/arrays for circular reference detection
        const seen = new Set<any>();
        // Set a maximum depth to prevent excessive output / potential stack overflow
        const maxDepth = 4; // Adjust as needed

        function _stringifyInternal(val: any, depth: number): string {
            // Handle primitives first
            if (val === null) return 'null';
            if (val === undefined) return 'undefined';
            if (typeof val === 'string') {
                const escaped = val.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                return `'${escaped}'`;
            }
            if (typeof val === 'number') {
                if (isNaN(val)) return 'NaN';
                if (!isFinite(val)) return val > 0 ? 'Infinity' : '-Infinity';
                return String(val);
            }
            if (typeof val === 'boolean') return String(val);
            if (typeof val === 'bigint') return `${String(val)}n`;
            if (typeof val === 'symbol') return String(val);

            // Handle complex types
            const type = typeof val;
            if (type === 'object' || type === 'function') {
                if (seen.has(val)) {
                    return '[Circular]';
                }
                if (depth <= 0) {
                    if (Array.isArray(val)) return '[Array]';
                    if (val instanceof Date) return `Date(...)`; // Abbreviate at depth limit
                    if (val instanceof RegExp) return String(val);
                    return '[Object]';
                }

                seen.add(val);
                let result: string;

                if (val instanceof Date) {
                    result = `Date(${val.toISOString()})`;
                } else if (val instanceof RegExp) {
                    result = String(val);
                } else if (val instanceof Error) {
                    result = `${val.name || 'Error'}(${val.message ? `'${val.message}'` : ''})`;
                } else if (Array.isArray(val)) {
                    const elements = val.map(el => _stringifyInternal(el, depth - 1));
                    result = `[${elements.length > 0 ? ' ' + elements.join(', ') + ' ' : ''}]`;
                } else if (type === 'function') {
                    result = `[Function${val.name ? ': ' + val.name : ''}]`;
                } else { // Plain objects or others
                    const keys = Object.keys(val);
                    if (keys.length === 0) {
                        // Check constructor name for slightly better empty object representation
                        const constructorName = val?.constructor?.name;
                        result = (constructorName && constructorName !== 'Object') ? `${constructorName} {}` : '{}';
                    } else {
                        const properties = keys.map(key => {
                            // --- FIX IS HERE ---
                            // Use JSON.stringify for keys that aren't simple identifiers
                            const keyStr = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)
                                ? key
                                : JSON.stringify(key); // Use JSON.stringify for complex/quoted keys
                            // --- END FIX ---
                            return `${keyStr}: ${_stringifyInternal(val[key], depth - 1)}`;
                        });
                        const constructorName = val?.constructor?.name;
                        const prefix = (constructorName && constructorName !== 'Object') ? `${constructorName} ` : '';
                        result = `${prefix}{ ${properties.join(', ')} }`;
                    }
                }

                seen.delete(val);
                return result;

            } else {
                // Fallback for unknown types
                return String(val);
            }
        }

        return _stringifyInternal(value, maxDepth);
    }

    // Generates the final error message, replacing ESCAPED placeholders
    private generateErrorMessage(expected: any, messageTpl: string): string {
        const negation = this._isNegated ? 'not ' : '';
        const actualStr = this.stringify(this.actual);
        // Stringify expected only if it's needed for the message
        const expectedStr = messageTpl.includes('%{expected}') ? this.stringify(expected) : ''; // Look for escaped placeholder

        // Replace the ESCAPED placeholders
        return messageTpl
            .replace('%{negation}', negation) // Replace escaped placeholder
            .replace('%{actual}', actualStr)   // Replace escaped placeholder
            .replace('%{expected}', expectedStr); // Replace escaped placeholder
    }

    // Performs the check and throws if needed, using the template with escaped placeholders
    private check(condition: boolean, expected: any, messageTpl: string): void {
        // messageTpl now contains literal '%{negation}', '%{actual}', '%{expected}'
        if (this._isNegated ? condition : !condition) {
            throw new Error(this.generateErrorMessage(expected, messageTpl));
        }
    }

    // --- Assertions ---

    /** Strict equality (===) */
    toBe(expected: any): void {
        this.check(
            this.actual === expected,
            expected,
            // Use escaped placeholders in the template literal string
            `Expected %{actual} %{negation}to be (strictly equal) %{expected}`
        );
    }

    /** Deep equality */
    toEqual(expected: any): void {
        this.check(
            deepEqual(this.actual, expected),
            expected,
            // Use escaped placeholders
            `Expected %{actual} %{negation}to deeply equal %{expected}`
        );
    }

    /** Check for truthiness (!!actual) */
    toBeTruthy(): void {
        this.check(
            !!this.actual,
            undefined,
            // Use escaped placeholders
            `Expected %{actual} %{negation}to be truthy`
        );
    }

    /** Check for falsiness (!actual) */
    toBeFalsy(): void {
        this.check(
            !this.actual,
            undefined,
            // Use escaped placeholders
            `Expected %{actual} %{negation}to be falsy`
        );
    }

    /** Check if value is null */
    toBeNull(): void {
        this.check(
            this.actual === null,
            null,
            // Use escaped placeholders
            `Expected %{actual} %{negation}to be null`
        );
    }

    /** Check if value is undefined */
    toBeUndefined(): void {
        this.check(
            this.actual === undefined,
            undefined,
            // Use escaped placeholders
            `Expected %{actual} %{negation}to be undefined`
        );
    }

    /** Check if value is defined (not undefined) */
    toBeDefined(): void {
        this.check(
            this.actual !== undefined,
            undefined,
            // Use escaped placeholders
            `Expected %{actual} %{negation}to be defined (not undefined)`
        );
    }

    /** Check if value is true */
    toBeTrue(): void {
        this.check(
            this.actual === true,
            true,
            // Use escaped placeholders
            `Expected %{actual} %{negation}to be true`
        );
    }

    /** Check if value is false */
    toBeFalse(): void {
        this.check(
            this.actual === false,
            false,
            // Use escaped placeholders
            `Expected %{actual} %{negation}to be false`
        );
    }

    /** Check numeric greater than */
    toBeGreaterThan(expected: number): void {
        if (typeof this.actual !== 'number' || typeof expected !== 'number') {
            throw new Error(`Both actual (${this.stringify(this.actual)}) and expected (${this.stringify(expected)}) must be numbers for toBeGreaterThan`);
        }
        this.check(
            this.actual > expected,
            expected,
            // Use escaped placeholders
            `Expected %{actual} %{negation}to be greater than %{expected}`
        );
    }

    gt(expected: number): void {
        this.toBeGreaterThan(expected);
    }

    /** Check numeric greater than or equal */
    toBeGreaterThanOrEqual(expected: number): void {
        if (typeof this.actual !== 'number' || typeof expected !== 'number') {
            throw new Error(`Both actual (${this.stringify(this.actual)}) and expected (${this.stringify(expected)}) must be numbers for toBeGreaterThanOrEqual`);
        }
        this.check(
            this.actual >= expected,
            expected,
            // Use escaped placeholders
            `Expected %{actual} %{negation}to be greater than or equal to %{expected}`
        );
    }

    gte(expected: number): void {
        this.toBeGreaterThanOrEqual(expected);
    }

    /** Check numeric less than */
    toBeLessThan(expected: number): void {
        if (typeof this.actual !== 'number' || typeof expected !== 'number') {
            throw new Error(`Both actual (${this.stringify(this.actual)}) and expected (${this.stringify(expected)}) must be numbers for toBeLessThan`);
        }
        this.check(
            this.actual < expected,
            expected,
            // Use escaped placeholders
            `Expected %{actual} %{negation}to be less than %{expected}`
        );
    }

    lt(expected: number): void {
        this.toBeLessThan(expected);
    }

    /** Check numeric less than or equal */
    toBeLessThanOrEqual(expected: number): void {
        if (typeof this.actual !== 'number' || typeof expected !== 'number') {
            throw new Error(`Both actual (${this.stringify(this.actual)}) and expected (${this.stringify(expected)}) must be numbers for toBeLessThanOrEqual`);
        }
        this.check(
            this.actual <= expected,
            expected,
            // Use escaped placeholders
            `Expected %{actual} %{negation}to be less than or equal to %{expected}`
        );
    }

    lte(expected: number): void {
        this.toBeLessThanOrEqual(expected);
    }

    /** Check if array or string contains a value */
    toContain(expected: any): void {
        let condition = false;
        let typeError = false;
        if (typeof this.actual === 'string') {
            condition = this.actual.includes(String(expected));
        } else if (Array.isArray(this.actual)) {
            condition = this.actual.includes(expected);
        } else {
            typeError = true;
        }
        if (typeError) {
            throw new Error(`Actual value ${this.stringify(this.actual)} must be an array or string for toContain`);
        }
        this.check(
            condition,
            expected,
            // Use escaped placeholders
            `Expected %{actual} %{negation}to contain %{expected}`
        );
    }

    /** Check if array contains an item deeply equal to the expected value */
    toContainEqual(expected: any): void {
        if (!Array.isArray(this.actual)) {
            throw new Error(`Actual value ${this.stringify(this.actual)} must be an array for toContainEqual`);
        }
        const condition = this.actual.some(item => deepEqual(item, expected));
        this.check(
            condition,
            expected,
            // Use escaped placeholders
            `Expected %{actual} %{negation}to contain an item deeply equal to %{expected}`
        );
    }

    /** Check length property */
    toHaveLength(expected: number): void {
        let actualLength: number | undefined;
        let hasLengthProperty = false;
        if (this.actual != null && typeof this.actual.length === 'number') {
            actualLength = this.actual.length;
            hasLengthProperty = true;
        }
        if (!hasLengthProperty) {
            throw new Error(`Actual value ${this.stringify(this.actual)} must have a 'length' property`);
        }
        // NOTE: We need the actualLength value in the message, so we can't entirely use escaped placeholders here.
        // We construct the string *before* calling check.
        const messageTpl = `Expected ${this.stringify(this.actual)} (length ${actualLength}) %{negation}to have length %{expected}`;
        this.check(
            actualLength === expected,
            expected,
            messageTpl // Pass the constructed template with placeholders for negation and expected
        );
    }

    /** Check if object has a property */
    toHaveProperty(propertyPath: string | (string | number)[], value?: any): void {
        const pathArray = Array.isArray(propertyPath) ? propertyPath : propertyPath.split('.');
        let current: any = this.actual;
        let exists = true;
        if (this.actual == null) {
            exists = false;
        } else {
            for (let i = 0; i < pathArray.length; i++) {
                const key = pathArray[i];
                const hasOwn = typeof current === 'object' && current !== null && Object.prototype.hasOwnProperty.call(current, key);
                const hasIndex = Array.isArray(current) && typeof key === 'number' && key >= 0 && key < current.length;
                const hasStringIndex = Array.isArray(current) && typeof key === 'string' && !isNaN(parseInt(key, 10)) && parseInt(key, 10) >= 0 && parseInt(key, 10) < current.length;
                if (!(hasOwn || hasIndex || hasStringIndex)) {
                    exists = false;
                    break;
                }
                current = current[key];
            }
        }
        const propertyPathStr = Array.isArray(propertyPath) ? propertyPath.map(String).join('.') : propertyPath;

        // Check existence first
        // NOTE: Need propertyPathStr in the message. Construct before calling check.
        const existenceMessageTpl = `Expected %{actual} %{negation}to have property '${propertyPathStr}'`;
        this.check(
            exists,
            propertyPathStr, // Expected here is the path string for the message
            existenceMessageTpl
        );

        // If a value was provided, check it
        if (arguments.length > 1 && exists !== this._isNegated) {
            // NOTE: Need propertyPathStr and the actual found value ('current') in the message. Construct before calling check.
            // The value for %{actual} placeholder will be the original object, not 'current'.
            const valueMessageTpl = `Expected property '${propertyPathStr}' of %{actual} %{negation}to have value %{expected} (but got ${this.stringify(current)})`;
            this.check(
                deepEqual(current, value),
                value, // Expected here is the value argument
                valueMessageTpl
            );
        }
    }

    /** Check if value is an instance of a constructor */
    toBeInstanceOf(expectedConstructor: Function): void {
        if (typeof expectedConstructor !== 'function') {
            throw new Error(`Expected constructor must be a function/class, but got ${this.stringify(expectedConstructor)}`);
        }
        const condition = this.actual instanceof expectedConstructor;
        const constructorName = expectedConstructor.name || '<anonymous constructor>';
        // NOTE: Need constructorName in the message. Construct before calling check.
        const messageTpl = `Expected %{actual} %{negation}to be an instance of ${constructorName}`;
        this.check(
            condition,
            constructorName, // Expected for message generation
            messageTpl
        );
    }

    /** Check typeof value */
    toBeTypeOf(expectedType: 'string' | 'number' | 'bigint' | 'boolean' | 'symbol' | 'undefined' | 'object' | 'function'): void {
        const actualType = typeof this.actual;
        // NOTE: Need actualType in the message. Construct before calling check.
        const messageTpl = `Expected %{actual} (type ${actualType}) %{negation}to be of type %{expected}`;
        this.check(
            actualType === expectedType,
            expectedType,
            messageTpl
        );
    }

    /** Check if a function throws an error */
    toThrow(errorMatcher?: string | RegExp | Error | Function): void {
        if (typeof this.actual !== 'function') {
            throw new Error(`Actual value ${this.stringify(this.actual)} must be a function to use toThrow`);
        }
        let thrownError: Error | null = null;
        let didThrow = false;
        try {
            this.actual();
        } catch (e) {
            didThrow = true;
            thrownError = e instanceof Error ? e : new Error(String(e));
        }

        // Check if it threw *something*
        this.check(
            didThrow,
            errorMatcher ?? '<any error>',
            // Use escaped placeholders
            `Expected function %{actual} %{negation}to throw an error`
        );

        // --- Detailed Matcher Check ---
        if (!this._isNegated && didThrow && errorMatcher) {
            // This part remains the same as it constructs a specific error message
            // *after* the main check, and doesn't use the general check/generateErrorMessage mechanism
            let match = false;
            let expectedDescription = '';
            if (typeof errorMatcher === 'string') {
                match = thrownError!.message.includes(errorMatcher);
                expectedDescription = `error message including "${errorMatcher}"`;
            } else if (errorMatcher instanceof RegExp) {
                match = errorMatcher.test(thrownError!.message);
                expectedDescription = `error message matching ${errorMatcher}`;
            } else if (errorMatcher instanceof Error) {
                match = thrownError!.message === errorMatcher.message && thrownError!.name === errorMatcher.name;
                expectedDescription = `error with message "${errorMatcher.message}" and name "${errorMatcher.name}"`;
            } else if (typeof errorMatcher === 'function' && (
                // More reliable way to check if a function is an Error constructor
                errorMatcher === Error || 
                errorMatcher.prototype instanceof Error || 
                /^(?:.*Error|.*Exception)$/.test(errorMatcher.name)
            )) {
                match = thrownError instanceof errorMatcher;
                expectedDescription = `error instance of ${errorMatcher.name || '<anonymous constructor>'}`;
            } else if (typeof errorMatcher === 'function') {
                try {
                    match = errorMatcher(thrownError);
                    expectedDescription = `error matching custom function "${errorMatcher.name || '<anonymous function>'}"`;
                    if (typeof match !== 'boolean') {
                        throw new Error(`Custom error matcher function must return a boolean, but returned ${this.stringify(match)}`);
                    }
                } catch (matchFnError: any) {
                    throw new Error(`Custom error matcher function threw an error during execution: ${matchFnError?.message ?? matchFnError}`);
                }
            } else {
                throw new Error(`Invalid error matcher type: ${this.stringify(errorMatcher)}. Use string, RegExp, Error instance, Error constructor, or a predicate function.`);
            }
            if (!match) {
                throw new Error(`Expected function ${this.stringify(this.actual)} to throw ${expectedDescription}, but it threw ${this.stringify(thrownError)} (message: "${thrownError?.message}")`);
            }
        }
    }
}

// Factory function
export function expect(actual: any): Assertion {
    return new Assertion(actual);
}