# Testing

This project uses [Vitest](https://vitest.dev/) for testing with comprehensive coverage of the download functionality.

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

### Unit Tests (`test/reliable-download.test.js`)
- Basic download functionality
- Authentication with Bearer tokens
- Custom headers handling
- Chunked downloads for large files
- Error handling and retry logic
- Edge cases (empty files, small chunks, etc.)
- File System Access API integration

### Integration Tests (`test/integration.test.js`)
- Complete download workflows
- Mixed success/retry scenarios
- End-to-end functionality testing

## Test Coverage

The test suite covers:

- ✅ **Download Logic** - Core download functionality
- ✅ **Chunking** - Range request handling
- ✅ **Retries** - Automatic retry mechanisms
- ✅ **Authentication** - Token and header handling
- ✅ **Progress Tracking** - Callback functionality
- ✅ **Error Handling** - Various failure scenarios
- ✅ **File System API** - Browser file saving
- ✅ **Edge Cases** - Boundary conditions

## Mocked APIs

Since this library uses browser-specific APIs, the tests mock:

- **fetch API** - For HTTP requests
- **File System Access API** - For file saving (`window.showSaveFilePicker`, `createWritable`)
- **ArrayBuffer** responses - For chunk data

## Test Environment

Tests run in a JSDOM environment to simulate browser APIs while providing fast execution in Node.js.

## CI/CD Integration

These tests are designed to run in continuous integration environments. The coverage report can be used to ensure code quality standards.

Example coverage command for CI:
```bash
npm run test:coverage -- --reporter=json --outputFile=coverage.json
```
