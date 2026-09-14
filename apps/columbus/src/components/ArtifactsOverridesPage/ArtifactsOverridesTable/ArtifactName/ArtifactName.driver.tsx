import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Artifact } from '../../../../types/app';
import { anArtifact } from '../../../../types/app.testkit';
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
    rendered: (): this => {
      render(<ArtifactName artifact={this.artifact} />);

      return this;
    },
    infoHovered: async (): Promise<this> => {
      await userEvent.hover(screen.getByRole('button'));

      return this;
    },
  };

  readonly get = {
    text: (name: string): HTMLElement | null => screen.queryByText(name),
    tooltipText: async (text: string): Promise<HTMLElement | null> =>
      screen.findByText(text).catch(() => null),
  };
}
