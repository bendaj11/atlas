import { jest } from '@jest/globals';
import { faker } from '@faker-js/faker';
import { renderHook, type RenderHookResult } from '@testing-library/react';
import { SCOPES } from '../../types/columbus-state';
import { HOST_STATUSES, type HostStatus } from '../../types/host-status';
import {
  OVERRIDE_STATUSES,
  type OverrideStatus,
} from '../../types/override-status';
import { useHostMock } from '../../testkit/mocks/useHost';
import { useOverridesMock } from '../../testkit/mocks/useOverrides';

const { useActionsDisabled } = await import('./useActionsDisabled');

type HostValue = ReturnType<typeof useHostMock>;
type OverridesValue = ReturnType<typeof useOverridesMock>;

export class ActionsDisabledDriver {
  private hostStatus = faker.helpers.arrayElement(HOST_STATUSES);
  private overrideStatus = faker.helpers.arrayElement(OVERRIDE_STATUSES);
  private hook!: RenderHookResult<
    ReturnType<typeof useActionsDisabled>,
    undefined
  >;

  readonly given = {
    hostStatus: (hostStatus: HostStatus) => {
      this.hostStatus = hostStatus;

      return this;
    },
    overrideStatus: (overrideStatus: OverrideStatus) => {
      this.overrideStatus = overrideStatus;

      return this;
    },
  };

  readonly when = {
    rendered: () => {
      useHostMock.mockReturnValue({
        hostData: undefined,
        status: this.hostStatus,
        message: '',
        loadHost: jest.fn<HostValue['loadHost']>(),
      });
      useOverridesMock.mockReturnValue({
        hasOverrides: faker.datatype.boolean(),
        scope: faker.helpers.arrayElement(SCOPES),
        status: this.overrideStatus,
        message: '',
        clearAllOverrides: jest.fn<OverridesValue['clearAllOverrides']>(),
        clearOverride: jest.fn<OverridesValue['clearOverride']>(),
        saveOverride: jest.fn<OverridesValue['saveOverride']>(),
        setScope: jest.fn<OverridesValue['setScope']>(),
        toggleOverride: jest.fn<OverridesValue['toggleOverride']>(),
      });
      this.hook = renderHook(() => useActionsDisabled());
    },
  };

  readonly get = {
    result: () => this.hook.result.current,
  };
}
