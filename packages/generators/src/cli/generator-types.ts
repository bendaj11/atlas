import type { AtlasFramework } from "@atlas/contracts";

export interface AtlasGeneratorOptions {
  name: string;
  /** Package name written to package.json. Defaults to the unscoped project name. */
  packageName?: string;
  framework: AtlasFramework;
  /** Host that receives the generated route placement. Omit to leave host compatibility unconfigured. */
  hostId?: string;
  /** Exact version or semver range used by the generated framework dependencies. */
  frameworkVersion?: string;
  /** Allows generation outside Atlas' verified framework-major matrix. */
  allowUnsupportedVersion?: boolean;
}

export interface AtlasGeneratedFile {
  path: string;
  contents: string;
}
