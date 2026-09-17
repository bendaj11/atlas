import { render } from '@testing-library/react';
import {
  InfoIconTestkit,
  TextTestkit,
} from '@wix/design-system/dist/testkit/testing-library';
import type { ArtifactTableRow } from '../../../../types/artifact';
import { anArtifactTableRow } from '../../../../testkit/artifact.testkit';
import { ArtifactName } from './ArtifactName';

export class ArtifactNameDriver {
  private artifact = anArtifactTableRow();
  private baseElement!: Element;

  readonly given = {
    artifact: (artifact: ArtifactTableRow) => {
      this.artifact = artifact;

      return this;
    },
  };

  readonly when = {
    rendered: () => {
      this.baseElement = render(
        <ArtifactName artifact={this.artifact} />,
      ).baseElement;
    },
    infoHovered: () => this.get.infoIcon().hover(),
  };

  readonly get = {
    name: () =>
      TextTestkit({ wrapper: this.baseElement, dataHook: 'artifact-name' }),
    infoIcon: () =>
      InfoIconTestkit({ wrapper: this.baseElement, dataHook: 'artifact-info' }),
  };
}
