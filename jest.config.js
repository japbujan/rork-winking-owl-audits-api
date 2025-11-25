module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/functions'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'functions/**/*.ts',
    '!functions/**/*.test.ts',
    '!functions/**/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
};

