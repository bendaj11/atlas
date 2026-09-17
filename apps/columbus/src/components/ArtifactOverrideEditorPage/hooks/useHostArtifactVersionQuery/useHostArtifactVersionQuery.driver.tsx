import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import { QueryClientProvider } from '@tanstack/react-query';
import {
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
import type { ColumbusState } from '../../../../types/columbus-state';
import type { ArtifactVersion } from '../../../../types/artifact-version';
import { anArtifactOverrideOptions } from '../../../../testkit/artifact.testkit';
import { aColumbusState } from '../../../../testkit/columbus-state.testkit';
import { createQueryClient } from '../../../../utils/query-client/query-client';
import { loadArtifactVersionFromHostTabMock } from '../../../../testkit/mocks/host-tabs';
import { useColumbusStateMock } from '../../../../testkit/mocks/useColumbusState';

const { useHostArtifactVersionQuery } =
  await import('./useHostArtifactVersionQuery');

export class UseHostArtifactVersionQueryDriver {
  private columbusState: ColumbusState | undefined = aColumbusState();
  private overrideOptions: ArtifactOverrideOptions | undefined =
    anArtifactOverrideOptions();
  private selection: OverrideSelection = {
    type: faker.helpers.arrayElement(OVERRIDE_TYPES),
    value: faker.string.uuid(),
  };
  private hook!: RenderHookResult<
    ReturnType<typeof useHostArtifactVersionQuery>,
    undefined
  >;

  constructor() {
    loadArtifactVersionFromHostTabMock.mockReset();
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
    selection: (selection: OverrideSelection) => {
      this.selection = selection;

      return this;
    },
    loadedArtifactVersion: (artifactVersion: ArtifactVersion) => {
      loadArtifactVersionFromHostTabMock.mockResolvedValue(artifactVersion);

      return this;
    },
    artifactVersionLoadFailure: (reason: string) => {
      loadArtifactVersionFromHostTabMock.mockRejectedValue(new Error(reason));

      return this;
    },
  };

  readonly when = {
    rendered: async () => {
      useColumbusStateMock.mockReturnValue({
        columbusState: this.columbusState,
        setColumbusState: jest.fn(),
      });
      const queryClient = createQueryClient();
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );
      this.hook = renderHook(
        () =>
          useHostArtifactVersionQuery({
            overrideOptions: this.overrideOptions,
            selection: this.selection,
          }),
        { wrapper },
      );
      await waitFor(() =>
        expect(this.hook.result.current.isFetching).toBe(false),
      );
    },
  };

  readonly get = {
    result: () => this.hook.result.current,
    loadArtifactVersionFromHostTab: () => loadArtifactVersionFromHostTabMock,
  };
}
