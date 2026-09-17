import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import { render } from '@testing-library/react';
import { ToggleSwitchTestkit } from '@wix/design-system/dist/testkit/testing-library';
import { OVERRIDE_STATUSES } from '../../../../types/override-status';
import type { OverridesValue } from '../../../../hooks/useOverrides/useOverrides';
import type { ArtifactTableRow } from '../../../../types/artifact';
import { anArtifactTableRow } from '../../../../testkit/artifact.testkit';
import { SCOPES } from '../../../../types/columbus-state';
import { useActionsDisabledMock } from '../../../../testkit/mocks/useActionsDisabled';
import { useOverridesMock } from '../../../../testkit/mocks/useOverrides';

const { ArtifactOverrideToggle } = await import('./ArtifactOverrideToggle');

export class ArtifactOverrideToggleDriver {
  private artifact = anArtifactTableRow();
  private actionsDisabled = faker.datatype.boolean();
  private readonly toggleOverride = jest.fn<OverridesValue['toggleOverride']>();
  private baseElement!: Element;

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
        clearOverride: jest.fn<OverridesValue['clearOverride']>(),
        saveOverride: jest.fn<OverridesValue['saveOverride']>(),
        setScope: jest.fn<OverridesValue['setScope']>(),
        toggleOverride: this.toggleOverride,
      });
      this.baseElement = render(
        <ArtifactOverrideToggle artifact={this.artifact} />,
      ).baseElement;
    },
    toggled: () => this.get.toggleSwitch().click(),
  };

  readonly get = {
    toggleSwitch: () =>
      ToggleSwitchTestkit({
        wrapper: this.baseElement,
        dataHook: 'artifact-override-toggle',
      }),
    toggleOverride: () => this.toggleOverride,
  };
}
