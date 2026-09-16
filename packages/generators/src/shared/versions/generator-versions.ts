import { generatorError } from '../errors/generator-error.js';
import type { AtlasGeneratorOptions } from '../types/generator-types.js';

export const ATLAS_PACKAGE_VERSION = '0.4.26';
const DEFAULT_REACT_VERSION = '19.2.8';
const DEFAULT_ANGULAR_VERSION = '20.3.0';
const VERIFIED_REACT_MAJORS = [17, 18, 19];
const EXACT_SEMVER_PATTERN = /^[=~^]?(\d+\.\d+\.\d+(?:-[\w.-]+)?)$/;
const LEADING_MAJOR_PATTERN =
  /^\s*(?:npm:@?[^@]+@)?(?:[=~^v]|>=?|<=?)?\s*(\d+)(?:[.\s-]|$)/;

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
  zoneless: boolean;
  requiresZonelessProvider: boolean;
}

type AngularCompanions = Pick<AngularVersionProfile, 'typescript' | 'zone'>;

const VERIFIED_ANGULAR_COMPANIONS: Record<number, AngularCompanions> = {
  19: { typescript: '>=5.5.0 <5.9.0', zone: '^0.15.0' },
  20: { typescript: '>=5.8.0 <6.0.0', zone: '^0.15.0' },
  21: { typescript: '>=5.9.0 <6.0.0', zone: '^0.15.0' },
  22: { typescript: '>=6.0.0 <6.1.0', zone: '^0.16.0' },
};

export function reactVersionProfile(
  options: AtlasGeneratorOptions,
): ReactVersionProfile {
  const requested = options.frameworkVersion ?? DEFAULT_REACT_VERSION;
  const version = exactSemver(requested) ?? requested;
  const major = frameworkMajor(version, 'React');
  if (
    !VERIFIED_REACT_MAJORS.includes(major) &&
    !options.allowUnsupportedVersion
  )
    throw unverifiedVersionError('React', major, VERIFIED_REACT_MAJORS);

  return {
    version,
    major,
    routerVersion: major <= 17 ? '^6.30.1' : '^7.9.0',
  };
}

export function angularVersionProfile(
  options: AtlasGeneratorOptions,
): AngularVersionProfile {
  const version = options.frameworkVersion ?? DEFAULT_ANGULAR_VERSION;
  const major = frameworkMajor(version, 'Angular');
  const verifiedMajors = Object.keys(VERIFIED_ANGULAR_COMPANIONS).map(Number);
  const companion = VERIFIED_ANGULAR_COMPANIONS[major];
  if (!companion && !options.allowUnsupportedVersion)
    throw unverifiedVersionError('Angular', major, verifiedMajors);
  const zoneless = supportsZonelessAngular(version, major);

  return {
    version,
    major,
    ...(companion ??
      VERIFIED_ANGULAR_COMPANIONS[nearestMajor(major, verifiedMajors)]!),
    zoneless,
    requiresZonelessProvider: zoneless && major === 20,
  };
}

export function exactSemver(version: string): string | undefined {
  return version.match(EXACT_SEMVER_PATTERN)?.[1];
}

function nearestMajor(major: number, candidates: number[]): number {
  return candidates.reduce((nearest, candidate) => {
    const distance = Math.abs(candidate - major);
    const nearestDistance = Math.abs(nearest - major);

    return distance < nearestDistance ||
      (distance === nearestDistance && candidate > nearest)
      ? candidate
      : nearest;
  });
}

function supportsZonelessAngular(version: string, major: number): boolean {
  if (major >= 21) return true;
  if (major !== 20) return false;

  return /20\.(?:[2-9]|[1-9]\d)/.test(version);
}

function frameworkMajor(value: string, framework: string): number {
  const major = Number(value.match(LEADING_MAJOR_PATTERN)?.[1]);
  if (!Number.isInteger(major) || major < 1) {
    throw generatorError({
      summary: `Invalid ${framework} framework version "${value}".`,
      suggestedActions: `Pass --framework-version with ${framework === 'React' ? 'a React' : 'an Angular'} version or range, for example ${framework === 'React' ? '19.2.8 or ^19.0.0' : '20.3.0 or ^20.0.0'}.`,
      code: 'ATLAS_GENERATOR_INVALID_VERSION',
    });
  }

  return major;
}

function unverifiedVersionError(
  framework: string,
  major: number,
  verifiedMajors: number[],
) {
  return generatorError({
    summary: `${framework} ${major} is not verified by Atlas.`,
    suggestedActions: [
      `Pass --framework-version with a verified ${framework} major (${verifiedMajors.join(', ')}).`,
      'Pass --allow-unsupported-version to generate it anyway with the nearest verified companion versions.',
    ],
    code: 'ATLAS_GENERATOR_UNVERIFIED_VERSION',
  });
}
