import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import { render } from '@testing-library/react';
import { TableActionCellTestkit } from '@wix/design-system/dist/testkit/testing-library';
import { OVERRIDE_STATUSES } from '../../../../types/override-status';
import type { OverridesValue } from '../../../../hooks/useOverrides/useOverrides';
import type { ArtifactTableRow } from '../../../../types/artifact';
import { anArtifactTableRow } from '../../../../testkit/artifact.testkit';
import { SCOPES } from '../../../../types/columbus-state';
import { useActionsDisabledMock } from '../../../../testkit/mocks/useActionsDisabled';
import { useOverridesMock } from '../../../../testkit/mocks/useOverrides';
import { useNavigateMock } from '../../../../testkit/mocks/react-router-dom';

const { ArtifactOverrideActions } = await import('./ArtifactOverrideActions');

export class ArtifactOverrideActionsDriver {
  private artifact = anArtifactTableRow();
  private actionsDisabled = faker.datatype.boolean();
  private readonly clearOverride = jest.fn<OverridesValue['clearOverride']>();
  private baseElement!: Element;
  private readonly navigate = jest.fn<ReturnType<typeof useNavigateMock>>();

  readonly given = {
    artifact: (artifact: ArtifactTableRow) => {
      this.artifact = artifact;

      return this;
    },
    actionsDisabled: (disabled: boolean) => {
      this.actionsDisabled = disabled;

      return this;
    },
  };

  readonly when = {
    rendered: () => {
      useActionsDisabledMock.mockReturnValue(this.actionsDisabled);
      useOverridesMock.mockReturnValue({
        hasOverrides: faker.datatype.boolean(),
        scope: faker.helpers.arrayElement(SCOPES),
        status: faker.helpers.arrayElement(OVERRIDE_STATUSES),
        message: faker.lorem.sentence(),
        clearAllOverrides: jest.fn<OverridesValue['clearAllOverrides']>(),
        clearOverride: this.clearOverride,
        saveOverride: jest.fn<OverridesValue['saveOverride']>(),
        setScope: jest.fn<OverridesValue['setScope']>(),
        toggleOverride: jest.fn<OverridesValue['toggleOverride']>(),
      });
      useNavigateMock.mockReturnValue(this.navigate);
      this.baseElement = render(
        <ArtifactOverrideActions artifact={this.artifact} />,
      ).baseElement;
    },
    clearClicked: () => this.get.clearAction().click(),
    editClicked: () => this.get.editAction().click(),
  };

  readonly get = {
    actionCell: () =>
      TableActionCellTestkit({
        wrapper: this.baseElement,
        dataHook: 'artifact-override-actions',
      }),
    clearAction: () => this.get.actionCell().getVisibleActionButtonDriver(0),
    editAction: () =>
      this.get
        .actionCell()
        .getVisibleActionButtonDriver(this.artifact.canToggle ? 1 : 0),
    clearOverride: () => this.clearOverride,
    navigate: () => this.navigate,
  };
}
