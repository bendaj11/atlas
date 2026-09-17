import { jest } from '@jest/globals';
import { fileURLToPath } from 'node:url';
import type { useHost as useHostType } from '../../hooks/useHost/useHost';

export const useHostMock: jest.Mock<typeof useHostType> = jest.fn();

jest.unstable_mockModule(
  fileURLToPath(new URL('../../hooks/useHost/useHost', import.meta.url)),
  () => ({ useHost: useHostMock }),
);
