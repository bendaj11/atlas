const baseConfig = require('../../jest.config.json');

module.exports = {
  ...baseConfig,
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  rootDir: '../..',
  setupFiles: [
    '<rootDir>/apps/columbus/src/scripts/build/ColumbusTestEnvironment.ts',
  ],
  testMatch: ['**/*.specs.ts', '**/*.specs.tsx'],
};
