import { jest } from '@jest/globals';
import { renderHook } from '@testing-library/react';
import type { HostStatus, OverrideStatus } from '../../../types/app';
import type { useHost as useHostType } from '../HostContext/HostContext';
import type { useOverrides as useOverridesType } from '../OverridesContext/OverridesContext';

const useHost = jest.fn<typeof useHostType>();
const useOverrides = jest.fn<typeof useOverridesType>();

jest.unstable_mockModule('../HostContext/HostContext', () => ({ useHost }));
jest.unstable_mockModule('../OverridesContext/OverridesContext', () => ({
  useOverrides,
}));

const { useActionsDisabled } = await import('./useActionsDisabled');

type HostValue = ReturnType<typeof useHostType>;
type OverridesValue = ReturnType<typeof useOverridesType>;

export class ActionsDisabledDriver {
  private hostStatus: HostStatus = 'LOADED';
  private overrideStatus: OverrideStatus = 'IDLE';
  private disabled: boolean | undefined;

  readonly given = {
    hostStatus: (hostStatus: HostStatus): this => {
      this.hostStatus = hostStatus;

      return this;
    },
    overrideStatus: (overrideStatus: OverrideStatus): this => {
      this.overrideStatus = overrideStatus;

      return this;
    },
  };

  readonly when = {
    rendered: (): this => {
      useHost.mockReturnValue({ status: this.hostStatus } as HostValue);
      useOverrides.mockReturnValue({
        status: this.overrideStatus,
      } as OverridesValue);
      this.disabled = renderHook(() => useActionsDisabled()).result.current;

      return this;
    },
  };

  readonly get = {
    disabled: (): boolean | undefined => this.disabled,
  };
}
