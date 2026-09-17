import { jest } from '@jest/globals';
import { fileURLToPath } from 'node:url';
import type { useActionsDisabled as useActionsDisabledType } from '../../hooks/useActionsDisabled/useActionsDisabled';

export const useActionsDisabledMock: jest.Mock<typeof useActionsDisabledType> =
  jest.fn();

jest.unstable_mockModule(
  fileURLToPath(
    new URL(
      '../../hooks/useActionsDisabled/useActionsDisabled',
      import.meta.url,
    ),
  ),
  () => ({ useActionsDisabled: useActionsDisabledMock }),
);
