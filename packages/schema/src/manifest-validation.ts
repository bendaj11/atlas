import type { AtlasValidationIssue } from "./atlas-validation-issue.js";
import {
  addIssue,
  asRecord,
  isOneOf,
  joinPath,
  requiredString,
  validateHttpUrl,
  validateIdentifier,
  validateMetadata,
  validateSemanticVersion,
  validateSemanticVersionRange,
  validateSha256Integrity,
  type UnknownRecord
} from "./validation.js";
import { validateArtifactReleaseMetadata } from "./validate-artifact-release-metadata.js";

const FRAMEWORKS = ["angular", "react", "vue"] as const;

interface PlacementUniqueness {
  placementIds: Set<string>;
  routeBasePaths: Set<string>;
}

export function validateManifest(value: unknown, prefix?: string): AtlasValidationIssue[] {
  const issues: AtlasValidationIssue[] = [];
  const manifest = asRecord(value);
  const path = (child: string): string => joinPath(prefix, child);

  for (const key of ["schemaVersion", "kind", "id", "name", "version", "buildId", "channel", "framework", "remoteEntryUrl", "requiredHostSdkVersion", "createdAt"]) {
    requiredString(manifest, key, issues, prefix);
  }
  validateIdentifier(manifest?.id, path("id"), "app id", issues);

  if (manifest?.schemaVersion !== "1") addIssue(issues, path("schemaVersion"), "Expected schemaVersion to be \"1\".");
  if (manifest?.kind !== "app") addIssue(issues, path("kind"), "Expected kind to be app.");
  if (!isOneOf(manifest?.channel, ["production", "pr", "local"])) addIssue(issues, path("channel"), "Expected channel to be production, pr, or local.");
  if (!isOneOf(manifest?.framework, FRAMEWORKS)) addIssue(issues, path("framework"), "Expected framework to be angular, react, or vue.");
  if (manifest?.isolation !== undefined && !isOneOf(manifest.isolation, ["scoped", "shadow-dom"])) addIssue(issues, path("isolation"), "Expected isolation to be scoped or shadow-dom.");

  validateSemanticVersion(manifest?.version, path("version"), issues);
  validateSemanticVersionRange(manifest?.requiredHostSdkVersion, path("requiredHostSdkVersion"), issues);
  validateHttpUrl(manifest?.remoteEntryUrl, path("remoteEntryUrl"), issues);
  validateSha256Integrity(manifest?.integrity, path("integrity"), issues);
  validateArtifactReleaseMetadata(manifest, path, issues);
  validateMetadata(manifest?.metadata, path("metadata"), issues);
  validateSupportedHosts(manifest?.supportedHosts, path("supportedHosts"), issues);
  validatePlacements(manifest?.placements, path("placements"), issues);
  validateExposes(manifest?.exposes, path("exposes"), issues);
  validateStyles(manifest?.styles, path("styles"), issues);
  validateExportedWidgets(manifest, path("exportedWidgets"), issues);
  validateExternalAppDependencies(manifest?.externalAppsDependencies, path("externalAppsDependencies"), issues);
  return issues;
}

function validateSupportedHosts(value: unknown, path: string, issues: AtlasValidationIssue[]): void {
  if (!Array.isArray(value) || value.length === 0) {
    addIssue(issues, path, "Expected at least one supported host id.");
    return;
  }
  validateUniqueIdentifiers(value, path, "supported host id", issues, "*");
}

function validatePlacements(value: unknown, path: string, issues: AtlasValidationIssue[]): void {
  if (!Array.isArray(value)) {
    addIssue(issues, path, "Expected placements to be an array.");
    return;
  }
  const uniqueness: PlacementUniqueness = { placementIds: new Set(), routeBasePaths: new Set() };
  value.forEach((placement, index) => validatePlacement(placement, `${path}.${index}`, uniqueness, issues));
}

function validatePlacement(value: unknown, path: string, uniqueness: PlacementUniqueness, issues: AtlasValidationIssue[]): void {
  const placement = asRecord(value);
  const id = requiredString(placement, "id", issues, path);
  const hostId = requiredString(placement, "hostId", issues, path);
  if (id) validateIdentifier(id, `${path}.id`, "mount id", issues);
  if (hostId) validateIdentifier(hostId, `${path}.hostId`, "host id", issues);
  if (id && hostId) validateUniquePlacementId({ id, hostId, path: `${path}.id`, placementIds: uniqueness.placementIds, issues });

  if (!isOneOf(placement?.kind, ["route", "slot"])) {
    addIssue(issues, `${path}.kind`, "Expected placement kind to be route or slot.");
    return;
  }
  if (placement.kind === "route") validateRoutePlacement({ placement, hostId, path, routeBasePaths: uniqueness.routeBasePaths, issues });
  else validateSlotPlacement(placement, path, issues);
}

function validateRoutePlacement(input: { placement: UnknownRecord; hostId: string | undefined; path: string; routeBasePaths: Set<string>; issues: AtlasValidationIssue[] }): void {
  if (input.placement.slot !== undefined) addIssue(input.issues, `${input.path}.slot`, "Route placements must not define a slot.");
  const route = asRecord(input.placement.route);
  if (!route) {
    addIssue(input.issues, `${input.path}.route`, "Expected route details for a route placement.");
    return;
  }
  const basePath = requiredString(route, "basePath", input.issues, `${input.path}.route`);
  if (route.title !== undefined) requiredString(route, "title", input.issues, `${input.path}.route`);
  if (basePath && (!basePath.startsWith("/") || basePath.includes("?") || basePath.includes("#"))) {
    addIssue(input.issues, `${input.path}.route.basePath`, "Expected an absolute route path without a query or fragment.");
  }
  if (input.hostId && basePath) validateUniqueRouteBasePath({ basePath, hostId: input.hostId, path: `${input.path}.route.basePath`, routeBasePaths: input.routeBasePaths, issues: input.issues });
  validateNavigation(route.nav, `${input.path}.route.nav`, input.issues);
}

function validateNavigation(value: unknown, path: string, issues: AtlasValidationIssue[]): void {
  if (value === undefined) return;
  const nav = asRecord(value);
  if (!nav) {
    addIssue(issues, path, "Expected nav to be an object.");
    return;
  }
  requiredString(nav, "label", issues, path);
  if (nav.order !== undefined && (typeof nav.order !== "number" || !Number.isFinite(nav.order))) addIssue(issues, `${path}.order`, "Expected order to be a finite number.");
  if (nav.visible !== undefined && typeof nav.visible !== "boolean") addIssue(issues, `${path}.visible`, "Expected visible to be a boolean.");
}

function validateSlotPlacement(placement: UnknownRecord, path: string, issues: AtlasValidationIssue[]): void {
  requiredString(placement, "slot", issues, path);
  if (placement.route !== undefined) addIssue(issues, `${path}.route`, "Slot placements must not define a route.");
}

function validateExposes(value: unknown, path: string, issues: AtlasValidationIssue[]): void {
  const exposes = asRecord(value);
  if (!exposes) {
    addIssue(issues, path, "Expected exposes to be an object.");
    return;
  }
  requiredString(exposes, "entry", issues, path);
  for (const [name, expose] of Object.entries(exposes)) {
    if (typeof expose !== "string" || expose.trim() === "") addIssue(issues, `${path}.${name}`, "Expected expose path to be a non-empty string.");
  }
}

function validateStyles(value: unknown, path: string, issues: AtlasValidationIssue[]): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    addIssue(issues, path, "Expected styles to be an array.");
    return;
  }
  const hrefs = new Set<string>();
  value.forEach((stylesheet, index) => {
    const itemPath = `${path}.${index}`;
    const style = asRecord(stylesheet);
    const href = requiredString(style, "href", issues, itemPath);
    if (href) {
      validateHttpUrl(href, `${itemPath}.href`, issues);
      validateUniqueValue(href, `${itemPath}.href`, "stylesheet href", hrefs, issues);
    }
    validateSha256Integrity(style?.integrity, `${itemPath}.integrity`, issues);
  });
}

function validateExportedWidgets(manifest: UnknownRecord | undefined, path: string, issues: AtlasValidationIssue[]): void {
  const value = manifest?.exportedWidgets;
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    addIssue(issues, path, "Expected exportedWidgets to be an array.");
    return;
  }
  const ids = new Set<string>();
  value.forEach((widget, index) => validateExportedWidget(widget, manifest?.id, `${path}.${index}`, ids, issues));
}

function validateExportedWidget(value: unknown, ownerId: unknown, path: string, ids: Set<string>, issues: AtlasValidationIssue[]): void {
  const widget = asRecord(value);
  const id = requiredString(widget, "id", issues, path);
  requiredString(widget, "name", issues, path);
  const ownerAppId = requiredString(widget, "ownerAppId", issues, path);
  requiredString(widget, "framework", issues, path);
  const remoteEntryUrl = requiredString(widget, "remoteEntryUrl", issues, path);
  requiredString(widget, "expose", issues, path);
  if (id) validateIdentifier(id, `${path}.id`, "widget id", issues);
  if (ownerAppId) validateIdentifier(ownerAppId, `${path}.ownerAppId`, "owner app id", issues);
  if (widget?.schemaVersion !== "1") addIssue(issues, `${path}.schemaVersion`, "Expected schemaVersion to be \"1\".");
  if (widget?.contractVersion !== "1") addIssue(issues, `${path}.contractVersion`, "Expected contractVersion to be \"1\".");
  if (widget?.ownerAppId !== ownerId) addIssue(issues, `${path}.ownerAppId`, "Expected ownerAppId to match the app id.");
  if (!isOneOf(widget?.framework, FRAMEWORKS)) addIssue(issues, `${path}.framework`, "Expected a supported framework.");
  if (remoteEntryUrl) validateHttpUrl(remoteEntryUrl, `${path}.remoteEntryUrl`, issues);
  validateMetadata(widget?.metadata, `${path}.metadata`, issues);
  if (id) validateUniqueValue(id, `${path}.id`, "exported widget id", ids, issues);
}

function validateExternalAppDependencies(value: unknown, path: string, issues: AtlasValidationIssue[]): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    addIssue(issues, path, "Expected externalAppsDependencies to be an array.");
    return;
  }
  const appIds = new Set<string>();
  value.forEach((appId, index) => {
    const itemPath = `${path}.${index}`;
    if (typeof appId !== "string") {
      addIssue(issues, itemPath, "Expected an external app id.");
      return;
    }
    if (validateIdentifier(appId, itemPath, "external app id", issues)) {
      validateUniqueValue(appId, itemPath, "external app dependency", appIds, issues);
    }
  });
}

function validateUniqueIdentifiers(values: unknown[], path: string, label: string, issues: AtlasValidationIssue[], allowedSpecialValue?: string): void {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    const itemPath = `${path}.${index}`;
    if (typeof value !== "string" || value.trim() === "") addIssue(issues, itemPath, `Expected ${label} to be a non-empty string.`);
    else {
      if (value !== allowedSpecialValue) validateIdentifier(value, itemPath, label, issues);
      validateUniqueValue(value, itemPath, label, seen, issues);
    }
  });
}

function validateUniqueValue(value: string, path: string, label: string, seen: Set<string>, issues: AtlasValidationIssue[]): void {
  if (seen.has(value)) addIssue(issues, path, `Duplicate ${label} \"${value}\".`);
  seen.add(value);
}

function validateUniquePlacementId(input: { id: string; hostId: string; path: string; placementIds: Set<string>; issues: AtlasValidationIssue[] }): void {
  const placementKey = `${input.hostId}\0${input.id}`;
  if (input.placementIds.has(placementKey)) {
    addIssue(input.issues, input.path, `Duplicate mount id \"${input.id}\" for host \"${input.hostId}\". Mount ids only need to be unique within the same host. If this came from atlas.config.ts slots, do not repeat the same slotId for the same hostId; use a different slotId or hostId.`);
  }
  input.placementIds.add(placementKey);
}

function validateUniqueRouteBasePath(input: { basePath: string; hostId: string; path: string; routeBasePaths: Set<string>; issues: AtlasValidationIssue[] }): void {
  const normalizedBasePath = normalizeRoutePath(input.basePath);
  const routeKey = `${input.hostId}\0${normalizedBasePath}`;
  if (input.routeBasePaths.has(routeKey)) {
    addIssue(input.issues, input.path, `Duplicate route basePath \"${normalizedBasePath}\" for host \"${input.hostId}\". In atlas.config.ts routes, each hostId can use a basePath only once. Use a different basePath or hostId.`);
  }
  input.routeBasePaths.add(routeKey);
}

function normalizeRoutePath(path: string): string {
  return path === "/" ? path : path.replace(/\/+$/, "");
}
