import { jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { HostStatus } from '../../state/columbus-state/columbus-state';
import type { OverrideStatus } from '../../state/overrides/overrides';
import type {
  useActionsDisabled as useActionsDisabledType,
  useHost as useHostType,
  useOverrides as useOverridesType,
} from '../../state';

const useActionsDisabled = jest.fn<typeof useActionsDisabledType>();
const useHost = jest.fn<typeof useHostType>();
const useOverrides = jest.fn<typeof useOverridesType>();

jest.unstable_mockModule('../../state', () => ({
  useActionsDisabled,
  useHost,
  useOverrides,
}));
jest.unstable_mockModule(
  './ArtifactsOverridesTable/ArtifactsOverridesTable',
  () => ({
    ArtifactsOverridesTable: () => <div>artifacts table</div>,
  }),
);

const { ArtifactsOverridesPage } = await import('./ArtifactsOverridesPage');

type HostValue = ReturnType<typeof useHostType>;
type OverridesValue = ReturnType<typeof useOverridesType>;

export class ArtifactsOverridesPageDriver {
  private hostStatus: HostStatus = 'LOADED';
  private hostMessage = '';
  private overrideStatus: OverrideStatus = 'IDLE';
  private hasOverrides = false;
  private actionsDisabled = false;
  private readonly loadHost = jest.fn<HostValue['loadHost']>();
  private readonly clearAllOverrides =
    jest.fn<OverridesValue['clearAllOverrides']>();

  readonly given = {
    hostStatus: (status: HostStatus, message = ''): this => {
      this.hostStatus = status;
      this.hostMessage = message;

      return this;
    },
    overrideStatus: (status: OverrideStatus): this => {
      this.overrideStatus = status;

      return this;
    },
    hasOverrides: (hasOverrides: boolean): this => {
      this.hasOverrides = hasOverrides;

      return this;
    },
    actionsDisabled: (disabled: boolean): this => {
      this.actionsDisabled = disabled;

      return this;
    },
  };

  readonly when = {
    rendered: (): void => {
      useHost.mockReturnValue({
        status: this.hostStatus,
        message: this.hostMessage,
        loadHost: this.loadHost,
      } as Partial<HostValue> as HostValue);
      useOverrides.mockReturnValue({
        status: this.overrideStatus,
        hasOverrides: this.hasOverrides,
        clearAllOverrides: this.clearAllOverrides,
      } as Partial<OverridesValue> as OverridesValue);
      useActionsDisabled.mockReturnValue(this.actionsDisabled);
      render(<ArtifactsOverridesPage />);
    },
    clearClicked: async (): Promise<void> => {
      await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    },
    refreshClicked: async (): Promise<void> => {
      await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    },
  };

  readonly get = {
    text: (text: string): HTMLElement | null => screen.queryByText(text),
    clearCount: (): number => this.clearAllOverrides.mock.calls.length,
    loadHostCount: (): number => this.loadHost.mock.calls.length,
  };
}
