import { jest } from '@jest/globals';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Artifact } from '../../../types/app';
import type {
  useActionsDisabled as useActionsDisabledType,
  useOverrides as useOverridesType,
} from '../../providers';
import type { useArtifacts as useArtifactsType } from '../useArtifacts/useArtifacts';

const useArtifacts = jest.fn<typeof useArtifactsType>();
const useActionsDisabled = jest.fn<typeof useActionsDisabledType>();
const useOverrides = jest.fn<typeof useOverridesType>();

jest.unstable_mockModule('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
}));
jest.unstable_mockModule('../useArtifacts/useArtifacts', () => ({
  useArtifacts,
}));
jest.unstable_mockModule('../../providers', () => ({
  useActionsDisabled,
  useOverrides,
}));

const { ArtifactsOverridesTable } = await import('./ArtifactsOverridesTable');

type ArtifactsValue = ReturnType<typeof useArtifactsType>;
type OverridesValue = ReturnType<typeof useOverridesType>;

export class ArtifactsOverridesTableDriver {
  private artifacts: Artifact[] = [];
  private totalCount = 0;
  private visibleOnly = false;
  private readonly setSearchValue = jest.fn<ArtifactsValue['setSearchValue']>();
  private readonly setVisibleOnly = jest.fn<ArtifactsValue['setVisibleOnly']>();

  readonly given = {
    artifacts: (artifacts: Artifact[]): this => {
      this.artifacts = artifacts;

      return this;
    },
    totalCount: (totalCount: number): this => {
      this.totalCount = totalCount;

      return this;
    },
    visibleOnly: (visibleOnly: boolean): this => {
      this.visibleOnly = visibleOnly;

      return this;
    },
  };

  readonly when = {
    rendered: (): this => {
      useArtifacts.mockReturnValue({
        artifacts: this.artifacts,
        totalCount: this.totalCount,
        searchValue: '',
        setSearchValue: this.setSearchValue,
        visibleOnly: this.visibleOnly,
        setVisibleOnly: this.setVisibleOnly,
      });
      useActionsDisabled.mockReturnValue(false);
      useOverrides.mockReturnValue({} as OverridesValue);
      render(<ArtifactsOverridesTable />);

      return this;
    },
    searched: async (value: string): Promise<this> => {
      await userEvent.type(screen.getByRole('textbox'), value);

      return this;
    },
    visibleFilterClicked: async (): Promise<this> => {
      await userEvent.click(
        screen.getByRole('button', { name: 'Show visible artifacts only' }),
      );

      return this;
    },
  };

  readonly get = {
    rowNames: (): string[] =>
      screen
        .getAllByRole('row')
        .filter((row) => within(row).queryAllByRole('cell').length > 0)
        .map((row) => row.textContent ?? ''),
    toggles: (): HTMLElement[] => screen.queryAllByRole('checkbox'),
    countLabel: (): HTMLElement | null => screen.queryByText(/artifacts found/),
    searchValue: (): string | undefined =>
      this.setSearchValue.mock.calls.at(-1)?.[0],
    visibleOnlyChange: (): boolean | undefined =>
      this.setVisibleOnly.mock.calls[0]?.[0],
  };
}
