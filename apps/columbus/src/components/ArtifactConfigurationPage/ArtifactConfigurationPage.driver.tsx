import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import {
  ButtonTestkit,
  HeadingTestkit,
  IconButtonTestkit,
  RadioGroupTestkit,
  TextTestkit,
} from '@wix/design-system/dist/testkit/testing-library';
import type { ArtifactConfiguration } from '../../types/artifact';
import type { Scope } from '../../types/columbus-state';
import type { OverrideStatus } from '../../state/overrides/overrides';
import { anArtifactConfiguration } from '../../types/artifact.testkit';
import type {
  useActionsDisabled as useActionsDisabledType,
  useOverrides as useOverridesType,
} from '../../state';
import type { useArtifactConfiguration as useArtifactConfigurationType } from './hooks/useArtifactConfiguration/useArtifactConfiguration';
import type { useSaveArtifactOverrideMutation as useSaveArtifactOverrideMutationType } from './hooks/useSaveArtifactOverrideMutation/useSaveArtifactOverrideMutation';

const useActionsDisabled = jest.fn<typeof useActionsDisabledType>();
const useOverrides = jest.fn<typeof useOverridesType>();
const useArtifactConfiguration = jest.fn<typeof useArtifactConfigurationType>();
const useSaveArtifactOverrideMutation =
  jest.fn<typeof useSaveArtifactOverrideMutationType>();
const navigate = jest.fn();

jest.unstable_mockModule('react-router-dom', () => ({
  Navigate: () => <div data-testid="navigate" />,
  useNavigate: () => navigate,
}));
jest.unstable_mockModule('../../state', () => ({
  useActionsDisabled,
  useOverrides,
}));
jest.unstable_mockModule(
  './hooks/useArtifactConfiguration/useArtifactConfiguration',
  () => ({ useArtifactConfiguration }),
);
jest.unstable_mockModule(
  './hooks/useSaveArtifactOverrideMutation/useSaveArtifactOverrideMutation',
  () => ({ useSaveArtifactOverrideMutation }),
);

const { ArtifactConfigurationPage } =
  await import('./ArtifactConfigurationPage');

const OVERRIDE_STATUSES: OverrideStatus[] = ['IDLE', 'APPLYING', 'ERROR'];
const SCOPES: Scope[] = ['all', 'tab'];

type OverridesValue = ReturnType<typeof useOverridesType>;
type MutationResult = ReturnType<typeof useSaveArtifactOverrideMutationType>;

export class ArtifactConfigurationPageDriver {
  private configuration: ArtifactConfiguration | undefined =
    anArtifactConfiguration();
  private actionsDisabled = faker.datatype.boolean();
  private mutationPending = faker.datatype.boolean();
  private mutationError = faker.helpers.arrayElement([
    new Error(faker.lorem.sentence()),
    null,
  ]);
  private overrideStatus = faker.helpers.arrayElement(OVERRIDE_STATUSES);
  private overrideMessage = faker.lorem.sentence();
  private scope = faker.helpers.arrayElement(SCOPES);
  private readonly mutate = jest.fn<MutationResult['mutate']>();
  private readonly clearOverride = jest.fn<OverridesValue['clearOverride']>();
  private readonly setScope = jest.fn<OverridesValue['setScope']>();
  private baseElement!: Element;

  constructor() {
    navigate.mockClear();
    this.clearOverride.mockResolvedValue(undefined);
  }

  readonly given = {
    configuration: (configuration: ArtifactConfiguration | undefined): this => {
      this.configuration = configuration;

      return this;
    },
    actionsDisabled: (disabled: boolean): this => {
      this.actionsDisabled = disabled;

      return this;
    },
    mutationPending: (pending: boolean): this => {
      this.mutationPending = pending;

      return this;
    },
    mutationError: (error: Error | null): this => {
      this.mutationError = error;

      return this;
    },
    overrideStatus: (status: OverrideStatus): this => {
      this.overrideStatus = status;

      return this;
    },
    overrideMessage: (message: string): this => {
      this.overrideMessage = message;

      return this;
    },
    scope: (scope: Scope): this => {
      this.scope = scope;

      return this;
    },
  };

  readonly when = {
    rendered: (): void => {
      useArtifactConfiguration.mockReturnValue(this.configuration);
      useOverrides.mockReturnValue({
        clearOverride: this.clearOverride,
        message: this.overrideMessage,
        scope: this.scope,
        setScope: this.setScope,
        status: this.overrideStatus,
      } as Partial<OverridesValue> as OverridesValue);
      useActionsDisabled.mockReturnValue(this.actionsDisabled);
      useSaveArtifactOverrideMutation.mockReturnValue({
        error: this.mutationError,
        isPending: this.mutationPending,
        mutate: this.mutate,
      } as Partial<MutationResult> as MutationResult);
      this.baseElement = render(<ArtifactConfigurationPage />).baseElement;
    },
    saveClicked: async (): Promise<void> => {
      await this.get.saveButton().click();
    },
    cancelClicked: async (): Promise<void> => {
      await this.get.cancelButton().click();
    },
    clearClicked: async (): Promise<void> => {
      await this.get.clearButton().click();
    },
    scopeChosen: async (scope: Scope): Promise<void> => {
      await this.get.radioGroup().selectByValue(scope);
    },
  };

  readonly get = {
    heading: () =>
      HeadingTestkit({
        wrapper: this.baseElement,
        dataHook: 'artifact-configuration-title',
      }),
    error: () =>
      TextTestkit({
        wrapper: this.baseElement,
        dataHook: 'artifact-configuration-error',
      }),
    saveButton: () =>
      ButtonTestkit({
        wrapper: this.baseElement,
        dataHook: 'save-configuration',
      }),
    cancelButton: () =>
      ButtonTestkit({
        wrapper: this.baseElement,
        dataHook: 'cancel-configuration',
      }),
    clearButton: () =>
      IconButtonTestkit({
        wrapper: this.baseElement,
        dataHook: 'clear-override',
      }),
    radioGroup: () =>
      RadioGroupTestkit({
        wrapper: this.baseElement,
        dataHook: 'override-scope',
      }),
    redirected: (): boolean => screen.queryByTestId('navigate') !== null,
    navigate: () => navigate,
    mutate: () => this.mutate,
    clearOverride: () => this.clearOverride,
    setScope: () => this.setScope,
  };
}
