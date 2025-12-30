export default {
  displayName: 'cli',
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
  coverageDirectory: '../../coverage/cli',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
    '!src/index.ts',
  ],
  moduleNameMapper: {
    '^@stile/core$': '<rootDir>/../core/src/index.ts',
    '^@stile/types$': '<rootDir>/../types/src/index.ts',
  },
  testMatch: ['**/+(*.)+(spec|test).+(ts|js)?(x)'],
};

