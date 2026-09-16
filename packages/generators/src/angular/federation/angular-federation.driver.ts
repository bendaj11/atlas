import type { AngularVersionProfile } from '../../shared/versions/generator-versions.js';
import { anAngularVersionProfile } from '../../testkit/version-profiles.testkit.js';
import {
  nativeFederationBuilder,
  nativeFederationPackage,
  usesNativeFederationV4ConfigApi,
  usesNativeFederationV4Package,
} from './angular-federation.js';

export class AngularFederationDriver {
  private profile: AngularVersionProfile = anAngularVersionProfile();

  readonly given = {
    profile: (profile: AngularVersionProfile): this => {
      this.profile = profile;

      return this;
    },
  };

  readonly get = {
    package: (): string => nativeFederationPackage(this.profile),
    builder: (): string => nativeFederationBuilder(this.profile),
    usesV4Package: (): boolean => usesNativeFederationV4Package(this.profile),
    usesV4ConfigApi: (): boolean =>
      usesNativeFederationV4ConfigApi(this.profile),
  };
}
