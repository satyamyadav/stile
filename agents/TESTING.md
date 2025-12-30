# Testing Guide

This document describes the testing setup for the Stile monorepo using Nx and Jest.

## Test Structure

Each package has independent test setup with mocked external dependencies:

- **`packages/core`** - Core engine tests with mocked file system, plugins, and exporter
- **`packages/plugins`** - Plugin unit tests
- **`packages/cli`** - CLI tests with mocked commander, file system, and core
- **`packages/examples`** - E2E tests against example project

## Running Tests

### Run all tests
```bash
npm test
# or
nx run-many -t test
```

### Run tests for specific package
```bash
nx test core
nx test plugins
nx test cli
nx test examples
```

### Run tests in watch mode
```bash
nx test core --watch
```

### Run tests with coverage
```bash
nx test core --coverage
```

## Test Configuration

### Jest Preset (`jest.preset.js`)
- Uses `@nx/jest/preset` for Nx integration
- Configures test matching pattern
- Sets up module resolver

### Package Jest Configs
Each package has its own `jest.config.ts`:
- Extends the root preset
- Configures TypeScript transformation with `ts-jest`
- Maps workspace packages (`@stile/*`) to source files
- Sets coverage directories

### TypeScript Configs
Each package has `tsconfig.spec.json`:
- Extends base `tsconfig.json`
- Includes Jest types
- Configures for CommonJS module system

## Mocking Strategy

### Core Package
- Mocks `glob` for file discovery
- Mocks `chalk` for console output
- Mocks `@stile/exporter` for export functionality
- Mocks `ts-morph` Project
- Mocks `fs/promises` for file reading
- Mocks `child_process` for git commands

### CLI Package
- Mocks `commander` for CLI framework
- Mocks `chalk` and `ora` for output
- Mocks `fs-extra` for file operations
- Mocks `@stile/core` StileEngine

### Plugins Package
- No external mocks needed (pure functions)
- Tests plugin logic directly

## E2E Testing

The `examples` package contains:
- Example React project with intentional violations
- E2E tests that run the CLI against the example project
- Tests verify:
  - Scan command execution
  - Report generation
  - Export functionality
  - Configuration validation

### Example Project Structure
```
packages/examples/src/example-project/
├── src/
│   ├── Button.tsx    # Has inline styles and magic numbers
│   ├── Card.tsx      # Clean component
│   └── App.tsx       # Has magic number
└── stile.config.js   # Test configuration
```

### Running E2E Tests
```bash
nx test examples
```

## Writing Tests

### Unit Test Example (Core)
```typescript
describe('StileEngine', () => {
  let engine: StileEngine;
  
  beforeEach(() => {
    engine = new StileEngine();
    jest.clearAllMocks();
  });
  
  it('should register a valid plugin', () => {
    expect(() => engine.registerPlugin(mockPlugin)).not.toThrow();
  });
});
```

### Plugin Test Example
```typescript
describe('sampleMagicNumberPlugin', () => {
  let context: StileContext;
  
  beforeEach(() => {
    context = {
      filePath: '/test/file.tsx',
      project: '/test',
      source: '',
      findings: [],
      components: [],
    };
  });
  
  it('should detect magic numbers', () => {
    context.source = 'const width = 500;';
    sampleMagicNumberPlugin.run(context);
    expect(context.findings.length).toBeGreaterThan(0);
  });
});
```

### E2E Test Example
```typescript
describe('CLI E2E Tests', () => {
  it('should run scan and generate report', () => {
    execSync('node cli.js scan --config stile.config.js');
    expect(fs.existsSync('stile-report.json')).toBe(true);
  });
});
```

## Best Practices

1. **Isolate Tests**: Each package tests independently with mocks
2. **Mock External Dependencies**: Use Jest mocks for file system, network, etc.
3. **Test Behavior**: Focus on what the code does, not implementation details
4. **Use Descriptive Names**: Test names should clearly describe what they test
5. **Clean Up**: Use `beforeEach`/`afterEach` to reset state
6. **Coverage**: Aim for high coverage of business logic, not mocks

## Troubleshooting

### Tests fail with module resolution errors
- Check `moduleNameMapper` in `jest.config.ts`
- Verify paths in `tsconfig.spec.json`

### E2E tests fail
- Ensure CLI is built: `npm run build`
- Check example project files exist
- Verify paths in e2e tests

### Coverage not generating
- Check `collectCoverageFrom` in `jest.config.ts`
- Verify coverage directory exists

