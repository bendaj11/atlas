import type {
  AtlasHostDeploymentManifest,
  AtlasManifestDescriptor,
  AtlasPublishedArtifactManifest,
} from './atlas-publication.js';
import {
  validateMetadata,
  validateSemanticVersionRange,
} from './validation.js';
import { ATLAS_ALL_HOSTS } from './atlas-placement.js';

const FRAMEWORKS = new Set(['angular', 'react', 'vue']);
const FILE_ROLES = new Set([
  'remote-entry',
  'script',
  'stylesheet',
  'asset',
  'source-map',
]);
const DOM_ISOLATIONS = new Set(['shared-dom', 'scoped', 'shadow-dom']);
const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const SHA_256_INTEGRITY = /^sha256-[A-Za-z0-9+/]{43}=$/u;
const MEDIA_TYPE =
  /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+(?:\s*;\s*[^\s=;]+=[^;]+)*$/iu;

export function assertPublishedArtifactManifest(
  value: unknown,
): asserts value is AtlasPublishedArtifactManifest {
  if (!isRecord(value)) throw new Error('Atlas manifest must be an object.');
  if (
    value.schemaVersion !== '2' ||
    (value.kind !== 'app-artifact' && value.kind !== 'host-artifact')
  ) {
    throw new Error(
      'Atlas artifact manifest requires schemaVersion "2" and a supported kind.',
    );
  }
  assertSafeArtifactId(value.id, 'id');
  requiredString(value.name, 'name');
  optionalString(value.packageName, 'packageName');
  requiredString(value.entryPath, 'entryPath');
  assertSafeRelativePath(value.entryPath as string, 'entryPath');
  assertFramework(value.framework, 'framework');
  assertExposes(value.exposes);
  assertOptionalSource(value.source);
  const release = isRecord(value.release) ? value.release : undefined;
  const preview = isRecord(value.preview) ? value.preview : undefined;
  const hasRelease = Boolean(release);
  const hasPreview = Boolean(preview);
  if (hasRelease === hasPreview) {
    throw new Error(
      'Atlas artifact manifest requires exactly one release or preview identity.',
    );
  }
  if (release) assertReleaseVersion(release.version);
  if (preview) {
    if (!Number.isSafeInteger(preview.number) || Number(preview.number) < 1) {
      throw new Error('Atlas preview number must be a positive integer.');
    }
    requiredString(preview.gitSha, 'preview.gitSha');
    optionalString(preview.gitBranch, 'preview.gitBranch');
    optionalString(preview.gitCommitTitle, 'preview.gitCommitTitle');
  }
  if (!Array.isArray(value.files))
    throw new Error('Atlas manifest files must be an array.');
  const paths = new Set<string>();
  for (const fileValue of value.files) {
    if (!isRecord(fileValue))
      throw new Error('Atlas file descriptor must be an object.');
    requiredString(fileValue.path, 'files.path');
    const path = fileValue.path as string;
    assertSafeRelativePath(path, 'files.path');
    if (path === 'manifest.json')
      throw new Error('Atlas manifest must not list itself.');
    if (paths.has(path))
      throw new Error(`Atlas manifest contains duplicate path "${path}".`);
    paths.add(path);
    assertDigest(fileValue.digest, `files.${path}.digest`);
    if (!Number.isSafeInteger(fileValue.size) || Number(fileValue.size) < 0) {
      throw new Error(`Atlas file ${path} has an invalid byte size.`);
    }
    requiredString(fileValue.mediaType, `files.${path}.mediaType`);
    if (!MEDIA_TYPE.test(fileValue.mediaType as string)) {
      throw new Error(`Atlas file ${path} has an invalid media type.`);
    }
    requiredString(fileValue.cacheControl, `files.${path}.cacheControl`);
    if (fileValue.cacheControl !== IMMUTABLE_CACHE_CONTROL) {
      throw new Error(`Atlas file ${path} must use immutable cache policy.`);
    }
    if (!FILE_ROLES.has(String(fileValue.role))) {
      throw new Error(`Atlas file ${path} has an invalid role.`);
    }
  }
  if (!paths.has(value.entryPath as string)) {
    throw new Error('Atlas entryPath must identify one listed payload file.');
  }
  const files = value.files as Array<Record<string, unknown>>;
  const entry = files.find(({ path }) => path === value.entryPath);
  if (entry?.role !== 'remote-entry') {
    throw new Error('Atlas entryPath file must have role remote-entry.');
  }
  if (files.filter(({ role }) => role === 'remote-entry').length !== 1) {
    throw new Error('Atlas manifest must list exactly one remote-entry file.');
  }
  assertStyles(value.styles, files);
  if (value.kind === 'app-artifact') assertAppManifest(value);
  else assertHostManifest(value);
}

function assertAppManifest(value: Record<string, unknown>): void {
  if (
    value.isolation !== undefined &&
    !DOM_ISOLATIONS.has(String(value.isolation))
  ) {
    throw new Error('Atlas app isolation is invalid.');
  }
  assertSemanticVersionRange(
    value.requiredHostSdkVersion,
    'requiredHostSdkVersion',
  );
  const supportedHosts = assertIdentifierArray(
    value.supportedHosts,
    'supportedHosts',
    { allowWildcard: true, requireValue: true },
  );
  if (supportedHosts.includes('*') && supportedHosts.length !== 1) {
    throw new Error('Atlas supportedHosts wildcard must be used alone.');
  }
  assertPlacements(value.placements, supportedHosts);
  assertPublishedWidgets(value.exportedWidgets, value);
  assertIdentifierArray(
    value.externalAppsDependencies,
    'externalAppsDependencies',
    { optional: true },
  );
  assertMetadata(value.metadata, 'metadata');
}

function assertHostManifest(value: Record<string, unknown>): void {
  assertSemanticVersionRange(
    value.requiredLoaderApiVersion,
    'requiredLoaderApiVersion',
  );
}

function assertFramework(value: unknown, subject: string): void {
  if (!FRAMEWORKS.has(String(value))) {
    throw new Error(`Atlas ${subject} must be angular, react, or vue.`);
  }
}

function assertExposes(value: unknown): void {
  if (!isRecord(value)) throw new Error('Atlas exposes must be an object.');
  requiredString(value.entry, 'exposes.entry');
  for (const [name, expose] of Object.entries(value)) {
    requiredString(name, 'exposes key');
    requiredString(expose, `exposes.${name}`);
  }
}

function assertOptionalSource(value: unknown): void {
  if (value === undefined) return;
  if (!isRecord(value)) throw new Error('Atlas source must be an object.');
  optionalString(value.gitSha, 'source.gitSha');
  optionalString(value.gitBranch, 'source.gitBranch');
  optionalString(value.gitCommitTitle, 'source.gitCommitTitle');
}

function assertStyles(
  value: unknown,
  files: Array<Record<string, unknown>>,
): void {
  const stylesheets = new Map(
    files
      .filter(({ role }) => role === 'stylesheet')
      .map(({ path, digest }) => [String(path), String(digest)]),
  );
  if (value === undefined) {
    if (stylesheets.size) {
      throw new Error('Atlas stylesheet files require styles descriptors.');
    }
    return;
  }
  if (!Array.isArray(value)) throw new Error('Atlas styles must be an array.');
  const paths = new Set<string>();
  for (const styleValue of value) {
    if (!isRecord(styleValue)) {
      throw new Error('Atlas stylesheet descriptor must be an object.');
    }
    requiredString(styleValue.path, 'styles.path');
    const path = styleValue.path as string;
    assertSafeRelativePath(path, 'styles.path');
    if (paths.has(path)) {
      throw new Error(`Atlas styles contains duplicate path "${path}".`);
    }
    const digest = stylesheets.get(path);
    if (!digest) {
      throw new Error(
        `Atlas style ${path} does not identify a stylesheet file.`,
      );
    }
    if (
      typeof styleValue.integrity !== 'string' ||
      !SHA_256_INTEGRITY.test(styleValue.integrity)
    ) {
      throw new Error(`Atlas style ${path} has invalid SHA-256 integrity.`);
    }
    if (styleValue.integrity !== digestToIntegrity(digest)) {
      throw new Error(`Atlas style ${path} integrity does not match its file.`);
    }
    paths.add(path);
  }
  if (paths.size !== stylesheets.size) {
    throw new Error('Atlas styles must describe every stylesheet file.');
  }
}

interface IdentifierArrayOptions {
  optional?: boolean;
  allowWildcard?: boolean;
  requireValue?: boolean;
}

function assertIdentifierArray(
  value: unknown,
  subject: string,
  options: IdentifierArrayOptions = {},
): string[] {
  if (value === undefined && options.optional) return [];
  if (!Array.isArray(value))
    throw new Error(`Atlas ${subject} must be an array.`);
  if (options.requireValue && value.length === 0) {
    throw new Error(`Atlas ${subject} must not be empty.`);
  }
  const identifiers = new Set<string>();
  for (const entry of value) {
    if (entry !== '*' || !options.allowWildcard) {
      assertSafeArtifactId(entry, subject);
    }
    if (identifiers.has(entry as string)) {
      throw new Error(`Atlas ${subject} contains duplicate identifier.`);
    }
    identifiers.add(entry as string);
  }
  return [...identifiers];
}

function assertPlacements(value: unknown, supportedHosts: string[]): void {
  if (!Array.isArray(value))
    throw new Error('Atlas placements must be an array.');
  const placementIds = new Set<string>();
  const routePaths = new Set<string>();
  for (const placementValue of value) {
    if (!isRecord(placementValue)) {
      throw new Error('Atlas placement must be an object.');
    }
    assertSafeArtifactId(placementValue.id, 'placement.id');
    if (placementValue.hostId !== ATLAS_ALL_HOSTS) {
      assertSafeArtifactId(placementValue.hostId, 'placement.hostId');
    }
    const hostId = placementValue.hostId as string;
    const placementKey = `${hostId}:${placementValue.id as string}`;
    if (placementIds.has(placementKey)) {
      throw new Error(`Atlas placement ${placementKey} is duplicated.`);
    }
    placementIds.add(placementKey);
    if (!supportedHosts.includes('*') && !supportedHosts.includes(hostId)) {
      throw new Error(`Atlas placement host ${hostId} is not supported.`);
    }
    if (placementValue.kind === 'route') {
      assertRoutePlacement(placementValue, routePaths);
    } else if (placementValue.kind === 'slot') {
      assertSlotPlacement(placementValue);
    } else {
      throw new Error('Atlas placement kind must be route or slot.');
    }
  }
}

function assertRoutePlacement(
  placement: Record<string, unknown>,
  routePaths: Set<string>,
): void {
  if (placement.slot !== undefined) {
    throw new Error('Atlas route placement must not define a slot.');
  }
  if (!isRecord(placement.route)) {
    throw new Error('Atlas route placement requires route details.');
  }
  const route = placement.route;
  requiredString(route.path, 'placement.route.path');
  const path = route.path as string;
  if (!isRoutePattern(path)) {
    throw new Error(`Atlas route path "${path}" is invalid.`);
  }
  const routeKey = `${placement.hostId as string}:${path}`;
  if (routePaths.has(routeKey)) {
    throw new Error(`Atlas route ${routeKey} is duplicated.`);
  }
  routePaths.add(routeKey);
  if (
    route.match !== undefined &&
    route.match !== 'prefix' &&
    route.match !== 'full'
  ) {
    throw new Error('Atlas route match must be prefix or full.');
  }
  optionalString(route.redirectTo, 'placement.route.redirectTo');
  if (
    typeof route.redirectTo === 'string' &&
    !isRoutePattern(route.redirectTo)
  ) {
    throw new Error('Atlas route redirectTo is invalid.');
  }
  optionalString(route.layoutId, 'placement.route.layoutId');
  if (route.redirectTo !== undefined && route.layoutId !== undefined) {
    throw new Error('Atlas redirect route must not define layoutId.');
  }
  optionalString(route.title, 'placement.route.title');
  if (route.nav !== undefined) assertRouteNavigation(route.nav);
}

function assertSlotPlacement(placement: Record<string, unknown>): void {
  requiredString(placement.slot, 'placement.slot');
  if (placement.route !== undefined) {
    throw new Error('Atlas slot placement must not define a route.');
  }
}

function assertRouteNavigation(value: unknown): void {
  if (!isRecord(value)) throw new Error('Atlas route nav must be an object.');
  requiredString(value.label, 'placement.route.nav.label');
  if (
    value.order !== undefined &&
    (typeof value.order !== 'number' || !Number.isFinite(value.order))
  ) {
    throw new Error('Atlas route nav order must be finite.');
  }
  if (value.visible !== undefined && typeof value.visible !== 'boolean') {
    throw new Error('Atlas route nav visible must be boolean.');
  }
}

function assertPublishedWidgets(
  value: unknown,
  app: Record<string, unknown>,
): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    throw new Error('Atlas exportedWidgets must be an array.');
  }
  const ids = new Set<string>();
  for (const widgetValue of value) {
    if (!isRecord(widgetValue)) {
      throw new Error('Atlas exported widget must be an object.');
    }
    if (widgetValue.schemaVersion !== '1') {
      throw new Error('Atlas exported widget schemaVersion must be "1".');
    }
    assertSafeArtifactId(widgetValue.id, 'exportedWidgets.id');
    requiredString(widgetValue.name, 'exportedWidgets.name');
    assertSafeArtifactId(widgetValue.ownerAppId, 'exportedWidgets.ownerAppId');
    if (widgetValue.ownerAppId !== app.id) {
      throw new Error('Atlas exported widget ownerAppId must match app id.');
    }
    assertFramework(widgetValue.framework, 'exported widget framework');
    if (widgetValue.framework !== app.framework) {
      throw new Error(
        'Atlas exported widget framework must match app framework.',
      );
    }
    requiredString(widgetValue.expose, 'exportedWidgets.expose');
    if (widgetValue.contractVersion !== '1') {
      throw new Error('Atlas exported widget contractVersion must be "1".');
    }
    assertMetadata(widgetValue.metadata, 'exportedWidgets.metadata');
    if (ids.has(widgetValue.id as string)) {
      throw new Error('Atlas exportedWidgets contains duplicate id.');
    }
    ids.add(widgetValue.id as string);
  }
}

function assertSemanticVersionRange(value: unknown, subject: string): void {
  requiredString(value, subject);
  const issues: Array<{ path: string; message: string }> = [];
  validateSemanticVersionRange(value, subject, issues);
  if (issues[0]) throw new Error(`Atlas ${issues[0].message}`);
}

function assertMetadata(value: unknown, subject: string): void {
  const issues: Array<{ path: string; message: string }> = [];
  validateMetadata(value, subject, issues);
  if (issues[0]) throw new Error(`Atlas ${issues[0].message}`);
}

function optionalString(value: unknown, subject: string): void {
  if (value !== undefined) requiredString(value, subject);
}

function digestToIntegrity(digest: string): string {
  const bytes =
    digest
      .slice('sha256:'.length)
      .match(/.{2}/gu)
      ?.map((value) => String.fromCharCode(Number.parseInt(value, 16)))
      .join('') ?? '';
  return `sha256-${btoa(bytes)}`;
}

function isRoutePattern(value: string): boolean {
  if (
    !value.startsWith('/') ||
    value.includes('?') ||
    value.includes('#') ||
    value.includes('//')
  ) {
    return false;
  }
  const segments = value.split('/').filter(Boolean);
  return segments.every((segment, index) =>
    segment === '*'
      ? index === segments.length - 1
      : segment.startsWith(':')
        ? /^:[A-Za-z][A-Za-z0-9_-]*$/u.test(segment)
        : segment.length > 0,
  );
}

export function assertHostDeploymentManifest(
  value: unknown,
): asserts value is AtlasHostDeploymentManifest {
  if (
    !isRecord(value) ||
    value.schemaVersion !== '2' ||
    value.kind !== 'host-deployment'
  ) {
    throw new Error('Atlas host deployment manifest is invalid.');
  }
  assertSafeArtifactId(value.hostId, 'hostId');
  requiredString(value.environment, 'environment');
  assertDigest(value.deploymentRevision, 'deploymentRevision');
  assertManifestReference(value.host, 'host');
  for (const field of ['apps', 'widgetProviders'] as const) {
    if (value[field] === undefined && field === 'widgetProviders') continue;
    if (!Array.isArray(value[field]))
      throw new Error(`${field} must be an array.`);
    value[field].forEach((reference, index) =>
      assertManifestReference(reference, `${field}.${index}`),
    );
  }
}

export function assertManifestDescriptor(
  value: unknown,
  subject = 'manifest descriptor',
): asserts value is AtlasManifestDescriptor {
  if (!isRecord(value)) throw new Error(`${subject} must be an object.`);
  requiredString(value.path, `${subject}.path`);
  assertSafeRelativePath(value.path as string, `${subject}.path`);
  assertDigest(value.digest, `${subject}.digest`);
  if (!Number.isSafeInteger(value.size) || Number(value.size) < 1) {
    throw new Error(`${subject}.size must be a positive integer.`);
  }
  if (value.mediaType !== 'application/json') {
    throw new Error(`${subject}.mediaType must be application/json.`);
  }
}

export function assertReleaseVersion(value: unknown): asserts value is string {
  requiredString(value, 'release.version');
  if (
    value === 'latest' ||
    !/^[A-Za-z0-9][A-Za-z0-9._~-]*$/u.test(value as string)
  ) {
    throw new Error(
      `Atlas release version "${value as string}" is reserved or unsafe.`,
    );
  }
}

export function assertSafeArtifactId(
  value: unknown,
  subject = 'artifact id',
): asserts value is string {
  requiredString(value, subject);
  if (!/^[A-Za-z0-9][A-Za-z0-9._~-]*$/u.test(value as string)) {
    throw new Error(`${subject} must be a URL-safe path segment.`);
  }
}

export function assertSafeRelativePath(value: string, subject: string): void {
  if (
    !value ||
    value.startsWith('/') ||
    value.includes('\\') ||
    /[%?#]/u.test(value) ||
    /[\u0000-\u001f\u007f]/u.test(value) ||
    value
      .split('/')
      .some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    throw new Error(`${subject} "${value}" must be a safe relative path.`);
  }
}

function assertManifestReference(value: unknown, subject: string): void {
  const record = isRecord(value) ? value : undefined;
  assertManifestDescriptor(value, subject);
  requiredString(record?.url, `${subject}.url`);
  const url = new URL(record.url);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`${subject}.url must use HTTP(S).`);
  }
}

function assertDigest(value: unknown, subject: string): void {
  if (typeof value !== 'string' || !/^sha256:[0-9a-f]{64}$/u.test(value)) {
    throw new Error(`${subject} must be a lowercase SHA-256 digest.`);
  }
}

function requiredString(
  value: unknown,
  subject: string,
): asserts value is string {
  if (typeof value !== 'string' || !value)
    throw new Error(`${subject} is required.`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
