import { jest } from '@jest/globals';
import { renderHook, type RenderHookResult } from '@testing-library/react';
import type { useLocation as useLocationType } from 'react-router-dom';
import type { Artifact, ColumbusState } from '../../../types/app';
import { anArtifact, aColumbusState } from '../../../types/app.testkit';
import type { useColumbusState as useColumbusStateType } from '../../providers/index';

const useLocation = jest.fn<typeof useLocationType>();
const useColumbusState = jest.fn<typeof useColumbusStateType>();

jest.unstable_mockModule('react-router-dom', () => ({ useLocation }));
jest.unstable_mockModule('../../providers', () => ({ useColumbusState }));

const { useArtifactConfiguration } = await import('./useArtifactConfiguration');

export class UseArtifactConfigurationDriver {
  private columbusState: ColumbusState | undefined = aColumbusState();
  private artifact: Artifact | undefined = anArtifact();
  private hook!: RenderHookResult<
    ReturnType<typeof useArtifactConfiguration>,
    undefined
  >;

  readonly given = {
    artifact: (artifact: Artifact | undefined): this => {
      this.artifact = artifact;

      return this;
    },
    columbusState: (columbusState: ColumbusState | undefined): this => {
      this.columbusState = columbusState;

      return this;
    },
  };

  readonly when = {
    rendered: (): void => {
      useLocation.mockReturnValue({
        state: this.artifact ? { artifact: this.artifact } : null,
      } as ReturnType<typeof useLocationType>);
      useColumbusState.mockReturnValue({
        columbusState: this.columbusState,
      } as ReturnType<typeof useColumbusStateType>);
      this.hook = renderHook(() => useArtifactConfiguration());
    },
  };

  readonly get = {
    result: () => this.hook.result.current,
  };
}
