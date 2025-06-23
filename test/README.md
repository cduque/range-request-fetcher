# Testing

This project uses [Vitest](https://vitest.dev/) for testing with comprehensive coverage of download functionality including pause, resume, and abort capabilities.

## Running Tests

```bash
# Install dependencies first
npm install

# Run tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests with UI
npm run test:ui
```

## Test Structure

### Unit Tests (`unit.test.js`)
- **Control Object API** - Testing pause, resume, abort methods
- **State Management** - isPaused(), isAborted(), getProgress() functionality
- **Method Validation** - Ensuring all control methods exist and work correctly
- **Initial State Testing** - Verifying default states

### Complete Functionality Tests (`complete.test.js`)
- **Download Control API** - Full pause/resume/abort workflow testing
- **Error Handling** - HEAD request failures, missing headers, retry exhaustion
- **Authentication** - Bearer tokens and custom headers
- **Chunked Downloads** - Large file handling with progress tracking
- **Download Control Integration** - End-to-end control functionality

### Integration Tests (`integration.test.js`)
- **Mixed Success/Retry Scenarios** - Real-world download conditions
- **Pause During Retry Workflows** - Complex state management
- **Abort During Downloads** - Immediate cancellation testing
- **Complete Download Workflows** - End-to-end functionality
- **Network Failure Recovery** - Resilience testing

## Test Coverage

The test suite provides **24 comprehensive tests** covering:

- ✅ **Download Control** - Pause, resume, abort functionality
- ✅ **State Management** - Accurate state tracking and transitions
- ✅ **Download Logic** - Core range request functionality
- ✅ **Chunking** - Range request handling for large files
- ✅ **Retries** - Automatic retry mechanisms with backoff
- ✅ **Authentication** - Token and custom header handling
- ✅ **Progress Tracking** - Real-time progress callbacks
- ✅ **Error Handling** - Comprehensive failure scenario coverage
- ✅ **File System API** - Browser file saving integration
- ✅ **Edge Cases** - Boundary conditions and error states
- ✅ **Promise Management** - Proper async/await handling

## Mocked APIs

Since this library uses browser-specific APIs, the tests mock:

- **fetch API** - For HTTP requests and range requests
- **File System Access API** - For file saving (`window.showSaveFilePicker`, `createWritable`)
- **AbortController** - For download cancellation
- **ArrayBuffer** responses - For chunk data simulation

## Test Configuration

### Setup (`setup.js`)
Global test setup provides:
- Mock implementations for browser APIs
- Consistent test environment configuration
- Proper cleanup between tests
- Case-insensitive header handling for fetch mocks

### Test Environment
Tests run in a JSDOM environment to simulate browser APIs while providing fast execution in Node.js.

## Test Results

Current test status: **✅ 24/24 tests passing**
- **Unit Tests**: 4 tests
- **Complete Tests**: 15 tests  
- **Integration Tests**: 5 tests

All tests run cleanly with **zero unhandled promise rejections**.

## CI/CD Integration

These tests are designed to run in continuous integration environments. The coverage report can be used to ensure code quality standards.

Example coverage command for CI:
```bash
npm run test:coverage -- --reporter=json --outputFile=coverage.json
```

## Download Control Testing

Special focus on testing the new download control features:

### Pause/Resume Testing
- State validation during pause/resume cycles
- Multiple pause/resume scenarios
- Progress tracking during state changes

### Abort Testing  
- Immediate cancellation functionality
- Promise rejection handling
- State cleanup after abort
- Prevention of resume after abort

### Error Scenarios
- Network failures during downloads
- Authentication errors
- Missing headers and malformed responses
- Retry exhaustion testing
