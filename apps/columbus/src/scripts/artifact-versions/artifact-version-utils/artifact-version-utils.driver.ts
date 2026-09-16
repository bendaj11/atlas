import { faker } from '@faker-js/faker';
import type { ArtifactVersion } from '../../../types/contracts';
import type {
  Artifact,
  ArtifactConfiguration,
  ColumbusState,
  OverrideSelection,
  OverrideType,
} from '../../../types/app';
import {
  anAppArtifactVersion,
  anArtifact,
  aColumbusState,
} from '../../../types/app.testkit';
import {
  artifactSourceDescription,
  configurationOf,
  initialOverrideSelection,
  isDeployedProductionVersion,
  isArtifactVersionSupportedByHost,
  normalizeStoredArtifactVersion,
  overrideTypeFor,
  artifactVersionFromSelection,
  versionBuildIdLabel,
  versionLabel,
} from './artifact-version-utils';

const OVERRIDE_TYPES: OverrideType[] = ['custom', 'production', 'pr'];

export class ArtifactVersionUtilsDriver {
  private productionArtifactVersion: ArtifactVersion = anAppArtifactVersion();
  private selectedArtifactVersion: ArtifactVersion | undefined;
  private productionArtifactVersions: ArtifactVersion[] = [];
  private prArtifactVersions: ArtifactVersion[] = [];
  private selection: OverrideSelection = {
    type: faker.helpers.arrayElement(OVERRIDE_TYPES),
    value: faker.string.alphanumeric(8),
  };
  private initialSelection: OverrideSelection | undefined;
  private resolved: ArtifactVersion | undefined;
  private normalizedManifest: ArtifactVersion | undefined;
  private label: string | undefined;
  private overrideType: string | undefined;
  private supported: boolean | undefined;
  private deployed: boolean | undefined;
  private error: unknown;
  private artifact: Artifact = anArtifact();
  private readonly session: ColumbusState = aColumbusState();
  private configuration: ArtifactConfiguration | undefined;

  readonly given = {
    productionArtifactVersion: (manifest: ArtifactVersion): this => {
      this.productionArtifactVersion = manifest;

      return this;
    },
    selectedArtifactVersion: (manifest: ArtifactVersion | undefined): this => {
      this.selectedArtifactVersion = manifest;

      return this;
    },
    productionArtifactVersions: (options: ArtifactVersion[]): this => {
      this.productionArtifactVersions = options;

      return this;
    },
    prArtifactVersions: (options: ArtifactVersion[]): this => {
      this.prArtifactVersions = options;

      return this;
    },
    selection: (selection: OverrideSelection): this => {
      this.selection = selection;

      return this;
    },
    artifact: (artifact: Artifact): this => {
      this.artifact = artifact;

      return this;
    },
    hostVersion: (version: ArtifactVersion): this => {
      const versions = this.session.hostData.versions;
      versions[this.artifact.key] = [
        ...(versions[this.artifact.key] ?? []),
        version,
      ];

      return this;
    },
    activeOverride: (override: ArtifactVersion): this => {
      this.session.enabledArtifactVersionOverrides.set(
        this.artifact.key,
        override,
      );

      return this;
    },
    disabledOverride: (override: ArtifactVersion): this => {
      this.session.disabledArtifactVersionOverrides.set(
        this.artifact.key,
        override,
      );

      return this;
    },
  };

  readonly when = {
    configurationBuilt: (): void => {
      this.configuration = configurationOf(this.artifact, this.session);
    },
    initialSelectionBuilt: (): void => {
      this.initialSelection = initialOverrideSelection(
        this.selectedArtifactVersion,
      );
    },
    manifestResolved: (): void => {
      try {
        this.resolved = artifactVersionFromSelection({
          productionArtifactVersion: this.productionArtifactVersion,
          selection: this.selection,
          productionArtifactVersions: this.productionArtifactVersions,
          prArtifactVersions: this.prArtifactVersions,
        });
      } catch (error) {
        this.error = error;
      }
    },
    storedManifestNormalized: (manifest: ArtifactVersion): void => {
      this.normalizedManifest = normalizeStoredArtifactVersion(manifest);
    },
    overrideTypeComputed: (): void => {
      const selection: Pick<
        Artifact,
        'productionArtifactVersion' | 'selectedArtifactVersion'
      > = {
        productionArtifactVersion: this.productionArtifactVersion,
        selectedArtifactVersion: this.selectedArtifactVersion,
      };
      this.overrideType = overrideTypeFor(selection);
    },
    versionLabelled: (manifest: ArtifactVersion): void => {
      this.label = versionLabel(manifest);
    },
    versionBuildIdLabelled: (manifest: ArtifactVersion): void => {
      this.label = versionBuildIdLabel(manifest);
    },
    sourceDescribed: (manifest: ArtifactVersion | undefined): void => {
      this.label = artifactSourceDescription(manifest);
    },
    hostSupportChecked: (manifest: ArtifactVersion, hostId: string): void => {
      this.supported = isArtifactVersionSupportedByHost({
        artifactVersion: manifest,
        hostId,
      });
    },
    deployedVersionChecked: (
      manifest: ArtifactVersion,
      deployedArtifactVersion: ArtifactVersion | undefined,
    ): void => {
      this.deployed = isDeployedProductionVersion(
        manifest,
        deployedArtifactVersion,
      );
    },
  };

  readonly get = {
    configuration: (): ArtifactConfiguration => this.configuration!,
    hostId: (): string => this.session.hostData.config.hostId,
    initialSelection: (): OverrideSelection => this.initialSelection!,
    resolved: (): ArtifactVersion | undefined => this.resolved,
    normalizedManifest: (): ArtifactVersion | undefined =>
      this.normalizedManifest,
    errorMessage: (): string | undefined =>
      this.error instanceof Error ? this.error.message : undefined,
    label: (): string | undefined => this.label,
    overrideType: (): string | undefined => this.overrideType,
    supported: (): boolean | undefined => this.supported,
    deployed: (): boolean | undefined => this.deployed,
  };
}
