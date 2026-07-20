import type { AtlasGeneratorOptions } from "./generator-types.js";

export const ATLAS_PACKAGE_VERSION = "0.3.21";

export function atlasPackageRange(): string {
  return `^${ATLAS_PACKAGE_VERSION}`;
}

export interface ReactVersionProfile {
  version: string;
  major: number;
  routerVersion: string;
}

export interface AngularVersionProfile {
  version: string;
  major: number;
  typescript: string;
  zone: string;
}

export function reactVersionProfile(options: AtlasGeneratorOptions): ReactVersionProfile {
  const version = options.frameworkVersion ?? "^19.2.0";
  const major = frameworkMajor(version, "React");
  if (![17, 18, 19].includes(major) && !options.allowUnsupportedVersion) {
    throw new Error(`React ${major} is not verified by Atlas. Pass allowUnsupportedVersion to generate it explicitly.`);
  }
  return { version, major, routerVersion: major === 17 ? "^6.30.1" : "^7.9.0" };
}

export function angularVersionProfile(options: AtlasGeneratorOptions): AngularVersionProfile {
  const version = options.frameworkVersion ?? "^20.3.0";
  const major = frameworkMajor(version, "Angular");
  const verified: Record<number, Pick<AngularVersionProfile, "typescript" | "zone">> = {
    19: { typescript: ">=5.5.0 <5.9.0", zone: "^0.15.0" },
    20: { typescript: ">=5.8.0 <6.0.0", zone: "^0.15.0" },
    21: { typescript: ">=5.9.0 <6.0.0", zone: "^0.15.0" },
    22: { typescript: ">=6.0.0 <6.1.0", zone: "^0.16.0" }
  };
  const companion = verified[major];
  if (!companion && !options.allowUnsupportedVersion) {
    throw new Error(`Angular ${major} is not verified by Atlas. Pass allowUnsupportedVersion to generate it explicitly.`);
  }
  return { version, major, ...(companion ?? verified[22]!) };
}

function frameworkMajor(value: string, framework: string): number {
  const match = value.match(/\d+/);
  const major = match ? Number(match[0]) : NaN;
  if (!Number.isInteger(major) || major < 1) throw new Error(`Invalid ${framework} framework version "${value}".`);
  return major;
}
