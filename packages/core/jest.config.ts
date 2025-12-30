/**
 * Jest configuration for @stile/core
 * 
 * @see https://nx.dev/docs/technologies/test-tools/jest/introduction
 */
export default {
  displayName: 'core',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/core',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
    '!src/index.ts',
  ],
  moduleNameMapper: {
    '^@stile/types$': '<rootDir>/../types/src/index.ts',
    '^@stile/exporter$': '<rootDir>/../exporter/src/index.ts',
  },
  testMatch: ['**/+(*.)+(spec|test).+(ts|js)?(x)'],
};

