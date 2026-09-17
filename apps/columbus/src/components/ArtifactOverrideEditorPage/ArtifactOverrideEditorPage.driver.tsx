import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import { notifyManager, QueryClientProvider } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react';
import {
  ButtonTestkit,
  HeadingTestkit,
  IconButtonTestkit,
  RadioGroupTestkit,
  TextTestkit,
} from '@wix/design-system/dist/testkit/testing-library';
import type { ArtifactOverrideOptions } from '../../types/artifact';
import type { ArtifactVersion } from '../../types/artifact-version';
import {
  type ColumbusState,
  SCOPES,
  type Scope,
} from '../../types/columbus-state';
import {
  OVERRIDE_STATUSES,
  type OverrideStatus,
} from '../../types/override-status';
import type { OverridesValue } from '../../hooks/useOverrides/useOverrides';
import { anAppManifest } from '@atlas/testkit';
import { anArtifactOverrideOptions } from '../../testkit/artifact.testkit';
import { aColumbusState } from '../../testkit/columbus-state.testkit';
import type { useArtifactOverrideOptions as useArtifactOverrideOptionsType } from './hooks/useArtifactOverrideOptions/useArtifactOverrideOptions';
import { createQueryClient } from '../../utils/query-client/query-client';
import { loadArtifactVersionFromHostTabMock } from '../../testkit/mocks/host-tabs';
import { useActionsDisabledMock } from '../../testkit/mocks/useActionsDisabled';
import { useColumbusStateMock } from '../../testkit/mocks/useColumbusState';
import { useOverridesMock } from '../../testkit/mocks/useOverrides';
import {
  NavigateMock,
  useNavigateMock,
} from '../../testkit/mocks/react-router-dom';

const useArtifactOverrideOptions =
  jest.fn<typeof useArtifactOverrideOptionsType>();

jest.unstable_mockModule(
  './hooks/useArtifactOverrideOptions/useArtifactOverrideOptions',
  () => ({ useArtifactOverrideOptions }),
);

const { ArtifactOverrideEditorPage } =
  await import('./ArtifactOverrideEditorPage');

notifyManager.setScheduler((callback) => callback());

export class ArtifactOverrideEditorPageDriver {
  private readonly queryClient = createQueryClient();
  private columbusState: ColumbusState | undefined = aColumbusState();
  private overrideOptions: ArtifactOverrideOptions | undefined =
    anArtifactOverrideOptions();
  private actionsDisabled = faker.datatype.boolean();
  private overrideStatus = faker.helpers.arrayElement(OVERRIDE_STATUSES);
  private overrideMessage = faker.lorem.sentence();
  private scope = faker.helpers.arrayElement(SCOPES);
  private readonly saveOverride = jest.fn<OverridesValue['saveOverride']>();
  private readonly clearOverride = jest.fn<OverridesValue['clearOverride']>();
  private readonly setScope = jest.fn<OverridesValue['setScope']>();
  private baseElement!: Element;
  private readonly navigate = jest.fn<ReturnType<typeof useNavigateMock>>();

  constructor() {
    NavigateMock.mockClear();
    loadArtifactVersionFromHostTabMock.mockReset();
    loadArtifactVersionFromHostTabMock.mockResolvedValue(anAppManifest());
    this.saveOverride.mockResolvedValue(undefined);
    this.clearOverride.mockResolvedValue(undefined);
  }

  readonly given = {
    columbusState: (columbusState: ColumbusState | undefined) => {
      this.columbusState = columbusState;

      return this;
    },
    overrideOptions: (overrideOptions: ArtifactOverrideOptions | undefined) => {
      this.overrideOptions = overrideOptions;

      return this;
    },
    actionsDisabled: (disabled: boolean) => {
      this.actionsDisabled = disabled;

      return this;
    },
    hostArtifactVersion: (artifactVersion: ArtifactVersion) => {
      loadArtifactVersionFromHostTabMock.mockResolvedValue(artifactVersion);

      return this;
    },
    hostArtifactVersionLoadFailure: (reason: string) => {
      loadArtifactVersionFromHostTabMock.mockRejectedValue(new Error(reason));

      return this;
    },
    saveOverridePending: () => {
      this.saveOverride.mockReturnValue(new Promise(() => undefined));

      return this;
    },
    saveOverrideFailure: (reason: string) => {
      this.saveOverride.mockRejectedValue(new Error(reason));

      return this;
    },
    overrideStatus: (status: OverrideStatus) => {
      this.overrideStatus = status;

      return this;
    },
    overrideMessage: (message: string) => {
      this.overrideMessage = message;

      return this;
    },
    scope: (scope: Scope) => {
      this.scope = scope;

      return this;
    },
  };

  readonly when = {
    rendered: async () => {
      useArtifactOverrideOptions.mockReturnValue(this.overrideOptions);
      useOverridesMock.mockReturnValue({
        hasOverrides: faker.datatype.boolean(),
        scope: this.scope,
        status: this.overrideStatus,
        message: this.overrideMessage,
        clearAllOverrides: jest.fn<OverridesValue['clearAllOverrides']>(),
        clearOverride: this.clearOverride,
        saveOverride: this.saveOverride,
        setScope: this.setScope,
        toggleOverride: jest.fn<OverridesValue['toggleOverride']>(),
      });
      useActionsDisabledMock.mockReturnValue(this.actionsDisabled);
      useColumbusStateMock.mockReturnValue({
        columbusState: this.columbusState,
        setColumbusState: jest.fn(),
      });
      useNavigateMock.mockReturnValue(this.navigate);
      this.baseElement = render(
        <QueryClientProvider client={this.queryClient}>
          <ArtifactOverrideEditorPage />
        </QueryClientProvider>,
      ).baseElement;
      await waitFor(() => expect(this.queryClient.isFetching()).toBe(0));
    },
    saveClicked: async () => {
      await this.get.saveButton().click();
      await act(async () => undefined);
    },
    cancelClicked: () => this.get.cancelButton().click(),
    clearClicked: () => this.get.clearButton().click(),
    scopeChosen: (scope: Scope) => this.get.radioGroup().selectByValue(scope),
  };

  readonly get = {
    heading: () =>
      HeadingTestkit({
        wrapper: this.baseElement,
        dataHook: 'artifact-override-title',
      }),
    error: () =>
      TextTestkit({
        wrapper: this.baseElement,
        dataHook: 'artifact-override-error',
      }),
    saveButton: () =>
      ButtonTestkit({
        wrapper: this.baseElement,
        dataHook: 'save-overrideOptions',
      }),
    cancelButton: () =>
      ButtonTestkit({
        wrapper: this.baseElement,
        dataHook: 'cancel-overrideOptions',
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
    navigate: () => this.navigate,
    navigateMock: () => NavigateMock,
    loadArtifactVersionFromHostTab: () => loadArtifactVersionFromHostTabMock,
    saveOverride: () => this.saveOverride,
    clearOverride: () => this.clearOverride,
    setScope: () => this.setScope,
  };
}
