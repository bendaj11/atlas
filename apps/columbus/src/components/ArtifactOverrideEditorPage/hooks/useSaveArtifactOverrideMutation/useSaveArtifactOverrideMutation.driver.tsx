import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import { anAppManifest } from '@atlas/testkit';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  renderHook,
  type RenderHookResult,
  waitFor,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  type ArtifactOverrideOptions,
  type OverrideSelection,
  OVERRIDE_TYPES,
} from '../../../../types/artifact';
import type { ArtifactVersion } from '../../../../types/artifact-version';
import { SCOPES } from '../../../../types/columbus-state';
import { OVERRIDE_STATUSES } from '../../../../types/override-status';
import type { OverridesValue } from '../../../../hooks/useOverrides/useOverrides';
import { anArtifactOverrideOptions } from '../../../../testkit/artifact.testkit';
import { useOverridesMock } from '../../../../testkit/mocks/useOverrides';
import { createQueryClient } from '../../../../utils/query-client/query-client';

const { useSaveArtifactOverrideMutation } =
  await import('./useSaveArtifactOverrideMutation');

export class UseSaveArtifactOverrideMutationDriver {
  private overrideOptions: ArtifactOverrideOptions | undefined =
    anArtifactOverrideOptions();
  private hostId: string | undefined = faker.string.uuid();
  private selection: OverrideSelection = {
    type: faker.helpers.arrayElement(OVERRIDE_TYPES),
    value: faker.string.uuid(),
  };
  private hostArtifactVersion: ArtifactVersion | undefined =
    faker.helpers.arrayElement([anAppManifest(), undefined]);
  private readonly saveOverride = jest.fn<OverridesValue['saveOverride']>();
  private hook!: RenderHookResult<
    ReturnType<typeof useSaveArtifactOverrideMutation>,
    undefined
  >;

  constructor() {
    this.saveOverride.mockResolvedValue(undefined);
  }

  readonly given = {
    overrideOptions: (overrideOptions: ArtifactOverrideOptions | undefined) => {
      this.overrideOptions = overrideOptions;

      return this;
    },
    hostId: (hostId: string | undefined) => {
      this.hostId = hostId;

      return this;
    },
    selection: (selection: OverrideSelection) => {
      this.selection = selection;

      return this;
    },
    hostArtifactVersion: (artifactVersion: ArtifactVersion | undefined) => {
      this.hostArtifactVersion = artifactVersion;

      return this;
    },
  };

  readonly when = {
    rendered: () => {
      useOverridesMock.mockReturnValue({
        hasOverrides: faker.datatype.boolean(),
        scope: faker.helpers.arrayElement(SCOPES),
        status: faker.helpers.arrayElement(OVERRIDE_STATUSES),
        message: faker.lorem.sentence(),
        clearAllOverrides: jest.fn<OverridesValue['clearAllOverrides']>(),
        clearOverride: jest.fn<OverridesValue['clearOverride']>(),
        saveOverride: this.saveOverride,
        setScope: jest.fn<OverridesValue['setScope']>(),
        toggleOverride: jest.fn<OverridesValue['toggleOverride']>(),
      });
      const queryClient = createQueryClient();
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );
      this.hook = renderHook(
        () =>
          useSaveArtifactOverrideMutation({
            overrideOptions: this.overrideOptions,
            hostId: this.hostId,
            selection: this.selection,
            hostArtifactVersion: this.hostArtifactVersion,
          }),
        { wrapper },
      );
    },
    mutated: async () => {
      await act(() =>
        this.get
          .result()
          .mutateAsync()
          .catch(() => undefined),
      );
      await waitFor(() => expect(this.get.result().isPending).toBe(false));
    },
  };

  readonly get = {
    result: () => this.hook.result.current,
    saveOverride: () => this.saveOverride,
  };
}
