import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it} from './dsl'
import {mock} from './mock'; // Import the specific 'mock' object
import {getTestList, runTests} from "./runner";

// Define the actual implementation
const testSuiteImplementation = {
    describe,
    it,
    expect,
    mock,
    lifecycle: {
        beforeAll,
        beforeEach,
        afterEach,
        afterAll,
    },
    runner: {
        runTests,
        getTestList
    }
};

// Export it for module loaders (CommonJS, ES Modules)
export default CCTestSuite = testSuiteImplementation;

// Define a type alias for the exported object's shape
type CCTestSuiteType = typeof testSuiteImplementation;

// Declare the global variable for environments that load the UMD bundle directly (e.g., <script> tag)
// This ensures TypeScript users in those environments know about the global CCTestSuite
declare global {
    // Use 'var' because UMD typically assigns to a 'var' on the global object (e.g., window)
    // Assign the type we defined above
    var CCTestSuite: CCTestSuiteType;
}
