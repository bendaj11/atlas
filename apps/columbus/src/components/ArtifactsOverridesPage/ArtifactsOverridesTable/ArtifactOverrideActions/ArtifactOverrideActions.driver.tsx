import { jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Artifact } from '../../../../types/app';
import { anArtifact } from '../../../../types/app.testkit';
import type {
  useActionsDisabled as useActionsDisabledType,
  useOverrides as useOverridesType,
} from '../../../providers';

const navigate = jest.fn();
const useActionsDisabled = jest.fn<typeof useActionsDisabledType>();
const useOverrides = jest.fn<typeof useOverridesType>();

jest.unstable_mockModule('react-router-dom', () => ({
  useNavigate: () => navigate,
}));
jest.unstable_mockModule('../../../providers', () => ({
  useActionsDisabled,
  useOverrides,
}));

const { ArtifactOverrideActions } = await import('./ArtifactOverrideActions');

type OverridesValue = ReturnType<typeof useOverridesType>;

export class ArtifactOverrideActionsDriver {
  private artifact: Artifact = anArtifact({ canToggle: true });
  private actionsDisabled = false;
  private readonly clearOverride = jest.fn<OverridesValue['clearOverride']>();

  constructor() {
    navigate.mockClear();
  }

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
    rendered: (): void => {
      useActionsDisabled.mockReturnValue(this.actionsDisabled);
      useOverrides.mockReturnValue({
        clearOverride: this.clearOverride,
      } as Partial<OverridesValue> as OverridesValue);
      render(<ArtifactOverrideActions artifact={this.artifact} />);
    },
    clearClicked: async (): Promise<void> => {
      await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    },
    editClicked: async (): Promise<void> => {
      await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    },
  };

  readonly get = {
    clearButton: (): HTMLElement | null =>
      screen.queryByRole('button', { name: 'Clear' }),
    clearedArtifactKey: (): string | undefined =>
      this.clearOverride.mock.calls[0]?.[0],
    navigation: () => navigate.mock.calls[0],
  };
}
