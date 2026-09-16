import { render, type RenderResult, within } from '@testing-library/react';
import { TextTestkit } from '@wix/design-system/dist/testkit/testing-library';
import type { AtlasExtensionManifest } from '../../../../types/artifact-version';
import type { Artifact, OverrideType } from '../../../../types/artifact';
import { ArtifactOverrideVersion } from './ArtifactOverrideVersion';

export class ArtifactOverrideVersionDriver {
  private artifact = anArtifact();
  private view: RenderResult | undefined;

  readonly given = {
    override: (overrideType: OverrideType): this => {
      this.artifact = {
        ...this.artifact,
        overrideType,
        overrideEnabled: true,
        selectedArtifactVersion: manifest({
          channel: 'pr',
          buildId: 'pull-request-build-123',
        }),
        sourceDescription: 'feature/orders · abc1234 · Update orders',
      };

      return this;
    },
    customOverrideUrl: (url: string): this => {
      this.artifact = {
        ...this.artifact,
        overrideType: 'custom',
        overrideEnabled: true,
        selectedArtifactVersion: manifest({
          channel: 'local',
          remoteEntryUrl: `${url}/remoteEntry.json`,
        }),
        sourceDescription: url,
      };

      return this;
    },
    enabledProductionSelection: (): this => {
      this.artifact = {
        ...this.artifact,
        overrideEnabled: true,
        selectedArtifactVersion: this.artifact.productionArtifactVersion,
        sourceDescription: '1.0.0-production',
      };

      return this;
    },
    loadError: (loadError: string): this => {
      this.artifact = { ...this.artifact, loadError };

      return this;
    },
    productionBuildId: (buildId: string): this => {
      this.artifact = {
        ...this.artifact,
        productionArtifactVersion: manifest({ buildId }),
      };

      return this;
    },
  };

  readonly when = {
    rendered: (): void => {
      this.view = render(<ArtifactOverrideVersion artifact={this.artifact} />);
    },
  };

  readonly get = {
    version: () =>
      TextTestkit({
        wrapper: this.get.container(),
        dataHook: 'override-version',
      }),
    versionText: (label: string) =>
      within(this.get.container()).getByText(label).textContent,
    container: (): HTMLElement => {
      if (!this.view) throw new Error('Override version was not rendered.');

      return this.view.container;
    },
  };
}

function anArtifact(): Artifact {
  const productionArtifactVersion = manifest({});

  return {
    key: 'app:orders',
    productionArtifactVersion,
    selectedArtifactVersion: undefined,
    overrideType: undefined,
    sourceDescription: '',
    loadError: undefined,
    overrideEnabled: false,
    canToggle: true,
    visible: false,
  };
}

function manifest(
  overrides: Partial<AtlasExtensionManifest>,
): AtlasExtensionManifest {
  return {
    schemaVersion: '1',
    kind: 'app',
    id: 'orders',
    name: 'Orders',
    version: '1.0.0',
    buildId: 'production',
    channel: 'production',
    framework: 'react',
    remoteEntryUrl: 'https://cdn.example/orders/remoteEntry.json',
    ...overrides,
  };
}
