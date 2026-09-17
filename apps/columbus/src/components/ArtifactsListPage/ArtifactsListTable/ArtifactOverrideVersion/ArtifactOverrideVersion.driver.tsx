import { render } from '@testing-library/react';
import {
  TextTestkit,
  TooltipTestkit,
} from '@wix/design-system/dist/testkit/testing-library';
import type { ArtifactTableRow } from '../../../../types/artifact';
import { anArtifactTableRow } from '../../../../testkit/artifact.testkit';
import { ArtifactOverrideVersion } from './ArtifactOverrideVersion';

export class ArtifactOverrideVersionDriver {
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
        <ArtifactOverrideVersion artifact={this.artifact} />,
      ).baseElement;
    },
    versionHovered: () => this.get.tooltip().mouseEnter(),
  };

  readonly get = {
    version: () =>
      TextTestkit({ wrapper: this.baseElement, dataHook: 'override-version' }),
    tooltip: () =>
      TooltipTestkit({
        wrapper: this.baseElement,
        dataHook: 'override-version-tooltip',
      }),
  };
}
