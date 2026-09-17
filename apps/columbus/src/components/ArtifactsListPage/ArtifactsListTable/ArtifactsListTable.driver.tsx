import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import { render } from '@testing-library/react';
import {
  IconButtonTestkit,
  SearchTestkit,
  TableTestkit,
  TextTestkit,
  ToggleSwitchTestkit,
} from '@wix/design-system/dist/testkit/testing-library';
import { OVERRIDE_STATUSES } from '../../../types/override-status';
import type { OverridesValue } from '../../../hooks/useOverrides/useOverrides';
import type { ArtifactTableRow } from '../../../types/artifact';
import { SCOPES } from '../../../types/columbus-state';
import type { useArtifacts as useArtifactsType } from '../useArtifacts/useArtifacts';
import { useActionsDisabledMock } from '../../../testkit/mocks/useActionsDisabled';
import { useOverridesMock } from '../../../testkit/mocks/useOverrides';
import { useNavigateMock } from '../../../testkit/mocks/react-router-dom';

const useArtifacts = jest.fn<typeof useArtifactsType>();
jest.unstable_mockModule('../useArtifacts/useArtifacts', () => ({
  useArtifacts,
}));

const { ArtifactsListTable } = await import('./ArtifactsListTable');

type ArtifactsValue = ReturnType<typeof useArtifactsType>;

export class ArtifactsListTableDriver {
  private artifacts: ArtifactTableRow[] = [];
  private totalCount = faker.number.int({ min: 0, max: 100 });
  private visibleOnly = faker.datatype.boolean();
  private readonly setSearchValue = jest.fn<ArtifactsValue['setSearchValue']>();
  private readonly setVisibleOnly = jest.fn<ArtifactsValue['setVisibleOnly']>();
  private baseElement!: Element;

  readonly given = {
    artifacts: (artifacts: ArtifactTableRow[]) => {
      this.artifacts = artifacts;

      return this;
    },
    totalCount: (totalCount: number) => {
      this.totalCount = totalCount;

      return this;
    },
    visibleOnly: (visibleOnly: boolean) => {
      this.visibleOnly = visibleOnly;

      return this;
    },
  };

  readonly when = {
    rendered: () => {
      useArtifacts.mockReturnValue({
        artifacts: this.artifacts,
        totalCount: this.totalCount,
        searchValue: faker.lorem.word(),
        setSearchValue: this.setSearchValue,
        visibleOnly: this.visibleOnly,
        setVisibleOnly: this.setVisibleOnly,
      });
      useActionsDisabledMock.mockReturnValue(faker.datatype.boolean());
      useOverridesMock.mockReturnValue({
        hasOverrides: faker.datatype.boolean(),
        scope: faker.helpers.arrayElement(SCOPES),
        status: faker.helpers.arrayElement(OVERRIDE_STATUSES),
        message: faker.lorem.sentence(),
        clearAllOverrides: jest.fn<OverridesValue['clearAllOverrides']>(),
        clearOverride: jest.fn<OverridesValue['clearOverride']>(),
        saveOverride: jest.fn<OverridesValue['saveOverride']>(),
        setScope: jest.fn<OverridesValue['setScope']>(),
        toggleOverride: jest.fn<OverridesValue['toggleOverride']>(),
      });
      useNavigateMock.mockReturnValue(jest.fn());
      this.baseElement = render(<ArtifactsListTable />).baseElement;
    },
    searchTextEntered: (text: string) =>
      this.get.search().inputDriver.enterText(text),
    visibleFilterClicked: () => this.get.visibleFilterButton().click(),
  };

  readonly get = {
    table: () =>
      TableTestkit({ wrapper: this.baseElement, dataHook: 'artifacts-table' }),
    toggleSwitch: () =>
      ToggleSwitchTestkit({
        wrapper: this.baseElement,
        dataHook: 'artifact-override-toggle',
      }),
    search: () =>
      SearchTestkit({
        wrapper: this.baseElement,
        dataHook: 'artifacts-search',
      }),
    visibleFilterButton: () =>
      IconButtonTestkit({
        wrapper: this.baseElement,
        dataHook: 'visible-artifacts-filter',
      }),
    countLabel: () =>
      TextTestkit({ wrapper: this.baseElement, dataHook: 'artifacts-count' }),
    setSearchValue: () => this.setSearchValue,
    setVisibleOnly: () => this.setVisibleOnly,
  };
}
