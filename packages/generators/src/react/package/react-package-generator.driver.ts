import { faker } from '@faker-js/faker';
import type { PackageManifest } from '../../shared/types/generated-documents.js';
import type { AtlasProjectType } from '../../shared/types/generator-types.js';
import type { ReactVersionProfile } from '../../shared/versions/generator-versions.types.js';
import { anAtlasId } from '../../testkit/generator-options.testkit.js';
import { aReactVersionProfile } from '../../testkit/version-profiles.testkit.js';
import {
  renderReactAppIndexHtml,
  renderReactHostIndexHtml,
  buildReactPackageManifest,
} from './react-package-generator.js';

export class ReactPackageGeneratorDriver {
  private packageName = anAtlasId();
  private projectName = anAtlasId();
  private type: AtlasProjectType = faker.helpers.arrayElement<AtlasProjectType>(
    ['host', 'app'],
  );
  private profile = aReactVersionProfile();
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
    profile: (profile: ReactVersionProfile) => {
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
      this.manifest = buildReactPackageManifest({
        packageName: this.packageName,
        projectName: this.projectName,
        type: this.type,
        profile: this.profile,
        routed: this.routed,
      });
    },
    hostIndexGenerated: (pageTitle: string) => {
      this.html = renderReactHostIndexHtml(pageTitle);
    },
    appIndexGenerated: (pageTitle: string) => {
      this.html = renderReactAppIndexHtml(pageTitle);
    },
  };

  readonly get = {
    manifest: () => this.manifest,
    html: () => this.html,
  };
}
