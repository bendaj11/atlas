import { jest } from '@jest/globals';
import { fileURLToPath } from 'node:url';
import type { useOverrides as useOverridesType } from '../../hooks/useOverrides/useOverrides';

export const useOverridesMock: jest.Mock<typeof useOverridesType> = jest.fn();

jest.unstable_mockModule(
  fileURLToPath(
    new URL('../../hooks/useOverrides/useOverrides', import.meta.url),
  ),
  () => ({ useOverrides: useOverridesMock }),
);
