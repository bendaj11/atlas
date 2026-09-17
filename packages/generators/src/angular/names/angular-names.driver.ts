import {
  convertNameToFederationRemoteName,
  convertNameToAngularRootSelector,
} from './angular-names.js';

export class AngularNamesDriver {
  private result!: string;

  readonly when = {
    rootSelectorBuilt: (name: string) => {
      this.result = convertNameToAngularRootSelector(name);
    },
    remoteNameBuilt: (name: string) => {
      this.result = convertNameToFederationRemoteName(name);
    },
  };

  readonly get = {
    result: () => this.result,
  };
}
