import { jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Artifact } from '../../../../types/app';
import { anArtifact } from '../../../../types/app.testkit';
import type {
  useActionsDisabled as useActionsDisabledType,
  useOverrides as useOverridesType,
} from '../../../providers';

const useActionsDisabled = jest.fn<typeof useActionsDisabledType>();
const useOverrides = jest.fn<typeof useOverridesType>();

jest.unstable_mockModule('../../../providers', () => ({
  useActionsDisabled,
  useOverrides,
}));

const { ArtifactOverrideToggle } = await import('./ArtifactOverrideToggle');

type OverridesValue = ReturnType<typeof useOverridesType>;

export class ArtifactOverrideToggleDriver {
  private artifact: Artifact = anArtifact({ canToggle: true });
  private actionsDisabled = false;
  private readonly toggleOverride = jest.fn<OverridesValue['toggleOverride']>();

  readonly given = {
    artifact: (artifact: Artifact): this => {
      this.artifact = artifact;

      return this;
    },
    actionsDisabled: (disabled: boolean): this => {
      this.actionsDisabled = disabled;

      return this;
    },
  };

  readonly when = {
    rendered: (): this => {
      useActionsDisabled.mockReturnValue(this.actionsDisabled);
      useOverrides.mockReturnValue({
        toggleOverride: this.toggleOverride,
      } as Partial<OverridesValue> as OverridesValue);
      render(<ArtifactOverrideToggle artifact={this.artifact} />);

      return this;
    },
    toggled: async (): Promise<this> => {
      await userEvent.click(this.get.toggle());

      return this;
    },
  };

  readonly get = {
    toggle: (): HTMLInputElement => screen.getByRole('checkbox'),
    toggleName: (): string | null =>
      screen.getByRole('checkbox').getAttribute('aria-label'),
    toggledArtifactKey: (): string | undefined =>
      this.toggleOverride.mock.calls[0]?.[0],
  };
}
