import { faker } from '@faker-js/faker';
import type { PackageManifest } from '../../shared/types/generated-documents.js';
import type { AtlasProjectType } from '../../shared/types/generator-types.js';
import type { AngularVersionProfile } from '../../shared/versions/generator-versions.types.js';
import { anAtlasId } from '../../testkit/generator-options.testkit.js';
import { anAngularVersionProfile } from '../../testkit/version-profiles.testkit.js';
import {
  renderAngularIndexHtml,
  buildAngularPackageManifest,
} from './angular-package-generator.js';

export class AngularPackageGeneratorDriver {
  private packageName = anAtlasId();
  private projectName = anAtlasId();
  private type: AtlasProjectType = faker.helpers.arrayElement<AtlasProjectType>(
    ['host', 'app'],
  );
  private profile = anAngularVersionProfile();
  private routed?: boolean;
  private manifest!: PackageManifest;
  private html!: string;

  readonly given = {
    packageName: (packageName: string) => {
      this.packageName = packageName;

      return this;
    },
    projectName: (projectName: string) => {
      this.projectName = projectName;

      return this;
    },
    type: (type: AtlasProjectType) => {
      this.type = type;

      return this;
    },
    profile: (profile: AngularVersionProfile) => {
      this.profile = profile;

      return this;
    },
    routed: (routed: boolean | undefined) => {
      this.routed = routed;

      return this;
    },
  };

  readonly when = {
    packaged: () => {
      this.manifest = buildAngularPackageManifest({
        packageName: this.packageName,
        projectName: this.projectName,
        type: this.type,
        profile: this.profile,
        routed: this.routed,
      });
    },
    indexGenerated: (options: { pageTitle: string; body: string }) => {
      this.html = renderAngularIndexHtml(options);
    },
  };

  readonly get = {
    manifest: () => this.manifest,
    html: () => this.html,
  };
}
