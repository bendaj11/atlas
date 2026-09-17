import { jest } from '@jest/globals';
import { renderHook, type RenderHookResult } from '@testing-library/react';
import type { ArtifactTableRow } from '../../../../types/artifact';
import type { ColumbusState } from '../../../../types/columbus-state';
import { anArtifactTableRow } from '../../../../testkit/artifact.testkit';
import { aColumbusState } from '../../../../testkit/columbus-state.testkit';
import { useColumbusStateMock } from '../../../../testkit/mocks/useColumbusState';
import {
  aLocation,
  useLocationMock,
} from '../../../../testkit/mocks/react-router-dom';

const { useArtifactOverrideOptions } =
  await import('./useArtifactOverrideOptions');

export class UseArtifactOverrideOptionsDriver {
  private columbusState: ColumbusState | undefined = aColumbusState();
  private artifact: ArtifactTableRow | undefined = anArtifactTableRow();
  private hook!: RenderHookResult<
    ReturnType<typeof useArtifactOverrideOptions>,
    undefined
  >;

  readonly given = {
    artifact: (artifact: ArtifactTableRow | undefined) => {
      this.artifact = artifact;

      return this;
    },
    columbusState: (columbusState: ColumbusState | undefined) => {
      this.columbusState = columbusState;

      return this;
    },
  };

  readonly when = {
    rendered: () => {
      useColumbusStateMock.mockReturnValue({
        columbusState: this.columbusState,
        setColumbusState: jest.fn(),
      });
      useLocationMock.mockReturnValue(
        aLocation({
          state: this.artifact ? { artifact: this.artifact } : null,
        }),
      );
      this.hook = renderHook(() => useArtifactOverrideOptions());
    },
  };

  readonly get = {
    result: () => this.hook.result.current,
  };
}
