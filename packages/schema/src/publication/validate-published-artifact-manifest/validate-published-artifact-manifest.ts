import type { AtlasValidationIssue } from '../../errors/atlas-validation-issue.js';
import { ATLAS_DOM_ISOLATIONS } from '../../manifest/atlas-dom-isolation.js';
import { ATLAS_FRAMEWORKS } from '../../manifest/atlas-framework.js';
import { ATLAS_ALL_HOSTS } from '../../manifest/atlas-placement/atlas-placement.js';
import { ATLAS_PLACEMENT_KINDS } from '../../manifest/atlas-placement-kind.js';
import { ATLAS_ROUTE_MATCHES } from '../../manifest/atlas-route-contribution.js';
import { ATLAS_WIDGET_CONTRACT_VERSION } from '../../manifest/atlas-exported-widget-manifest.js';
import { assertNoIssues } from '../../validation/assert-valid.js';
import { convertDigestToIntegrity } from '../../validation/digest-to-integrity.js';
import { isRoutePattern } from '../../validation/route-pattern.js';
import { ValidationIssues } from '../../validation/validation-issues.js';
import {
  toRecord,
  readOptionalOneOf,
  readOptionalString,
  requireLiteral,
  readRequiredOneOf,
  readRequiredSafeRelativePath,
  readRequiredString,
  readRequiredUrlSafePathSegment,
  validateIntegerAtLeast,
  validateMetadata,
  validateSemanticVersionRange,
  readSha256Digest,
  validateSha256Integrity,
  validateUniqueValue,
  validateUrlSafePathSegment,
  type UnknownRecord,
} from '../../validation/validators.js';
import {
  ATLAS_ARTIFACT_MANIFEST_SCHEMA_VERSION,
  ATLAS_IMMUTABLE_CACHE_CONTROL,
  ATLAS_PAYLOAD_FILE_ROLES,
  type AtlasPublishedArtifactManifest,
} from '../atlas-publication.js';
import { validateReleaseVersion } from '../release-version/release-version.js';

const ARTIFACT_KINDS = ['app-artifact', 'host-artifact'] as const;
const MANIFEST_FILE_NAME = 'manifest.json';
const MEDIA_TYPE =
  /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+(?:\s*;\s*[^\s=;]+=[^;]+)*$/iu;

interface ValidatedPayloadFile {
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

  return issues.toArray();
}

/** Checks unknown JSON and throws unless it is a valid published artifact manifest. */
export function assertPublishedArtifactManifest(
  value: unknown,
): asserts value is AtlasPublishedArtifactManifest {
  const issues = ValidationIssues.create();
  collectPublishedArtifactManifestIssues({ value, issues });
  assertNoIssues({ issues, message: 'Invalid Atlas artifact manifest.' });
}

function collectPublishedArtifactManifestIssues(input: {
  value: unknown;
  issues: ValidationIssues;
}): void {
  const { issues } = input;
  const manifest = toRecord(input.value);

  if (!manifest) {
    issues.add({ path: '', message: 'Expected the manifest to be an object.' });

    return;
  }
  requireLiteral({
    record: manifest,
    key: 'schemaVersion',
    expected: ATLAS_ARTIFACT_MANIFEST_SCHEMA_VERSION,
    issues,
  });
  const kind = readRequiredOneOf({
    record: manifest,
    key: 'kind',
    allowed: ARTIFACT_KINDS,
    issues,
  });
  const id = readRequiredUrlSafePathSegment({
    record: manifest,
    key: 'id',
    label: 'artifact id',
    issues,
  });
  readRequiredString({ record: manifest, key: 'name', issues });
  readOptionalString({ record: manifest, key: 'packageName', issues });
  const entryPath = readRequiredSafeRelativePath({
    record: manifest,
    key: 'entryPath',
    issues,
  });
  const framework = readRequiredOneOf({
    record: manifest,
    key: 'framework',
    allowed: ATLAS_FRAMEWORKS,
    issues,
  });
  validateExposes({
    value: manifest.exposes,
    issues: issues.scopedTo('exposes'),
  });
  validateSource({ value: manifest.source, issues: issues.scopedTo('source') });
  validateReleaseOrPreviewIdentity({ manifest, issues });
  const files = validateFiles({
    value: manifest.files,
    entryPath,
    issues: issues.scopedTo('files'),
  });
  validateStyles({
    value: manifest.styles,
    files,
    issues: issues.scopedTo('styles'),
  });
  if (kind === 'app-artifact')
    validateAppArtifactFields({ manifest, appId: id, framework, issues });

  if (kind === 'host-artifact')
    validateHostArtifactFields({ manifest, issues });
}

function validateReleaseOrPreviewIdentity(input: {
  manifest: UnknownRecord;
  issues: ValidationIssues;
}): void {
  const release = toRecord(input.manifest.release);
  const preview = toRecord(input.manifest.preview);

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
    const issues = input.issues.scopedTo('preview');
    validateIntegerAtLeast({
      value: preview.number,
      path: 'number',
      label: 'preview number',
      minimum: 1,
      issues,
    });
    readRequiredString({ record: preview, key: 'gitSha', issues });
    readOptionalString({ record: preview, key: 'gitBranch', issues });
    readOptionalString({ record: preview, key: 'gitCommitTitle', issues });
  }
}

function validateExposes(input: {
  value: unknown;
  issues: ValidationIssues;
}): void {
  const exposes = toRecord(input.value);

  if (!exposes) {
    input.issues.add({
      path: '',
      message: 'Expected exposes to be an object.',
    });

    return;
  }
  readRequiredString({ record: exposes, key: 'entry', issues: input.issues });
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

  const source = toRecord(input.value);

  if (!source) {
    input.issues.add({ path: '', message: 'Expected source to be an object.' });

    return;
  }
  readOptionalString({ record: source, key: 'gitSha', issues: input.issues });
  readOptionalString({
    record: source,
    key: 'gitBranch',
    issues: input.issues,
  });
  readOptionalString({
    record: source,
    key: 'gitCommitTitle',
    issues: input.issues,
  });
}

function validateFiles(input: {
  value: unknown;
  entryPath: string | undefined;
  issues: ValidationIssues;
}): ValidatedPayloadFile[] {
  if (!Array.isArray(input.value)) {
    input.issues.add({ path: '', message: 'Expected files to be an array.' });

    return [];
  }
  const paths = new Set<string>();
  const files = input.value.map((fileValue, index) =>
    validateFile({
      value: fileValue,
      paths,
      issues: input.issues.scopedTo(String(index)),
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

  return files.filter(
    (file): file is ValidatedPayloadFile => file !== undefined,
  );
}

function validateFile(input: {
  value: unknown;
  paths: Set<string>;
  issues: ValidationIssues;
}): ValidatedPayloadFile | undefined {
  const { issues } = input;
  const file = toRecord(input.value);

  if (!file) {
    issues.add({
      path: '',
      message: 'Expected file descriptor to be an object.',
    });

    return undefined;
  }
  const path = readRequiredSafeRelativePath({
    record: file,
    key: 'path',
    issues,
  });
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
  const digest = readSha256Digest({
    value: file.digest,
    path: 'digest',
    issues,
  });
  validateIntegerAtLeast({
    value: file.size,
    path: 'size',
    label: 'file size',
    minimum: 0,
    issues,
  });
  const mediaType = readRequiredString({
    record: file,
    key: 'mediaType',
    issues,
  });
  if (mediaType && !MEDIA_TYPE.test(mediaType))
    issues.add({
      path: 'mediaType',
      message: 'Expected a media type such as text/javascript; charset=utf-8.',
    });
  requireLiteral({
    record: file,
    key: 'cacheControl',
    expected: ATLAS_IMMUTABLE_CACHE_CONTROL,
    issues,
  });
  const role = readRequiredOneOf({
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
  files: readonly ValidatedPayloadFile[];
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
    const issues = input.issues.scopedTo(String(index));
    const style = toRecord(styleValue);

    if (!style) {
      issues.add({
        path: '',
        message: 'Expected stylesheet descriptor to be an object.',
      });

      return;
    }
    const path = readRequiredSafeRelativePath({
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
      style.integrity !== convertDigestToIntegrity(digest)
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

function validateAppArtifactFields(input: {
  manifest: UnknownRecord;
  appId: string | undefined;
  framework: string | undefined;
  issues: ValidationIssues;
}): void {
  const { manifest, issues } = input;
  readOptionalOneOf({
    record: manifest,
    key: 'isolation',
    allowed: ATLAS_DOM_ISOLATIONS,
    issues,
  });
  const sdkRange = readRequiredString({
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
  const supportedHosts = validateUniqueUrlSafeIds({
    value: manifest.supportedHosts,
    label: 'supported host id',
    allowWildcard: true,
    issues: issues.scopedTo('supportedHosts'),
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
    issues: issues.scopedTo('placements'),
  });
  validateExportedWidgets({
    value: manifest.exportedWidgets,
    appId: input.appId,
    framework: input.framework,
    issues: issues.scopedTo('exportedWidgets'),
  });
  if (manifest.externalAppsDependencies !== undefined)
    validateUniqueUrlSafeIds({
      value: manifest.externalAppsDependencies,
      label: 'external app id',
      allowWildcard: false,
      issues: issues.scopedTo('externalAppsDependencies'),
    });
  validateMetadata({ value: manifest.metadata, path: 'metadata', issues });
}

function validateHostArtifactFields(input: {
  manifest: UnknownRecord;
  issues: ValidationIssues;
}): void {
  const loaderRange = readRequiredString({
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

function validateUniqueUrlSafeIds(input: {
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
    const issues = input.issues.scopedTo(String(index));
    const placement = toRecord(placementValue);

    if (!placement) {
      issues.add({ path: '', message: 'Expected placement to be an object.' });

      return;
    }
    const id = readRequiredUrlSafePathSegment({
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
    const kind = readRequiredOneOf({
      record: placement,
      key: 'kind',
      allowed: ATLAS_PLACEMENT_KINDS,
      issues,
    });
    if (kind === 'route')
      validateRoutePlacement({ placement, hostId, routePaths, issues });

    if (kind === 'slot') {
      readRequiredString({ record: placement, key: 'slot', issues });

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
  const hostId = readRequiredString({
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
  const route = toRecord(input.placement.route);
  const issues = input.issues.scopedTo('route');

  if (!route) {
    issues.add({
      path: '',
      message: 'Expected route details for a route placement.',
    });

    return;
  }
  const path = readRequiredString({ record: route, key: 'path', issues });

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
  readOptionalOneOf({
    record: route,
    key: 'match',
    allowed: ATLAS_ROUTE_MATCHES,
    issues,
  });
  const redirectTo = readOptionalString({
    record: route,
    key: 'redirectTo',
    issues,
  });
  if (redirectTo && !isRoutePattern(redirectTo))
    issues.add({
      path: 'redirectTo',
      message: 'Expected redirectTo to be an absolute route path.',
    });
  readOptionalString({ record: route, key: 'layoutId', issues });

  if (route.redirectTo !== undefined && route.layoutId !== undefined)
    issues.add({
      path: 'layoutId',
      message: 'Redirect routes must not define layoutId.',
    });
  readOptionalString({ record: route, key: 'title', issues });
  validateRouteNavigation({ value: route.nav, issues: issues.scopedTo('nav') });
}

function validateRouteNavigation(input: {
  value: unknown;
  issues: ValidationIssues;
}): void {
  if (input.value === undefined) return;

  const nav = toRecord(input.value);

  if (!nav) {
    input.issues.add({ path: '', message: 'Expected nav to be an object.' });

    return;
  }
  readRequiredString({ record: nav, key: 'label', issues: input.issues });

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
    const issues = input.issues.scopedTo(String(index));
    const widget = toRecord(widgetValue);

    if (!widget) {
      issues.add({
        path: '',
        message: 'Expected exported widget to be an object.',
      });

      return;
    }
    requireLiteral({
      record: widget,
      key: 'schemaVersion',
      expected: '1',
      issues,
    });
    requireLiteral({
      record: widget,
      key: 'contractVersion',
      expected: ATLAS_WIDGET_CONTRACT_VERSION,
      issues,
    });
    const id = readRequiredUrlSafePathSegment({
      record: widget,
      key: 'id',
      label: 'widget id',
      issues,
    });
    readRequiredString({ record: widget, key: 'name', issues });
    readRequiredString({ record: widget, key: 'expose', issues });
    const ownerAppId = readRequiredUrlSafePathSegment({
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
    const framework = readRequiredOneOf({
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
