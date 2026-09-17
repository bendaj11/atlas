import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import { render } from '@testing-library/react';
import {
  ButtonTestkit,
  EmptyStateTestkit,
  LoaderTestkit,
  TextButtonTestkit,
} from '@wix/design-system/dist/testkit/testing-library';
import type { HostStatus } from '../../types/host-status';
import { OVERRIDE_STATUSES } from '../../types/override-status';
import type { useHost as useHostType } from '../../hooks/useHost/useHost';
import type { OverridesValue } from '../../hooks/useOverrides/useOverrides';
import { SCOPES } from '../../types/columbus-state';
import { useActionsDisabledMock } from '../../testkit/mocks/useActionsDisabled';
import { useHostMock } from '../../testkit/mocks/useHost';
import { useOverridesMock } from '../../testkit/mocks/useOverrides';

const ArtifactsListTable = jest.fn(() => null);
jest.unstable_mockModule('./ArtifactsListTable/ArtifactsListTable', () => ({
  ArtifactsListTable,
}));

const { ArtifactsListPage } = await import('./ArtifactsListPage');

export class ArtifactsListPageDriver {
  private hostStatus = faker.helpers.arrayElement<HostStatus>([
    'LOADING',
    'ERROR',
    'LOADED',
  ]);
  private hostMessage = faker.lorem.sentence();
  private hasOverrides = faker.datatype.boolean();
  private actionsDisabled = faker.datatype.boolean();
  private readonly loadHost =
    jest.fn<ReturnType<typeof useHostType>['loadHost']>();
  private readonly clearAllOverrides =
    jest.fn<OverridesValue['clearAllOverrides']>();
  private baseElement!: Element;

  constructor() {
    ArtifactsListTable.mockClear();
  }

  readonly given = {
    hostStatus: (status: HostStatus) => {
      this.hostStatus = status;

      return this;
    },
    hostMessage: (message: string) => {
      this.hostMessage = message;

      return this;
    },
    hasOverrides: (hasOverrides: boolean) => {
      this.hasOverrides = hasOverrides;

      return this;
    },
    actionsDisabled: (disabled: boolean) => {
      this.actionsDisabled = disabled;

      return this;
    },
  };

  readonly when = {
    rendered: () => {
      useHostMock.mockReturnValue({
        hostData: undefined,
        status: this.hostStatus,
        message: this.hostMessage,
        loadHost: this.loadHost,
      });
      useOverridesMock.mockReturnValue({
        hasOverrides: this.hasOverrides,
        scope: faker.helpers.arrayElement(SCOPES),
        status: faker.helpers.arrayElement(OVERRIDE_STATUSES),
        message: faker.lorem.sentence(),
        clearAllOverrides: this.clearAllOverrides,
        clearOverride: jest.fn<OverridesValue['clearOverride']>(),
        saveOverride: jest.fn<OverridesValue['saveOverride']>(),
        setScope: jest.fn<OverridesValue['setScope']>(),
        toggleOverride: jest.fn<OverridesValue['toggleOverride']>(),
      });
      useActionsDisabledMock.mockReturnValue(this.actionsDisabled);
      this.baseElement = render(<ArtifactsListPage />).baseElement;
    },
    clearClicked: () => this.get.clearButton().click(),
    refreshClicked: () => this.get.refreshButton().click(),
  };

  readonly get = {
    loader: () =>
      LoaderTestkit({ wrapper: this.baseElement, dataHook: 'host-loader' }),
    emptyState: () =>
      EmptyStateTestkit({
        wrapper: this.baseElement,
        dataHook: 'empty-host-data',
      }),
    clearButton: () =>
      ButtonTestkit({
        wrapper: this.baseElement,
        dataHook: 'clear-all-overrides',
      }),
    refreshButton: () =>
      TextButtonTestkit({
        wrapper: this.baseElement,
        dataHook: 'refresh-host-data',
      }),
    artifactsListTableMock: () => ArtifactsListTable,
    loadHost: () => this.loadHost,
    clearAllOverrides: () => this.clearAllOverrides,
  };
}
