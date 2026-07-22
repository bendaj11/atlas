import type { AtlasExtensionManifest } from '../../../types/contracts.js';
import {
  artifactSourceDescription,
  createCustomManifest,
  createEditorDraft,
  resolveSelectedManifest,
  versionLabel,
} from './manifest-utils.js';

export class ManifestUtilsDriver {
  private productionManifest = createProductionManifest();
  private selectedManifest: AtlasExtensionManifest | undefined;

  readonly given = {
    productionFramework: (
      framework: AtlasExtensionManifest['framework'],
    ): this => {
      this.productionManifest.framework = framework;
      return this;
    },
    selectedCustomUrl: (rawUrl: string): this => {
      this.selectedManifest = createCustomManifest({
        productionManifest: this.productionManifest,
        rawUrl,
      });
      return this;
    },
  };

  readonly get = {
    editorDraft: () =>
      createEditorDraft({
        id: this.productionManifest.id,
        hostId: 'host',
        allowCustomOverrides: true,
        productionManifest: this.productionManifest,
        selectedManifest: this.selectedManifest,
        productionOptions: [this.productionManifest],
        prOptions: [],
      }),
    customManifest: (rawUrl: string) =>
      createCustomManifest({
        productionManifest: this.productionManifest,
        rawUrl,
      }),
    missingPrSelection: () =>
      resolveSelectedManifest({
        productionManifest: this.productionManifest,
        draft: {
          type: 'pr',
          customUrl: '',
          productionKey: '',
          prKey: '',
        },
        productionOptions: [this.productionManifest],
        prOptions: [],
      }),
    versionLabel: (manifest: Partial<AtlasExtensionManifest>) =>
      versionLabel({ ...this.productionManifest, ...manifest }),
    sourceDescription: (
      manifest: Partial<AtlasExtensionManifest> | undefined,
    ) =>
      artifactSourceDescription(
        manifest ? { ...this.productionManifest, ...manifest } : undefined,
      ),
  };
}

function createProductionManifest(): AtlasExtensionManifest {
  return {
    schemaVersion: '1',
    kind: 'app',
    id: 'app',
    name: 'App',
    version: '1.0.0',
    buildId: 'production',
    channel: 'production',
    framework: 'angular',
    remoteEntryUrl:
      'https://cdn.example/apps/app/1.0.0/production/remoteEntry.json',
    integrity: 'sha256-production',
    styles: [
      {
        href: 'https://cdn.example/apps/app/1.0.0/production/assets/app.css',
        integrity: 'sha256-production-style',
      },
    ],
    exportedWidgets: [
      {
        remoteEntryUrl:
          'https://cdn.example/apps/app/1.0.0/production/widgets/summary.js',
      },
    ],
  };
}
