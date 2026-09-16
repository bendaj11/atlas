import { angularRemoteName, angularRootSelector } from './angular-names.js';

export class AngularNamesDriver {
  private result!: string;

  readonly when = {
    rootSelectorBuilt: (name: string): void => {
      this.result = angularRootSelector(name);
    },
    remoteNameBuilt: (name: string): void => {
      this.result = angularRemoteName(name);
    },
  };

  readonly get = {
    result: (): string => this.result,
  };
}
