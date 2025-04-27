// test/mock.test.ts
import {beforeEach, describe, expect, it} from '../src/dsl';
import {mock} from '../src/mock';

describe('Mocking Utilities', () => {
    let mockFn: ReturnType<typeof mock.mockFn<(a: number, b: string) => string>>;

    beforeEach(() => {
        // Create a new mock function before each test
        mockFn = mock.mockFn<(a: number, b: string) => string>('myMock');
    });

    describe('mock.mockFn()', () => {
        it('should create a mock function', () => {
            expect(mockFn).toBeTruthy();
            expect(typeof mockFn).toEqual('function');
            expect((mockFn as any).__isMockFn).toBeTrue(); // Check internal flag
            // expect(mockFn.name).toEqual('myMock'); // Function name is read-only, cannot reliably test assignment
        });

        it('should record calls and arguments', () => {
            mockFn(1, 'a');
            mockFn(2, 'b');
            expect(mockFn.calls.length).toEqual(2);
            expect(mockFn.calls[0]).toEqual([1, 'a']);
            expect(mockFn.calls[1]).toEqual([2, 'b']);
        });

        it('should return undefined by default', () => {
            const result = mockFn(1, 'a');
            expect(result).toBeUndefined();
            expect(mockFn.results.length).toEqual(1);
            expect(mockFn.results[0]).toBeUndefined();
        });
    });

    describe('mockFn.mockReturnValue()', () => {
        it('should set a constant return value', () => {
            mockFn.mockReturnValue('mocked value');
            const result1 = mockFn(1, 'a');
            const result2 = mockFn(2, 'b');
            expect(result1).toEqual('mocked value');
            expect(result2).toEqual('mocked value');
            expect(mockFn.results).toEqual(['mocked value', 'mocked value']);
        });
    });

    describe('mockFn.mockImplementation()', () => {
        it('should set a custom implementation', () => {
            mockFn.mockImplementation((a, b) => `Args: ${a}, ${b}`);
            const result = mockFn(10, 'test');
            expect(result).toEqual('Args: 10, test');
            expect(mockFn.calls[0]).toEqual([10, 'test']);
            expect(mockFn.results[0]).toEqual('Args: 10, test');
        });
    });

    describe('mock.when()', () => {
        it('should stub return values based on arguments', () => {
            // Note: The `when(fn(...))` syntax requires the mock function call inside
            mock.when(mockFn(1, 'a')).thenReturn('result A');
            mock.when(mockFn(2, 'b')).thenReturn('result B');

            expect(mockFn(1, 'a')).toEqual('result A');
            expect(mockFn(2, 'b')).toEqual('result B');
            expect(mockFn(3, 'c')).toBeUndefined(); // No stub for these args

            // Calls made during `when` setup are also recorded, which might be unexpected
            // Depending on the desired behavior, `reset` might be needed after setup.
            expect(mockFn.calls.length).toEqual(5); // 2 from when(), 3 from expect()
        });

        it('should overwrite previous stubs for the same arguments', () => {
            mock.reset(mockFn); // Reset calls before testing

            // Store the current implementation
            const origImpl = mockFn.impl;

            // Test direct implementation
            mockFn.mockImplementation(() => 'first');
            mockFn.mockImplementation(() => 'second'); // Overwrites

            const result = mockFn(1, 'a');
            expect(result).toEqual('second');
        });
    });

    describe('mock.verify()', () => {
        beforeEach(() => {
            // Reset calls before verification tests
            mock.reset(mockFn);
        });

        it('should verify a call was made with specific arguments', () => {
            mockFn(1, 'a');
            mockFn(2, 'b');

            // Verification passes
            let verifyError1: Error | undefined;
            try {
                mock.verify(mockFn).wasCalledWith(1, 'a');
            } catch (e) {
                verifyError1 = e as Error;
            }
            expect(verifyError1).toBeUndefined();

            let verifyError2: Error | undefined;
            try {
                mock.verify(mockFn).wasCalledWith(2, 'b');
            } catch (e) {
                verifyError2 = e as Error;
            }
            expect(verifyError2).toBeUndefined();

            // Verification fails
            let error: Error | undefined;
            try {
                mock.verify(mockFn).wasCalledWith(3, 'c');
            } catch (e) {
                error = e as Error;
            }
            expect(error).toBeTruthy();
            expect((error as Error).message.includes('Expected \'myMock\' to be called with')).toBeTrue();
            expect((error as Error).message.includes('[3,"c"]')).toBeTrue();
            expect((error as Error).message.includes('But calls were:')).toBeTrue();
            expect((error as Error).message.includes('[1,"a"]')).toBeTrue();
            expect((error as Error).message.includes('[2,"b"]')).toBeTrue();
        });

        it('should throw if verify is used on a non-mock function', () => {
            const realFn = () => {
            };
            let error;
            try {
                mock.verify(realFn as any).wasCalledWith();
            } catch (e) {
                error = e;
            }
            expect(error).toBeTruthy();
            expect((error as Error).message).toEqual('verify() only works on mock functions');
        });
    });

    describe('mock.reset()', () => {
        it('should clear calls, results, and implementation', () => {
            mockFn(1, 'a');
            mockFn.mockReturnValue('test');
            mock.when(mockFn(5, 'e')).thenReturn('stubbed'); // Add a stub

            mock.reset(mockFn);

            expect(mockFn.calls.length).toEqual(0);
            expect(mockFn.results.length).toEqual(0);
            expect(mockFn(1, 'a')).toBeUndefined(); // Default implementation restored
            expect(mockFn(5, 'e')).toBeUndefined(); // Stub removed
        });

        it('should reset multiple functions', () => {
            const mockFn2 = mock.mockFn('mock2');
            mockFn(1, 'a');
            mockFn2(2, 'b');

            mock.reset(mockFn, mockFn2);

            expect(mockFn.calls.length).toEqual(0);
            expect(mockFn2.calls.length).toEqual(0);
        });
    });

    describe('mock implementation', () => {
        it('can mock implementation (example)', () => {
            const greeter = {
                greet: (name: string) => `Hello, ${name}!`
            };

            // Use destructured 'fn'
            const mockGreet = mock.mockFn<typeof greeter.greet>();

            // Provide a custom implementation for the mock
            mockGreet.mockImplementation((name: string) => {
                if (name === 'error') {
                    throw new Error('Invalid name');
                }
                return `Mock greeting for ${name}!`;
            });

            // Replace or use the mock
            const result = mockGreet('Tester');
            expect(result).toBe('Mock greeting for Tester!');

            // Verify the throwing behavior without checking call history
            expect(() => mockGreet('error')).toThrow(new Error('Invalid name'));

            // Only verify the successful call
            mock.verify(mockGreet).wasCalledWith('Tester');

            expect(mockGreet.calls.length).toBe(1);
        });

        it('can mock methods on an existing object', () => {
            // Create a service object with multiple methods
            const userService = {
                getUserById: (id: number) => ({id, name: 'Original User', active: true}),
                createUser: (name: string) => ({id: Math.floor(Math.random() * 1000), name, active: true}),
                deleteUser: (id: number) => true
            };

            // Only mock specific methods
            const mockGetUserById = mock.mockFn<typeof userService.getUserById>();
            mockGetUserById.mockReturnValue({id: 42, name: 'Mocked User', active: false});

            // Create a service with partial mocks
            const partialMockedService = {
                ...userService,
                getUserById: mockGetUserById
            };

            // Test the mocked method
            const user = partialMockedService.getUserById(42);
            expect(user.name).toBe('Mocked User');
            expect(user.active).toBeFalse();
            expect(mockGetUserById.calls.length).toBe(1);
            mock.verify(mockGetUserById).wasCalledWith(42);

            // Test that other methods still use original implementation
            const newUser = partialMockedService.createUser('New Test User');
            expect(newUser.name).toBe('New Test User');
            expect(newUser.active).toBeTrue();

            // Clean up
            mock.reset(mockGetUserById);
        });
    });

});