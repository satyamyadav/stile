export default {
  displayName: 'plugins',
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
  coverageDirectory: '../../coverage/plugins',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
    '!src/index.ts',
  ],
  moduleNameMapper: {
    '^@stile/types$': '<rootDir>/../types/src/index.ts',
  },
  testMatch: ['**/+(*.)+(spec|test).+(ts|js)?(x)'],
};

