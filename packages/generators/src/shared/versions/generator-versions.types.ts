export interface ReactVersionProfile {
  version: string;
  major: number;
  routerVersion: string;
}

export interface AngularCompanionVersions {
  typescript: string;
  zone: string;
}

export interface AngularVersionProfile extends AngularCompanionVersions {
  version: string;
  major: number;
  zoneless: boolean;
  requiresZonelessProvider: boolean;
}
