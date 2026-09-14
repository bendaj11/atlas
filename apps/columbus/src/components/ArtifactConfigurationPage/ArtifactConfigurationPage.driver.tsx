import { jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  ArtifactConfiguration,
  EditorDraft,
  Scope,
} from '../../types/app';
import { aManifest } from '../../types/app.testkit';
import type { useArtifactConfiguration as useArtifactConfigurationType } from './useArtifactConfiguration/useArtifactConfiguration';

const useArtifactConfiguration = jest.fn<typeof useArtifactConfigurationType>();

jest.unstable_mockModule('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) => <div>navigate:{to}</div>,
}));
jest.unstable_mockModule(
  './useArtifactConfiguration/useArtifactConfiguration',
  () => ({
    useArtifactConfiguration,
  }),
);

const { ArtifactConfigurationPage } =
  await import('./ArtifactConfigurationPage');

type HookValue = ReturnType<typeof useArtifactConfigurationType>;

export class ArtifactConfigurationPageDriver {
  private configuration: ArtifactConfiguration | undefined = {
    key: 'app:orders',
    hostId: 'host',
    productionManifest: aManifest({ name: 'Orders' }),
    selectedManifest: undefined,
    productionOptions: [],
    prOptions: [],
  };
  private actionsDisabled = false;
  private errorMessage: string | undefined;
  private scope: Scope = 'all';
  private readonly draft: EditorDraft = {
    type: 'custom',
    customUrl: '',
    productionKey: '',
    prKey: '',
  };
  private readonly close = jest.fn<HookValue['close']>();
  private readonly save = jest.fn<HookValue['save']>();
  private readonly clearOverride = jest.fn<HookValue['clearOverride']>();
  private readonly setScope = jest.fn<HookValue['setScope']>();
  private readonly updateDraft = jest.fn<HookValue['updateDraft']>();

  readonly given = {
    configuration: (configuration: ArtifactConfiguration | undefined): this => {
      this.configuration = configuration;

      return this;
    },
    selectedManifest: (
      manifest: ArtifactConfiguration['selectedManifest'],
    ): this => {
      this.configuration = {
        ...this.configuration!,
        selectedManifest: manifest,
      };

      return this;
    },
    actionsDisabled: (disabled: boolean): this => {
      this.actionsDisabled = disabled;

      return this;
    },
    errorMessage: (message: string | undefined): this => {
      this.errorMessage = message;

      return this;
    },
  };

  readonly when = {
    rendered: (): this => {
      useArtifactConfiguration.mockReturnValue({
        scope: this.scope,
        draft: this.draft,
        configuration: this.configuration,
        actionsDisabled: this.actionsDisabled,
        errorMessage: this.errorMessage,
        close: this.close,
        save: this.save,
        setScope: this.setScope,
        updateDraft: this.updateDraft,
        clearOverride: this.clearOverride,
      });
      render(<ArtifactConfigurationPage />);

      return this;
    },
    saveClicked: async (): Promise<this> => {
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));

      return this;
    },
    cancelClicked: async (): Promise<this> => {
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      return this;
    },
    clearClicked: async (): Promise<this> => {
      await userEvent.click(
        screen.getByRole('button', { name: 'Clear override' }),
      );

      return this;
    },
    scopeChosen: async (label: string): Promise<this> => {
      await userEvent.click(screen.getByRole('radio', { name: label }));

      return this;
    },
  };

  readonly get = {
    text: (text: string): HTMLElement | null => screen.queryByText(text),
    alert: (): HTMLElement | null => screen.queryByRole('alert'),
    saveCount: (): number => this.save.mock.calls.length,
    closeCount: (): number => this.close.mock.calls.length,
    clearCount: (): number => this.clearOverride.mock.calls.length,
    chosenScope: (): Scope | undefined => this.setScope.mock.calls[0]?.[0],
  };
}
