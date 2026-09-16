import type { AtlasValidationIssue } from '../../errors/atlas-validation-issue.js';
import { ATLAS_DOM_ISOLATIONS } from '../atlas-dom-isolation.js';
import { ATLAS_FRAMEWORKS } from '../atlas-framework.js';
import { ATLAS_ALL_HOSTS } from '../atlas-placement/atlas-placement.js';
import { ATLAS_PLACEMENT_KINDS } from '../atlas-placement-kind.js';
import { ATLAS_ROUTE_MATCHES } from '../atlas-route-contribution.js';
import { ATLAS_VERSION_CHANNELS } from '../atlas-version-channel.js';
import {
  isRoutePattern,
  normalizeRoutePath,
} from '../../validation/route-pattern.js';
import { validateReleaseMetadata } from '../../validation/validate-release-metadata.js';
import { validateStyles } from '../../validation/validate-styles.js';
import { ValidationIssues } from '../../validation/validation-issues.js';
import {
  asRecord,
  optionalOneOf,
  optionalString,
  requiredIdentifier,
  requiredLiteral,
  requiredOneOf,
  requiredString,
  validateHttpUrl,
  validateIdentifier,
  validateMetadata,
  validateOptionalSha256Integrity,
  validateSemanticVersion,
  validateSemanticVersionRange,
  validateUniqueValue,
  type UnknownRecord,
} from '../../validation/validators.js';

export const ATLAS_MANIFEST_SCHEMA_VERSION = '1';
export const ATLAS_WIDGET_CONTRACT_VERSION = '1';

interface PlacementUniqueness {
  placementIds: Set<string>;
  routePaths: Set<string>;
}

/** Checks unknown JSON and returns all app manifest problems instead of throwing. */
export function validateAtlasManifest(value: unknown): AtlasValidationIssue[] {
  const issues = ValidationIssues.create();
  collectAtlasManifestIssues({ value, issues });

  return issues.list();
}

export function collectAtlasManifestIssues(input: {
  value: unknown;
  issues: ValidationIssues;
}): void {
  const { issues } = input;
  const manifest = asRecord(input.value);
  requiredLiteral({
    record: manifest,
    key: 'schemaVersion',
    expected: ATLAS_MANIFEST_SCHEMA_VERSION,
    issues,
  });
  requiredLiteral({ record: manifest, key: 'kind', expected: 'app', issues });
  const id = requiredIdentifier({
    record: manifest,
    key: 'id',
    label: 'app id',
    issues,
  });
  requiredString({ record: manifest, key: 'name', issues });
  requiredString({ record: manifest, key: 'buildId', issues });
  requiredString({ record: manifest, key: 'createdAt', issues });
  requiredOneOf({
    record: manifest,
    key: 'channel',
    allowed: ATLAS_VERSION_CHANNELS,
    issues,
  });
  const framework = requiredOneOf({
    record: manifest,
    key: 'framework',
    allowed: ATLAS_FRAMEWORKS,
    issues,
  });
  optionalOneOf({
    record: manifest,
    key: 'isolation',
    allowed: ATLAS_DOM_ISOLATIONS,
    issues,
  });
  const version = requiredString({ record: manifest, key: 'version', issues });
  if (version)
    validateSemanticVersion({ value: version, path: 'version', issues });
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
  const remoteEntryUrl = requiredString({
    record: manifest,
    key: 'remoteEntryUrl',
    issues,
  });
  if (remoteEntryUrl)
    validateHttpUrl({ value: remoteEntryUrl, path: 'remoteEntryUrl', issues });
  validateOptionalSha256Integrity({
    value: manifest?.integrity,
    path: 'integrity',
    issues,
  });
  validateReleaseMetadata({ record: manifest, issues });
  validateMetadata({ value: manifest?.metadata, path: 'metadata', issues });
  const supportedHosts = validateSupportedHosts({
    value: manifest?.supportedHosts,
    issues: issues.at('supportedHosts'),
  });
  validatePlacements({
    value: manifest?.placements,
    supportedHosts,
    issues: issues.at('placements'),
  });
  validateExposes({ value: manifest?.exposes, issues: issues.at('exposes') });
  validateStyles({ value: manifest?.styles, issues: issues.at('styles') });
  validateExportedWidgets({
    value: manifest?.exportedWidgets,
    ownerAppId: id,
    ownerFramework: framework,
    issues: issues.at('exportedWidgets'),
  });
  validateExternalAppDependencies({
    value: manifest?.externalAppsDependencies,
    issues: issues.at('externalAppsDependencies'),
  });
}

function validateSupportedHosts(input: {
  value: unknown;
  issues: ValidationIssues;
}): Set<string> | undefined {
  if (!Array.isArray(input.value) || input.value.length === 0) {
    input.issues.add({
      path: '',
      message: 'Expected at least one supported host id.',
    });

    return undefined;
  }
  const seen = new Set<string>();
  input.value.forEach((hostId, index) => {
    const path = String(index);
    if (typeof hostId !== 'string' || hostId.trim() === '') {
      input.issues.add({
        path,
        message: 'Expected supported host id to be a non-empty string.',
      });

      return;
    }
    if (hostId !== ATLAS_ALL_HOSTS)
      validateIdentifier({
        value: hostId,
        path,
        label: 'supported host id',
        issues: input.issues,
      });
    validateUniqueValue({
      value: hostId,
      path,
      label: 'supported host id',
      seen,
      issues: input.issues,
    });
  });
  if (seen.has(ATLAS_ALL_HOSTS) && seen.size > 1)
    input.issues.add({
      path: '',
      message: `Expected "${ATLAS_ALL_HOSTS}" to be the only supported host when present.`,
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
  const uniqueness: PlacementUniqueness = {
    placementIds: new Set(),
    routePaths: new Set(),
  };
  input.value.forEach((placement, index) =>
    validatePlacement({
      value: placement,
      supportedHosts: input.supportedHosts,
      uniqueness,
      issues: input.issues.at(String(index)),
    }),
  );
}

function validatePlacement(input: {
  value: unknown;
  supportedHosts: Set<string> | undefined;
  uniqueness: PlacementUniqueness;
  issues: ValidationIssues;
}): void {
  const { issues } = input;
  const placement = asRecord(input.value);
  const id = requiredIdentifier({
    record: placement,
    key: 'id',
    label: 'mount id',
    issues,
  });
  const hostId = validatePlacementHostId({
    record: placement,
    supportedHosts: input.supportedHosts,
    issues,
  });
  if (id && hostId)
    validateUniquePlacementId({
      id,
      hostId,
      placementIds: input.uniqueness.placementIds,
      issues,
    });
  const kind = requiredOneOf({
    record: placement,
    key: 'kind',
    allowed: ATLAS_PLACEMENT_KINDS,
    issues,
  });
  if (!placement) return;
  if (kind === 'route')
    validateRoutePlacement({
      placement,
      hostId,
      routePaths: input.uniqueness.routePaths,
      issues,
    });
  if (kind === 'slot') validateSlotPlacement({ placement, issues });
}

function validatePlacementHostId(input: {
  record: UnknownRecord | undefined;
  supportedHosts: Set<string> | undefined;
  issues: ValidationIssues;
}): string | undefined {
  const hostId = requiredString({
    record: input.record,
    key: 'hostId',
    issues: input.issues,
  });
  if (!hostId) return undefined;
  if (
    hostId !== ATLAS_ALL_HOSTS &&
    !validateIdentifier({
      value: hostId,
      path: 'hostId',
      label: 'host id',
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
  optionalString({ record: route, key: 'title', issues });
  const layoutId = optionalString({ record: route, key: 'layoutId', issues });
  if (layoutId)
    validateIdentifier({
      value: layoutId,
      path: 'layoutId',
      label: 'layout id',
      issues,
    });
  optionalOneOf({
    record: route,
    key: 'match',
    allowed: ATLAS_ROUTE_MATCHES,
    issues,
  });
  if (route.redirectTo !== undefined) {
    if (
      typeof route.redirectTo !== 'string' ||
      !isRoutePattern(route.redirectTo)
    )
      issues.add({
        path: 'redirectTo',
        message: 'Expected redirectTo to be an absolute route path.',
      });
    if (route.layoutId !== undefined)
      issues.add({
        path: 'layoutId',
        message: 'Redirect routes must not define layoutId.',
      });
  }
  if (path && !isRoutePattern(path))
    issues.add({
      path: 'path',
      message:
        'Expected an absolute route pattern with static segments, :params, or a final * wildcard.',
    });
  if (input.hostId && path)
    validateUniqueRoutePath({
      path,
      hostId: input.hostId,
      routePaths: input.routePaths,
      issues,
    });
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

function validateSlotPlacement(input: {
  placement: UnknownRecord;
  issues: ValidationIssues;
}): void {
  requiredString({
    record: input.placement,
    key: 'slot',
    issues: input.issues,
  });
  if (input.placement.route !== undefined)
    input.issues.add({
      path: 'route',
      message: 'Slot placements must not define a route.',
    });
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

function validateExportedWidgets(input: {
  value: unknown;
  ownerAppId: string | undefined;
  ownerFramework: string | undefined;
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
  input.value.forEach((widget, index) =>
    validateExportedWidget({
      value: widget,
      ownerAppId: input.ownerAppId,
      ownerFramework: input.ownerFramework,
      ids,
      issues: input.issues.at(String(index)),
    }),
  );
}

function validateExportedWidget(input: {
  value: unknown;
  ownerAppId: string | undefined;
  ownerFramework: string | undefined;
  ids: Set<string>;
  issues: ValidationIssues;
}): void {
  const { issues } = input;
  const widget = asRecord(input.value);
  requiredLiteral({
    record: widget,
    key: 'schemaVersion',
    expected: ATLAS_MANIFEST_SCHEMA_VERSION,
    issues,
  });
  requiredLiteral({
    record: widget,
    key: 'contractVersion',
    expected: ATLAS_WIDGET_CONTRACT_VERSION,
    issues,
  });
  const id = requiredIdentifier({
    record: widget,
    key: 'id',
    label: 'widget id',
    issues,
  });
  requiredString({ record: widget, key: 'name', issues });
  requiredString({ record: widget, key: 'expose', issues });
  const ownerAppId = requiredIdentifier({
    record: widget,
    key: 'ownerAppId',
    label: 'owner app id',
    issues,
  });
  if (ownerAppId && input.ownerAppId && ownerAppId !== input.ownerAppId)
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
  if (framework && input.ownerFramework && framework !== input.ownerFramework)
    issues.add({
      path: 'framework',
      message: 'Expected framework to match the app framework.',
    });
  const remoteEntryUrl = requiredString({
    record: widget,
    key: 'remoteEntryUrl',
    issues,
  });
  if (remoteEntryUrl)
    validateHttpUrl({ value: remoteEntryUrl, path: 'remoteEntryUrl', issues });
  validateMetadata({ value: widget?.metadata, path: 'metadata', issues });
  if (id)
    validateUniqueValue({
      value: id,
      path: 'id',
      label: 'exported widget id',
      seen: input.ids,
      issues,
    });
}

function validateExternalAppDependencies(input: {
  value: unknown;
  issues: ValidationIssues;
}): void {
  if (input.value === undefined) return;
  if (!Array.isArray(input.value)) {
    input.issues.add({
      path: '',
      message: 'Expected externalAppsDependencies to be an array.',
    });

    return;
  }
  const appIds = new Set<string>();
  input.value.forEach((appId, index) => {
    const path = String(index);
    if (typeof appId !== 'string' || appId.trim() === '') {
      input.issues.add({ path, message: 'Expected an external app id.' });

      return;
    }
    const valid = validateIdentifier({
      value: appId,
      path,
      label: 'external app id',
      issues: input.issues,
    });
    if (valid)
      validateUniqueValue({
        value: appId,
        path,
        label: 'external app dependency',
        seen: appIds,
        issues: input.issues,
      });
  });
}

function validateUniquePlacementId(input: {
  id: string;
  hostId: string;
  placementIds: Set<string>;
  issues: ValidationIssues;
}): void {
  const placementKey = `${input.hostId}\0${input.id}`;
  if (input.placementIds.has(placementKey))
    input.issues.add({
      path: 'id',
      message: `Duplicate mount id "${input.id}" for host "${input.hostId}". Mount ids only need to be unique within the same host. If this came from atlas.config.ts slots, do not repeat the same slotId for the same hostId; use a different slotId or hostId.`,
    });
  input.placementIds.add(placementKey);
}

function validateUniqueRoutePath(input: {
  path: string;
  hostId: string;
  routePaths: Set<string>;
  issues: ValidationIssues;
}): void {
  const normalizedPath = normalizeRoutePath(input.path);
  const routeKey = `${input.hostId}\0${normalizedPath}`;
  if (input.routePaths.has(routeKey))
    input.issues.add({
      path: 'path',
      message: `Duplicate route path "${normalizedPath}" for host "${input.hostId}". In atlas.config.ts routes, each hostId can use a path only once. Use a different path or hostId.`,
    });
  input.routePaths.add(routeKey);
}
