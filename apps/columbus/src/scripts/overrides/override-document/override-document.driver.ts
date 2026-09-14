import type { AtlasExtensionManifest as Manifest } from '../../../types/contracts';
import { aHostData } from '../../../types/app.testkit';
import { loadBrowserRuntimeOverrides } from '../../../../../../packages/runtime/src/loader/runtime-discovery';
import { countOverrides, createOverrideDocument } from './override-document';

export class OverrideDocumentDriver {
  private readonly hostData = aHostData();
  private readonly overrides = new Map<string, Manifest>();
  private document: ReturnType<typeof createOverrideDocument> | undefined;

  readonly given = {
    override: (artifactKey: string, manifest: Manifest): this => {
      this.overrides.set(artifactKey, manifest);

      return this;
    },
  };

  readonly when = {
    documentCreated: (): this => {
      this.document = createOverrideDocument({
        hostData: this.hostData,
        overrides: this.overrides,
      });

      return this;
    },
  };

  readonly get = {
    document: () => this.document!,
    count: (): number => countOverrides(this.document!),
    runtimeOverrides: () =>
      loadBrowserRuntimeOverrides({
        hostId: this.hostData.config.hostId,
        search: '',
        sessionStorage: {
          getItem: (key: string) =>
            key === 'atlas.runtime-overrides'
              ? JSON.stringify(this.document)
              : null,
        },
      }),
  };
}
