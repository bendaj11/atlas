import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Artifact } from '../../../../types/artifact';
import { anArtifact } from '../../../../types/artifact.testkit';
import { ArtifactName } from './ArtifactName';

export class ArtifactNameDriver {
  private artifact: Artifact = anArtifact();

  readonly given = {
    artifact: (artifact: Artifact): this => {
      this.artifact = artifact;

      return this;
    },
  };

  readonly when = {
    rendered: (): void => {
      render(<ArtifactName artifact={this.artifact} />);
    },
    infoHovered: async (): Promise<void> => {
      await userEvent.hover(screen.getByRole('button'));
    },
  };

  readonly get = {
    text: (name: string): HTMLElement | null => screen.queryByText(name),
    tooltipText: async (text: string): Promise<HTMLElement | null> =>
      screen.findByText(text).catch(() => null),
  };
}
