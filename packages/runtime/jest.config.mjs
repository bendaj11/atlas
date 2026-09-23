import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const workspaceConfig = require('../../jest.config.json');

export default {
  ...workspaceConfig,
  rootDir: fileURLToPath(new URL('../..', import.meta.url)),
  roots: ['<rootDir>/packages/runtime/src'],
  collectCoverageFrom: [
    'packages/runtime/src/**/*.{ts,tsx}',
    '!packages/runtime/src/**/*.{driver,testkit,types}.{ts,tsx}',
    '!packages/runtime/src/**/index.ts',
  ],
  coverageReporters: ['text-summary'],
  coverageThreshold: {
    global: {
      statements: 85,
      branches: 72,
      functions: 84,
      lines: 87,
    },
  },
};
