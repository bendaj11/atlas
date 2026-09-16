import { faker } from '@faker-js/faker';
import type { PackageManifest } from '../../shared/types/generated-documents.js';
import type { AtlasProjectType } from '../../shared/types/generator-types.js';
import type { AngularVersionProfile } from '../../shared/versions/generator-versions.js';
import { anAtlasId } from '../../testkit/generator-options.testkit.js';
import { anAngularVersionProfile } from '../../testkit/version-profiles.testkit.js';
import { angularIndex, angularPackage } from './angular-package-generator.js';

export class AngularPackageGeneratorDriver {
  private packageName = anAtlasId();
  private projectName = anAtlasId();
  private type: AtlasProjectType = faker.helpers.arrayElement<AtlasProjectType>(
    ['host', 'app'],
  );
  private profile: AngularVersionProfile = anAngularVersionProfile();
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
    profile: (profile: AngularVersionProfile): this => {
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
      this.manifest = angularPackage({
        packageName: this.packageName,
        projectName: this.projectName,
        type: this.type,
        profile: this.profile,
        routed: this.routed,
      });
    },
    indexGenerated: (options: { pageTitle: string; body: string }): void => {
      this.html = angularIndex(options);
    },
  };

  readonly get = {
    manifest: (): PackageManifest => this.manifest,
    html: (): string => this.html,
  };
}
