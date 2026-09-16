import { jest } from '@jest/globals';
import { render, screen, type RenderResult } from '@testing-library/react';
import {
  HeadingTestkit,
  RadioGroupTestkit,
  TextTestkit,
} from '@wix/design-system/dist/testkit/testing-library';
import userEvent from '@testing-library/user-event';
import type {
  ArtifactConfiguration,
  ArtifactVersion,
  Scope,
} from '../../types/app';
import { anArtifactConfiguration } from '../../types/app.testkit';
import type {
  useActionsDisabled as useActionsDisabledType,
  useOverrides as useOverridesType,
} from '../providers/index';
import type { useArtifactConfiguration as useArtifactConfigurationType } from './useArtifactConfiguration/useArtifactConfiguration';
import type { useSaveArtifactOverride as useSaveArtifactOverrideType } from './useSaveArtifactOverride/useSaveArtifactOverride';

const useActionsDisabled = jest.fn<typeof useActionsDisabledType>();
const useOverrides = jest.fn<typeof useOverridesType>();
const useArtifactConfiguration = jest.fn<typeof useArtifactConfigurationType>();
const useSaveArtifactOverride = jest.fn<typeof useSaveArtifactOverrideType>();

const navigate = jest.fn();

jest.unstable_mockModule('react-router-dom', () => ({
  Navigate: () => <div data-testid="navigate" />,
  useNavigate: () => navigate,
}));
jest.unstable_mockModule('../providers', () => ({
  useActionsDisabled,
  useOverrides,
}));
jest.unstable_mockModule(
  './useArtifactConfiguration/useArtifactConfiguration',
  () => ({ useArtifactConfiguration }),
);
jest.unstable_mockModule(
  './useSaveArtifactOverride/useSaveArtifactOverride',
  () => ({ useSaveArtifactOverride }),
);

const { ArtifactConfigurationPage } =
  await import('./ArtifactConfigurationPage');

type OverridesValue = ReturnType<typeof useOverridesType>;
type SaveValue = ReturnType<typeof useSaveArtifactOverrideType>;

export class ArtifactConfigurationPageDriver {
  private configuration: ArtifactConfiguration | undefined =
    anArtifactConfiguration({ productionArtifactVersions: [] });
  private actionsDisabled = false;
  private loading = false;
  private errorMessage: string | undefined;
  private scope: Scope = 'all';
  private readonly save = jest.fn<SaveValue['save']>();
  private readonly clearOverride = jest.fn<SaveValue['clearOverride']>();
  private readonly setScope = jest.fn<OverridesValue['setScope']>();
  private view: RenderResult | undefined;

  constructor() {
    navigate.mockClear();
  }

  readonly given = {
    configuration: (configuration: ArtifactConfiguration | undefined): this => {
      this.configuration = configuration;

      return this;
    },
    productionArtifactVersion: (manifest: ArtifactVersion): this => {
      this.configuration = {
        ...this.configuration!,
        productionArtifactVersion: manifest,
      };

      return this;
    },
    selectedArtifactVersion: (
      manifest: ArtifactConfiguration['selectedArtifactVersion'],
    ): this => {
      this.configuration = {
        ...this.configuration!,
        selectedArtifactVersion: manifest,
      };

      return this;
    },
    actionsDisabled: (disabled: boolean): this => {
      this.actionsDisabled = disabled;

      return this;
    },
    loading: (loading: boolean): this => {
      this.loading = loading;

      return this;
    },
    scope: (scope: Scope): this => {
      this.scope = scope;

      return this;
    },
    errorMessage: (message: string | undefined): this => {
      this.errorMessage = message;

      return this;
    },
  };

  readonly when = {
    rendered: (): void => {
      useArtifactConfiguration.mockReturnValue(this.configuration);
      useOverrides.mockReturnValue({
        scope: this.scope,
        setScope: this.setScope,
      } as Partial<OverridesValue> as OverridesValue);
      useActionsDisabled.mockReturnValue(this.actionsDisabled);
      useSaveArtifactOverride.mockReturnValue({
        clearOverride: this.clearOverride,
        errorMessage: this.errorMessage,
        loading: this.loading,
        save: this.save,
      });
      this.view = render(<ArtifactConfigurationPage />);
    },
    saveClicked: async (): Promise<void> => {
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    },
    cancelClicked: async (): Promise<void> => {
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    },
    clearClicked: async (): Promise<void> => {
      await userEvent.click(
        screen.getByRole('button', { name: 'Clear override' }),
      );
    },
    scopeChosen: async (scope: Scope): Promise<void> => {
      await RadioGroupTestkit({
        wrapper: this.get.container(),
        dataHook: 'override-scope',
      }).selectByValue(scope);
    },
  };

  readonly get = {
    title: () =>
      HeadingTestkit({
        wrapper: this.get.container(),
        dataHook: 'artifact-configuration-title',
      }),
    redirected: (): boolean => screen.queryByTestId('navigate') !== null,
    error: () =>
      TextTestkit({
        wrapper: this.get.container(),
        dataHook: 'artifact-configuration-error',
      }),
    saveCount: (): number => this.save.mock.calls.length,
    navigatedTo: (): unknown => navigate.mock.calls[0]?.[0],
    clearCount: (): number => this.clearOverride.mock.calls.length,
    chosenScope: (): Scope | undefined => this.setScope.mock.calls[0]?.[0],
    container: (): HTMLElement => {
      if (!this.view) throw new Error('Page was not rendered.');

      return this.view.container;
    },
  };
}
