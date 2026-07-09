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
  /** Exact version or semver range used by the generated framework dependencies. */
  frameworkVersion?: string;
  /** Allows generation outside Atlas' verified framework-major matrix. */
  allowUnsupportedVersion?: boolean;
}

export interface AtlasGeneratedFile {
  path: string;
  contents: string;
}
