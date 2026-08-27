import { render, type RenderResult, within } from '@testing-library/react';
import { TextTestkit } from '@wix/design-system/dist/testkit/testing-library.js';
import type { AtlasExtensionManifest } from '../../../../types/contracts.js';
import type { Artifact, OverrideType } from '../../../../types/app.js';
import { ArtifactOverrideVersion } from './ArtifactOverrideVersion.js';

export class ArtifactOverrideVersionDriver {
  private artifact = createArtifact();
  private view: RenderResult | undefined;

  readonly given = {
    override: (overrideType: Exclude<OverrideType, 'none'>): this => {
      this.artifact = {
        ...this.artifact,
        overrideType,
        overrideEnabled: true,
        selectedManifest: manifest({
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
        selectedManifest: manifest({
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
        selectedManifest: this.artifact.productionManifest,
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
        productionManifest: manifest({ buildId }),
      };
      return this;
    },
  };

  readonly when = {
    rendered: (): this => {
      this.view = render(<ArtifactOverrideVersion artifact={this.artifact} />);
      return this;
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

function createArtifact(): Artifact {
  const productionManifest = manifest({});
  return {
    id: 'app:orders',
    productionManifest,
    selectedManifest: undefined,
    overrideType: 'none',
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
