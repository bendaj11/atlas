module.exports = {
  ...require('../../../jest.config.json'),
  rootDir: '../../..',
  testPathIgnorePatterns: [],
  testMatch: ['<rootDir>/tests/e2e/host-widgets/*.specs.ts'],
  testTimeout: 45000,
};
