import { faker } from '@faker-js/faker';
import type { PackageManifest } from '../../shared/types/generated-documents.js';
import type { AtlasProjectType } from '../../shared/types/generator-types.js';
import type { ReactVersionProfile } from '../../shared/versions/generator-versions.js';
import { anAtlasId } from '../../testkit/generator-options.testkit.js';
import { aReactVersionProfile } from '../../testkit/version-profiles.testkit.js';
import {
  reactAppIndex,
  reactIndex,
  reactPackage,
} from './react-package-generator.js';

export class ReactPackageGeneratorDriver {
  private packageName = anAtlasId();
  private projectName = anAtlasId();
  private type: AtlasProjectType = faker.helpers.arrayElement<AtlasProjectType>(
    ['host', 'app'],
  );
  private profile: ReactVersionProfile = aReactVersionProfile();
  private routed?: boolean;
  private manifest!: PackageManifest;
  private html!: string;

  readonly given = {
    packageName: (packageName: string): this => {
      this.packageName = packageName;

      return this;
    },
    projectName: (projectName: string): this => {
      this.projectName = projectName;

      return this;
    },
    type: (type: AtlasProjectType): this => {
      this.type = type;

      return this;
    },
    profile: (profile: ReactVersionProfile): this => {
      this.profile = profile;

      return this;
    },
    routed: (routed: boolean | undefined): this => {
      this.routed = routed;

      return this;
    },
  };

  readonly when = {
    packaged: (): void => {
      this.manifest = reactPackage({
        packageName: this.packageName,
        projectName: this.projectName,
        type: this.type,
        profile: this.profile,
        routed: this.routed,
      });
    },
    hostIndexGenerated: (pageTitle: string): void => {
      this.html = reactIndex(pageTitle);
    },
    appIndexGenerated: (pageTitle: string): void => {
      this.html = reactAppIndex(pageTitle);
    },
  };

  readonly get = {
    manifest: (): PackageManifest => this.manifest,
    html: (): string => this.html,
  };
}
