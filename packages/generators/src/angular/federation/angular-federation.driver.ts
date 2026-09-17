import type { AngularVersionProfile } from '../../shared/versions/generator-versions.types.js';
import { anAngularVersionProfile } from '../../testkit/version-profiles.testkit.js';
import {
  selectNativeFederationBuilder,
  selectNativeFederationPackage,
  usesNativeFederationV4ConfigApi,
  usesNativeFederationV4Package,
} from './angular-federation.js';

export class AngularFederationDriver {
  private profile = anAngularVersionProfile();

  readonly given = {
    profile: (profile: AngularVersionProfile) => {
      this.profile = profile;

      return this;
    },
  };

  readonly get = {
    package: () => selectNativeFederationPackage(this.profile),
    builder: () => selectNativeFederationBuilder(this.profile),
    usesV4Package: () => usesNativeFederationV4Package(this.profile),
    usesV4ConfigApi: () => usesNativeFederationV4ConfigApi(this.profile),
  };
}
