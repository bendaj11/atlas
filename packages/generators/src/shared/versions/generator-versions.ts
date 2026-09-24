import {
  InvalidFrameworkVersionError,
  UnverifiedFrameworkVersionError,
} from '../errors/generator-errors.js';
import type { AtlasGeneratorOptions } from '../types/generator-types.js';
import type {
  AngularCompanionVersions,
  AngularVersionProfile,
  ReactVersionProfile,
} from './generator-versions.types.js';

export const ATLAS_PACKAGE_VERSION = "0.5.3";
const DEFAULT_REACT_VERSION = '19.2.8';
const DEFAULT_ANGULAR_VERSION = '20.3.0';
const VERIFIED_REACT_MAJORS = [17, 18, 19];
const VERIFIED_ANGULAR_COMPANIONS: ReadonlyMap<
  number,
  AngularCompanionVersions
> = new Map([
  [19, { typescript: '>=5.5.0 <5.9.0', zone: '^0.15.0' }],
  [20, { typescript: '>=5.8.0 <6.0.0', zone: '^0.15.0' }],
  [21, { typescript: '>=5.9.0 <6.0.0', zone: '^0.15.0' }],
  [22, { typescript: '>=6.0.0 <6.1.0', zone: '^0.16.0' }],
]);
const EXACT_SEMVER_PATTERN = /^[=~^]?(\d+\.\d+\.\d+(?:-[\w.-]+)?)$/;
const LEADING_MAJOR_PATTERN =
  /^\s*(?:npm:@?[^@]+@)?(?:[=~^v]|>=?|<=?)?\s*(\d+)(?:[.\s-]|$)/;

export function getAtlasPackageRange(): string {
  return `^${ATLAS_PACKAGE_VERSION}`;
}

export function resolveReactVersionProfileFromOptions(
  options: AtlasGeneratorOptions,
): ReactVersionProfile {
  const requestedVersion = options.frameworkVersion ?? DEFAULT_REACT_VERSION;
  const version = extractExactSemver(requestedVersion) ?? requestedVersion;
  const major = extractMajorFromVersion({ version, framework: 'React' });

  if (
    !VERIFIED_REACT_MAJORS.includes(major) &&
    !options.allowUnsupportedVersion
  ) {
    throw new UnverifiedFrameworkVersionError({
      framework: 'React',
      major,
      verifiedMajors: VERIFIED_REACT_MAJORS,
    });
  }

  return {
    version,
    major,
    routerVersion: major <= 17 ? '^6.30.1' : '^7.9.0',
  };
}

export function resolveAngularVersionProfileFromOptions(
  options: AtlasGeneratorOptions,
): AngularVersionProfile {
  const version = options.frameworkVersion ?? DEFAULT_ANGULAR_VERSION;
  const major = extractMajorFromVersion({ version, framework: 'Angular' });
  const verifiedCompanions = VERIFIED_ANGULAR_COMPANIONS.get(major);

  if (!verifiedCompanions && !options.allowUnsupportedVersion) {
    throw new UnverifiedFrameworkVersionError({
      framework: 'Angular',
      major,
      verifiedMajors: [...VERIFIED_ANGULAR_COMPANIONS.keys()],
    });
  }

  const zoneless = isZonelessAngularVersion({ version, major });

  return {
    version,
    major,
    ...(verifiedCompanions ?? findNearestVerifiedCompanions(major)),
    zoneless,
    requiresZonelessProvider: zoneless && major === 20,
  };
}

export function extractExactSemver(version: string): string | undefined {
  return version.match(EXACT_SEMVER_PATTERN)?.[1];
}

function findNearestVerifiedCompanions(
  major: number,
): AngularCompanionVersions {
  const [, companions] = [...VERIFIED_ANGULAR_COMPANIONS.entries()].reduce(
    (nearest, candidate) => {
      const candidateDistance = Math.abs(candidate[0] - major);
      const nearestDistance = Math.abs(nearest[0] - major);
      const candidateIsCloser =
        candidateDistance < nearestDistance ||
        (candidateDistance === nearestDistance && candidate[0] > nearest[0]);

      return candidateIsCloser ? candidate : nearest;
    },
  );

  return companions;
}

function isZonelessAngularVersion(options: {
  version: string;
  major: number;
}): boolean {
  const { version, major } = options;

  if (major >= 21) return true;

  if (major !== 20) return false;

  return /20\.(?:[2-9]|[1-9]\d)/.test(version);
}

function extractMajorFromVersion(options: {
  version: string;
  framework: 'React' | 'Angular';
}): number {
  const { version, framework } = options;
  const major = Number(version.match(LEADING_MAJOR_PATTERN)?.[1]);

  if (!Number.isInteger(major) || major < 1) {
    throw new InvalidFrameworkVersionError({ framework, version });
  }

  return major;
}
