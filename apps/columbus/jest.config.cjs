const baseConfig = require('../../jest.config.json');

module.exports = {
  ...baseConfig,
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  moduleNameMapper: {
    ...baseConfig.moduleNameMapper,
    '\\.css$': '<rootDir>/apps/columbus/src/testkit/environment/css-stub.ts',
  },
  rootDir: '../..',
  setupFiles: [
    '<rootDir>/apps/columbus/src/testkit/environment/ColumbusTestEnvironment.ts',
  ],
  testEnvironment: 'jsdom',
  testMatch: ['**/*.specs.ts', '**/*.specs.tsx'],
  testTimeout: 15_000,
};
