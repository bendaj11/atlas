import type { AtlasFramework } from "@atlas/schema";

export interface AtlasGeneratorOptions {
  name: string;
  /** Package name written to package.json. Defaults to the unscoped project name. */
  packageName?: string;
  framework: AtlasFramework;
  /** Host that receives the generated route. Omit to leave routes unconfigured. */
  hostId?: string;
  /** Whether to generate inner app routes. Defaults to true. */
  routing?: boolean;
  /** Dev-server port written to generated framework config. Defaults to host 4200, app 4201. */
  devServerPort?: number;
  /** Exact version or semver range used by the generated framework dependencies. */
  frameworkVersion?: string;
  /** Allows generation outside Atlas' verified framework-major matrix. */
  allowUnsupportedVersion?: boolean;
}

export interface AtlasGeneratedFile {
  path: string;
  contents: string;
}
