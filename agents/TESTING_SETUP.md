# Testing Setup - Nx Jest Configuration

This document describes the testing setup following the [official Nx Jest documentation](https://nx.dev/docs/technologies/test-tools/jest/introduction).

## Configuration Overview

### 1. Nx Plugin Configuration

The `@nx/jest/plugin` is configured in `nx.json`:

```json
{
  "plugins": [
    {
      "plugin": "@nx/jest/plugin",
      "options": {
        "targetName": "test"
      }
    }
  ]
}
```

This plugin automatically infers Jest test tasks for projects with Jest configurations.

### 2. Root Jest Configuration

**`jest.config.ts`** - Root multi-project configuration:
- Uses `getJestProjectsAsync()` to automatically discover all Jest projects
- Enables IDE/editor integration to pick up individual project configs

**`jest.preset.js`** - Shared Jest preset:
- Extends `@nx/jest/preset`
- Configures test matching, resolver, and module extensions

### 3. Package Jest Configurations

Each package has its own `jest.config.ts` that:
- Extends the root `jest.preset.js`
- Configures TypeScript transformation with `ts-jest`
- Maps workspace packages (`@stile/*`) to source files
- Sets coverage directories

### 4. Project Configuration

Each package's `project.json` defines the test target:

```json
{
  "targets": {
    "test": {
      "executor": "@nx/jest:jest",
      "outputs": ["{workspaceRoot}/coverage/{projectRoot}"],
      "options": {
        "jestConfig": "packages/<package>/jest.config.ts",
        "passWithNoTests": true
      }
    }
  }
}
```

## Running Tests

### Run all tests
```bash
npm test
# or
nx run-many -t test
```

### Run specific package tests
```bash
nx test core
nx test plugins
nx test cli
nx test examples
```

### Run with watch mode
```bash
nx test core --watch
```

### Run specific test files
```bash
nx test core index.spec.ts
# or
nx test core --testFile index.spec.ts
```

### Update snapshots
```bash
nx test core -u
```

### Code Coverage
```bash
nx test core --coverage
```

Coverage reports are generated in `coverage/<project-name>/` directory.

## CI Performance

For optimal CI performance, use:

```bash
nx affected -t test --parallel=[# CPUs] -- --runInBand
```

The `--runInBand` flag tells Jest to run in a single process, preventing too many worker processes when running multiple projects in parallel.

## Test Structure

### Unit Tests
- **Location**: `packages/<package>/src/**/*.spec.ts`
- **Purpose**: Test individual functions/classes in isolation
- **Mocks**: External dependencies are mocked

### E2E Tests
- **Location**: `packages/examples/src/e2e/**/*.spec.ts`
- **Purpose**: Test complete workflows end-to-end
- **Mocks**: Minimal mocking, uses real implementations

## Package-Specific Configurations

### Core Package
- **Config**: `packages/core/jest.config.ts`
- **Tests**: `packages/core/src/index.spec.ts`
- **Mocks**: glob, chalk, exporter, ts-morph, fs, child_process

### Plugins Package
- **Config**: `packages/plugins/jest.config.ts`
- **Tests**: `packages/plugins/src/sample-plugin.spec.ts`
- **Mocks**: None (pure functions)

### CLI Package
- **Config**: `packages/cli/jest.config.ts`
- **Tests**: `packages/cli/src/index.spec.ts`
- **Mocks**: commander, chalk, ora, fs-extra, @stile/core

### Examples Package
- **Config**: `packages/examples/jest.config.ts`
- **Tests**: `packages/examples/src/e2e/cli.e2e.spec.ts`
- **Example Project**: `packages/examples/src/example-project/`

## Best Practices

1. **Follow Nx Patterns**: Use `@nx/jest:jest` executor and extend root preset
2. **Isolate Tests**: Each package tests independently with mocks
3. **Mock External Dependencies**: File system, network, CLI frameworks
4. **Test Behavior**: Focus on what code does, not implementation
5. **Use Descriptive Names**: Test names should clearly describe behavior
6. **Clean Up**: Use `beforeEach`/`afterEach` to reset state

## References

- [Nx Jest Introduction](https://nx.dev/docs/technologies/test-tools/jest/introduction)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Nx Jest Plugin](https://nx.dev/packages/jest)

