import type { AtlasValidationIssue } from '../../errors/atlas-validation-issue.js';
import { ATLAS_DOM_ISOLATIONS } from '../../manifest/atlas-dom-isolation.js';
import { ATLAS_FRAMEWORKS } from '../../manifest/atlas-framework.js';
import { ATLAS_ALL_HOSTS } from '../../manifest/atlas-placement/atlas-placement.js';
import { ATLAS_PLACEMENT_KINDS } from '../../manifest/atlas-placement-kind.js';
import { ATLAS_ROUTE_MATCHES } from '../../manifest/atlas-route-contribution.js';
import { ATLAS_WIDGET_CONTRACT_VERSION } from '../../manifest/validate-atlas-manifest/validate-atlas-manifest.js';
import { assertValid } from '../../validation/assert-valid.js';
import { digestToIntegrity } from '../../validation/digest-to-integrity.js';
import { isRoutePattern } from '../../validation/route-pattern.js';
import { ValidationIssues } from '../../validation/validation-issues.js';
import {
  asRecord,
  optionalOneOf,
  optionalString,
  requiredLiteral,
  requiredOneOf,
  requiredSafeRelativePath,
  requiredString,
  requiredUrlSafePathSegment,
  validateInteger,
  validateMetadata,
  validateSemanticVersionRange,
  validateSha256Digest,
  validateSha256Integrity,
  validateUniqueValue,
  validateUrlSafePathSegment,
  type UnknownRecord,
} from '../../validation/validators.js';
import {
  ATLAS_IMMUTABLE_CACHE_CONTROL,
  ATLAS_PAYLOAD_FILE_ROLES,
  type AtlasPublishedArtifactManifest,
} from '../atlas-publication.js';
import { validateReleaseVersion } from '../release-version/release-version.js';

export const ATLAS_ARTIFACT_MANIFEST_SCHEMA_VERSION = '2';
const ARTIFACT_KINDS = ['app-artifact', 'host-artifact'] as const;
const MANIFEST_FILE_NAME = 'manifest.json';
const MEDIA_TYPE =
  /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+(?:\s*;\s*[^\s=;]+=[^;]+)*$/iu;

interface PayloadFile {
  path: string;
  role: string | undefined;
  digest: string | undefined;
}

/** Checks unknown JSON and returns all published artifact manifest problems. */
export function validatePublishedArtifactManifest(
  value: unknown,
): AtlasValidationIssue[] {
  const issues = ValidationIssues.create();
  collectPublishedArtifactManifestIssues({ value, issues });

  return issues.list();
}

/** Checks unknown JSON and throws unless it is a valid published artifact manifest. */
export function assertPublishedArtifactManifest(
  value: unknown,
): asserts value is AtlasPublishedArtifactManifest {
  const issues = ValidationIssues.create();
  collectPublishedArtifactManifestIssues({ value, issues });
  assertValid({ issues, message: 'Invalid Atlas artifact manifest.' });
}

function collectPublishedArtifactManifestIssues(input: {
  value: unknown;
  issues: ValidationIssues;
}): void {
  const { issues } = input;
  const manifest = asRecord(input.value);
  if (!manifest) {
    issues.add({ path: '', message: 'Expected the manifest to be an object.' });

    return;
  }
  requiredLiteral({
    record: manifest,
    key: 'schemaVersion',
    expected: ATLAS_ARTIFACT_MANIFEST_SCHEMA_VERSION,
    issues,
  });
  const kind = requiredOneOf({
    record: manifest,
    key: 'kind',
    allowed: ARTIFACT_KINDS,
    issues,
  });
  const id = requiredUrlSafePathSegment({
    record: manifest,
    key: 'id',
    label: 'artifact id',
    issues,
  });
  requiredString({ record: manifest, key: 'name', issues });
  optionalString({ record: manifest, key: 'packageName', issues });
  const entryPath = requiredSafeRelativePath({
    record: manifest,
    key: 'entryPath',
    issues,
  });
  const framework = requiredOneOf({
    record: manifest,
    key: 'framework',
    allowed: ATLAS_FRAMEWORKS,
    issues,
  });
  validateExposes({ value: manifest.exposes, issues: issues.at('exposes') });
  validateSource({ value: manifest.source, issues: issues.at('source') });
  validateIdentity({ manifest, issues });
  const files = validateFiles({
    value: manifest.files,
    entryPath,
    issues: issues.at('files'),
  });
  validateStyles({
    value: manifest.styles,
    files,
    issues: issues.at('styles'),
  });
  if (kind === 'app-artifact')
    validateAppFields({ manifest, appId: id, framework, issues });
  if (kind === 'host-artifact') validateHostFields({ manifest, issues });
}

function validateIdentity(input: {
  manifest: UnknownRecord;
  issues: ValidationIssues;
}): void {
  const release = asRecord(input.manifest.release);
  const preview = asRecord(input.manifest.preview);
  if (Boolean(release) === Boolean(preview)) {
    input.issues.add({
      path: 'release',
      message: 'Expected exactly one of release or preview identity.',
    });

    return;
  }
  if (release)
    validateReleaseVersion({
      value: release.version,
      path: 'release.version',
      issues: input.issues,
    });
  if (preview) {
    const issues = input.issues.at('preview');
    validateInteger({
      value: preview.number,
      path: 'number',
      label: 'preview number',
      minimum: 1,
      issues,
    });
    requiredString({ record: preview, key: 'gitSha', issues });
    optionalString({ record: preview, key: 'gitBranch', issues });
    optionalString({ record: preview, key: 'gitCommitTitle', issues });
  }
}

function validateExposes(input: {
  value: unknown;
  issues: ValidationIssues;
}): void {
  const exposes = asRecord(input.value);
  if (!exposes) {
    input.issues.add({
      path: '',
      message: 'Expected exposes to be an object.',
    });

    return;
  }
  requiredString({ record: exposes, key: 'entry', issues: input.issues });
  for (const [name, expose] of Object.entries(exposes)) {
    if (name === 'entry') continue;
    if (typeof expose !== 'string' || expose.trim() === '')
      input.issues.add({
        path: name,
        message: 'Expected expose path to be a non-empty string.',
      });
  }
}

function validateSource(input: {
  value: unknown;
  issues: ValidationIssues;
}): void {
  if (input.value === undefined) return;
  const source = asRecord(input.value);
  if (!source) {
    input.issues.add({ path: '', message: 'Expected source to be an object.' });

    return;
  }
  optionalString({ record: source, key: 'gitSha', issues: input.issues });
  optionalString({ record: source, key: 'gitBranch', issues: input.issues });
  optionalString({
    record: source,
    key: 'gitCommitTitle',
    issues: input.issues,
  });
}

function validateFiles(input: {
  value: unknown;
  entryPath: string | undefined;
  issues: ValidationIssues;
}): PayloadFile[] {
  if (!Array.isArray(input.value)) {
    input.issues.add({ path: '', message: 'Expected files to be an array.' });

    return [];
  }
  const paths = new Set<string>();
  const files = input.value.map((fileValue, index) =>
    validateFile({
      value: fileValue,
      paths,
      issues: input.issues.at(String(index)),
    }),
  );
  const entry = files.find((file) => file?.path === input.entryPath);
  if (input.entryPath && !entry)
    input.issues.add({
      path: '',
      message: `Expected entryPath "${input.entryPath}" to identify one listed payload file.`,
    });
  if (entry && entry.role !== 'remote-entry')
    input.issues.add({
      path: '',
      message: `Expected the entryPath file "${entry.path}" to have role remote-entry.`,
    });
  const remoteEntries = files.filter((file) => file?.role === 'remote-entry');
  if (remoteEntries.length !== 1)
    input.issues.add({
      path: '',
      message: 'Expected exactly one file with role remote-entry.',
    });

  return files.filter((file): file is PayloadFile => file !== undefined);
}

function validateFile(input: {
  value: unknown;
  paths: Set<string>;
  issues: ValidationIssues;
}): PayloadFile | undefined {
  const { issues } = input;
  const file = asRecord(input.value);
  if (!file) {
    issues.add({
      path: '',
      message: 'Expected file descriptor to be an object.',
    });

    return undefined;
  }
  const path = requiredSafeRelativePath({ record: file, key: 'path', issues });
  if (path === MANIFEST_FILE_NAME)
    issues.add({ path: 'path', message: 'The manifest must not list itself.' });
  if (path)
    validateUniqueValue({
      value: path,
      path: 'path',
      label: 'file path',
      seen: input.paths,
      issues,
    });
  const digest = validateSha256Digest({
    value: file.digest,
    path: 'digest',
    issues,
  })
    ? (file.digest as string)
    : undefined;
  validateInteger({
    value: file.size,
    path: 'size',
    label: 'file size',
    minimum: 0,
    issues,
  });
  const mediaType = requiredString({ record: file, key: 'mediaType', issues });
  if (mediaType && !MEDIA_TYPE.test(mediaType))
    issues.add({
      path: 'mediaType',
      message: 'Expected a media type such as text/javascript; charset=utf-8.',
    });
  requiredLiteral({
    record: file,
    key: 'cacheControl',
    expected: ATLAS_IMMUTABLE_CACHE_CONTROL,
    issues,
  });
  const role = requiredOneOf({
    record: file,
    key: 'role',
    allowed: ATLAS_PAYLOAD_FILE_ROLES,
    issues,
  });
  if (!path) return undefined;

  return { path, role, digest };
}

function validateStyles(input: {
  value: unknown;
  files: readonly PayloadFile[];
  issues: ValidationIssues;
}): void {
  const stylesheets = new Map(
    input.files
      .filter((file) => file.role === 'stylesheet')
      .map((file) => [file.path, file.digest]),
  );
  if (input.value === undefined) {
    if (stylesheets.size > 0)
      input.issues.add({
        path: '',
        message: 'Expected a styles descriptor for every stylesheet file.',
      });

    return;
  }
  if (!Array.isArray(input.value)) {
    input.issues.add({ path: '', message: 'Expected styles to be an array.' });

    return;
  }
  const paths = new Set<string>();
  const described = new Set<string>();
  input.value.forEach((styleValue, index) => {
    const issues = input.issues.at(String(index));
    const style = asRecord(styleValue);
    if (!style) {
      issues.add({
        path: '',
        message: 'Expected stylesheet descriptor to be an object.',
      });

      return;
    }
    const path = requiredSafeRelativePath({
      record: style,
      key: 'path',
      issues,
    });
    if (!path) return;
    validateUniqueValue({
      value: path,
      path: 'path',
      label: 'stylesheet path',
      seen: paths,
      issues,
    });
    if (!stylesheets.has(path)) {
      issues.add({
        path: 'path',
        message: `Expected "${path}" to identify a file with role stylesheet.`,
      });

      return;
    }
    described.add(path);
    const digest = stylesheets.get(path);
    const validIntegrity = validateSha256Integrity({
      value: style.integrity,
      path: 'integrity',
      issues,
    });
    if (
      validIntegrity &&
      digest &&
      style.integrity !== digestToIntegrity(digest)
    )
      issues.add({
        path: 'integrity',
        message: `Expected integrity to match the digest of "${path}".`,
      });
  });
  if (described.size !== stylesheets.size)
    input.issues.add({
      path: '',
      message: 'Expected a styles descriptor for every stylesheet file.',
    });
}

function validateAppFields(input: {
  manifest: UnknownRecord;
  appId: string | undefined;
  framework: string | undefined;
  issues: ValidationIssues;
}): void {
  const { manifest, issues } = input;
  optionalOneOf({
    record: manifest,
    key: 'isolation',
    allowed: ATLAS_DOM_ISOLATIONS,
    issues,
  });
  const sdkRange = requiredString({
    record: manifest,
    key: 'requiredHostSdkVersion',
    issues,
  });
  if (sdkRange)
    validateSemanticVersionRange({
      value: sdkRange,
      path: 'requiredHostSdkVersion',
      issues,
    });
  const supportedHosts = validateIdentifierList({
    value: manifest.supportedHosts,
    label: 'supported host id',
    allowWildcard: true,
    issues: issues.at('supportedHosts'),
  });
  if (supportedHosts && supportedHosts.size === 0)
    issues.add({
      path: 'supportedHosts',
      message: 'Expected at least one supported host id.',
    });
  if (supportedHosts?.has(ATLAS_ALL_HOSTS) && supportedHosts.size > 1)
    issues.add({
      path: 'supportedHosts',
      message: `Expected "${ATLAS_ALL_HOSTS}" to be the only supported host when present.`,
    });
  validatePlacements({
    value: manifest.placements,
    supportedHosts,
    issues: issues.at('placements'),
  });
  validateExportedWidgets({
    value: manifest.exportedWidgets,
    appId: input.appId,
    framework: input.framework,
    issues: issues.at('exportedWidgets'),
  });
  if (manifest.externalAppsDependencies !== undefined)
    validateIdentifierList({
      value: manifest.externalAppsDependencies,
      label: 'external app id',
      allowWildcard: false,
      issues: issues.at('externalAppsDependencies'),
    });
  validateMetadata({ value: manifest.metadata, path: 'metadata', issues });
}

function validateHostFields(input: {
  manifest: UnknownRecord;
  issues: ValidationIssues;
}): void {
  const loaderRange = requiredString({
    record: input.manifest,
    key: 'requiredLoaderApiVersion',
    issues: input.issues,
  });
  if (loaderRange)
    validateSemanticVersionRange({
      value: loaderRange,
      path: 'requiredLoaderApiVersion',
      issues: input.issues,
    });
}

function validateIdentifierList(input: {
  value: unknown;
  label: string;
  allowWildcard: boolean;
  issues: ValidationIssues;
}): Set<string> | undefined {
  if (!Array.isArray(input.value)) {
    input.issues.add({
      path: '',
      message: `Expected an array of ${input.label}s.`,
    });

    return undefined;
  }
  const seen = new Set<string>();
  input.value.forEach((entry, index) => {
    const path = String(index);
    if (typeof entry !== 'string' || entry.trim() === '') {
      input.issues.add({
        path,
        message: `Expected ${input.label} to be a non-empty string.`,
      });

      return;
    }
    const wildcard = input.allowWildcard && entry === ATLAS_ALL_HOSTS;
    if (
      !wildcard &&
      !validateUrlSafePathSegment({
        value: entry,
        path,
        label: input.label,
        issues: input.issues,
      })
    )
      return;
    validateUniqueValue({
      value: entry,
      path,
      label: input.label,
      seen,
      issues: input.issues,
    });
  });

  return seen;
}

function validatePlacements(input: {
  value: unknown;
  supportedHosts: Set<string> | undefined;
  issues: ValidationIssues;
}): void {
  if (!Array.isArray(input.value)) {
    input.issues.add({
      path: '',
      message: 'Expected placements to be an array.',
    });

    return;
  }
  const placementIds = new Set<string>();
  const routePaths = new Set<string>();
  input.value.forEach((placementValue, index) => {
    const issues = input.issues.at(String(index));
    const placement = asRecord(placementValue);
    if (!placement) {
      issues.add({ path: '', message: 'Expected placement to be an object.' });

      return;
    }
    const id = requiredUrlSafePathSegment({
      record: placement,
      key: 'id',
      label: 'placement id',
      issues,
    });
    const hostId = validatePlacementHostId({
      placement,
      supportedHosts: input.supportedHosts,
      issues,
    });
    if (id && hostId)
      validateUniqueValue({
        value: `${hostId}:${id}`,
        path: 'id',
        label: 'placement',
        seen: placementIds,
        issues,
      });
    const kind = requiredOneOf({
      record: placement,
      key: 'kind',
      allowed: ATLAS_PLACEMENT_KINDS,
      issues,
    });
    if (kind === 'route')
      validateRoutePlacement({ placement, hostId, routePaths, issues });
    if (kind === 'slot') {
      requiredString({ record: placement, key: 'slot', issues });
      if (placement.route !== undefined)
        issues.add({
          path: 'route',
          message: 'Slot placements must not define a route.',
        });
    }
  });
}

function validatePlacementHostId(input: {
  placement: UnknownRecord;
  supportedHosts: Set<string> | undefined;
  issues: ValidationIssues;
}): string | undefined {
  const hostId = requiredString({
    record: input.placement,
    key: 'hostId',
    issues: input.issues,
  });
  if (!hostId) return undefined;
  if (
    hostId !== ATLAS_ALL_HOSTS &&
    !validateUrlSafePathSegment({
      value: hostId,
      path: 'hostId',
      label: 'placement host id',
      issues: input.issues,
    })
  )
    return hostId;
  if (
    input.supportedHosts &&
    !input.supportedHosts.has(ATLAS_ALL_HOSTS) &&
    !input.supportedHosts.has(hostId)
  )
    input.issues.add({
      path: 'hostId',
      message: `Expected placement host "${hostId}" to be listed in supportedHosts.`,
    });

  return hostId;
}

function validateRoutePlacement(input: {
  placement: UnknownRecord;
  hostId: string | undefined;
  routePaths: Set<string>;
  issues: ValidationIssues;
}): void {
  if (input.placement.slot !== undefined)
    input.issues.add({
      path: 'slot',
      message: 'Route placements must not define a slot.',
    });
  const route = asRecord(input.placement.route);
  const issues = input.issues.at('route');
  if (!route) {
    issues.add({
      path: '',
      message: 'Expected route details for a route placement.',
    });

    return;
  }
  const path = requiredString({ record: route, key: 'path', issues });
  if (path && !isRoutePattern(path))
    issues.add({
      path: 'path',
      message:
        'Expected an absolute route pattern with static segments, :params, or a final * wildcard.',
    });
  if (path && input.hostId)
    validateUniqueValue({
      value: `${input.hostId}:${path}`,
      path: 'path',
      label: 'route',
      seen: input.routePaths,
      issues,
    });
  optionalOneOf({
    record: route,
    key: 'match',
    allowed: ATLAS_ROUTE_MATCHES,
    issues,
  });
  const redirectTo = optionalString({
    record: route,
    key: 'redirectTo',
    issues,
  });
  if (redirectTo && !isRoutePattern(redirectTo))
    issues.add({
      path: 'redirectTo',
      message: 'Expected redirectTo to be an absolute route path.',
    });
  optionalString({ record: route, key: 'layoutId', issues });
  if (route.redirectTo !== undefined && route.layoutId !== undefined)
    issues.add({
      path: 'layoutId',
      message: 'Redirect routes must not define layoutId.',
    });
  optionalString({ record: route, key: 'title', issues });
  validateNavigation({ value: route.nav, issues: issues.at('nav') });
}

function validateNavigation(input: {
  value: unknown;
  issues: ValidationIssues;
}): void {
  if (input.value === undefined) return;
  const nav = asRecord(input.value);
  if (!nav) {
    input.issues.add({ path: '', message: 'Expected nav to be an object.' });

    return;
  }
  requiredString({ record: nav, key: 'label', issues: input.issues });
  if (
    nav.order !== undefined &&
    (typeof nav.order !== 'number' || !Number.isFinite(nav.order))
  )
    input.issues.add({
      path: 'order',
      message: 'Expected order to be a finite number.',
    });
  if (nav.visible !== undefined && typeof nav.visible !== 'boolean')
    input.issues.add({
      path: 'visible',
      message: 'Expected visible to be a boolean.',
    });
}

function validateExportedWidgets(input: {
  value: unknown;
  appId: string | undefined;
  framework: string | undefined;
  issues: ValidationIssues;
}): void {
  if (input.value === undefined) return;
  if (!Array.isArray(input.value)) {
    input.issues.add({
      path: '',
      message: 'Expected exportedWidgets to be an array.',
    });

    return;
  }
  const ids = new Set<string>();
  input.value.forEach((widgetValue, index) => {
    const issues = input.issues.at(String(index));
    const widget = asRecord(widgetValue);
    if (!widget) {
      issues.add({
        path: '',
        message: 'Expected exported widget to be an object.',
      });

      return;
    }
    requiredLiteral({
      record: widget,
      key: 'schemaVersion',
      expected: '1',
      issues,
    });
    requiredLiteral({
      record: widget,
      key: 'contractVersion',
      expected: ATLAS_WIDGET_CONTRACT_VERSION,
      issues,
    });
    const id = requiredUrlSafePathSegment({
      record: widget,
      key: 'id',
      label: 'widget id',
      issues,
    });
    requiredString({ record: widget, key: 'name', issues });
    requiredString({ record: widget, key: 'expose', issues });
    const ownerAppId = requiredUrlSafePathSegment({
      record: widget,
      key: 'ownerAppId',
      label: 'owner app id',
      issues,
    });
    if (ownerAppId && input.appId && ownerAppId !== input.appId)
      issues.add({
        path: 'ownerAppId',
        message: 'Expected ownerAppId to match the app id.',
      });
    const framework = requiredOneOf({
      record: widget,
      key: 'framework',
      allowed: ATLAS_FRAMEWORKS,
      issues,
    });
    if (framework && input.framework && framework !== input.framework)
      issues.add({
        path: 'framework',
        message: 'Expected framework to match the app framework.',
      });
    validateMetadata({ value: widget.metadata, path: 'metadata', issues });
    if (id)
      validateUniqueValue({
        value: id,
        path: 'id',
        label: 'exported widget id',
        seen: ids,
        issues,
      });
  });
}
