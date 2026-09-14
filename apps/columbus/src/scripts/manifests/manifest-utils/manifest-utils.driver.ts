import type { AtlasExtensionManifest as Manifest } from '../../../types/contracts';
import type { ArtifactSelection, EditorDraft } from '../../../types/app';
import { aManifest } from '../../../types/app.testkit';
import {
  artifactSourceDescription,
  createEditorDraft,
  isManifestSupportedByHost,
  normalizeStoredManifest,
  overrideTypeFor,
  resolveSelectedManifest,
  versionBuildIdLabel,
  versionLabel,
} from './manifest-utils';

export class ManifestUtilsDriver {
  private productionManifest: Manifest = aManifest();
  private selectedManifest: Manifest | undefined;
  private productionOptions: Manifest[] = [];
  private prOptions: Manifest[] = [];
  private draft: EditorDraft = {
    type: 'custom',
    customUrl: '',
    productionKey: '',
    prKey: '',
  };
  private createdDraft: EditorDraft | undefined;
  private resolvedManifest: Manifest | undefined;
  private normalizedManifest: Manifest | undefined;
  private label: string | undefined;
  private overrideType: string | undefined;
  private supported: boolean | undefined;
  private error: unknown;

  readonly given = {
    productionManifest: (manifest: Manifest): this => {
      this.productionManifest = manifest;

      return this;
    },
    selectedManifest: (manifest: Manifest | undefined): this => {
      this.selectedManifest = manifest;

      return this;
    },
    productionOptions: (options: Manifest[]): this => {
      this.productionOptions = options;

      return this;
    },
    prOptions: (options: Manifest[]): this => {
      this.prOptions = options;

      return this;
    },
    draft: (draft: Partial<EditorDraft>): this => {
      this.draft = { ...this.draft, ...draft };

      return this;
    },
  };

  readonly when = {
    draftCreated: (withConfiguration = true): this => {
      this.createdDraft = createEditorDraft(
        withConfiguration
          ? {
              key: 'app:orders',
              hostId: 'host',
              productionManifest: this.productionManifest,
              selectedManifest: this.selectedManifest,
              productionOptions: this.productionOptions,
              prOptions: this.prOptions,
            }
          : undefined,
      );

      return this;
    },
    manifestResolved: (): this => {
      try {
        this.resolvedManifest = resolveSelectedManifest({
          productionManifest: this.productionManifest,
          draft: this.draft,
          productionOptions: this.productionOptions,
          prOptions: this.prOptions,
        });
      } catch (error) {
        this.error = error;
      }

      return this;
    },
    storedManifestNormalized: (manifest: Manifest): this => {
      this.normalizedManifest = normalizeStoredManifest(manifest);

      return this;
    },
    overrideTypeComputed: (): this => {
      const selection: ArtifactSelection = {
        productionManifest: this.productionManifest,
        selectedManifest: this.selectedManifest,
      };
      this.overrideType = overrideTypeFor(selection);

      return this;
    },
    versionLabelled: (manifest: Manifest): this => {
      this.label = versionLabel(manifest);

      return this;
    },
    versionBuildIdLabelled: (manifest: Manifest): this => {
      this.label = versionBuildIdLabel(manifest);

      return this;
    },
    sourceDescribed: (manifest: Manifest | undefined): this => {
      this.label = artifactSourceDescription(manifest);

      return this;
    },
    hostSupportChecked: (manifest: Manifest, hostId: string): this => {
      this.supported = isManifestSupportedByHost(manifest, hostId);

      return this;
    },
  };

  readonly get = {
    draft: (): EditorDraft => this.createdDraft!,
    resolvedManifest: (): Manifest | undefined => this.resolvedManifest,
    normalizedManifest: (): Manifest | undefined => this.normalizedManifest,
    errorMessage: (): string | undefined =>
      this.error instanceof Error ? this.error.message : undefined,
    label: (): string | undefined => this.label,
    overrideType: (): string | undefined => this.overrideType,
    supported: (): boolean | undefined => this.supported,
  };
}
