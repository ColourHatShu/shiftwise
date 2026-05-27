module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/src/tests/**/*.test.js'],
  // pdf-to-img is ESM-only; Jest's CommonJS loader can't parse it.
  // Globally mock the module so any route that requires() it at module-load
  // doesn't crash 6 test suites that have nothing to do with PDF rendering.
  moduleNameMapper: {
    '^pdf-to-img$': '<rootDir>/src/tests/__mocks__/pdf-to-img.js',
  },
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/server.js'
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  }
};
