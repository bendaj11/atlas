import type { AtlasValidationIssue } from "./index.js";
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

const FRAMEWORKS = ["angular", "react", "vue"] as const;

export function validateManifest(value: unknown, prefix?: string): AtlasValidationIssue[] {
  const issues: AtlasValidationIssue[] = [];
  const manifest = asRecord(value);
  const path = (child: string): string => joinPath(prefix, child);

  for (const key of ["schemaVersion", "id", "name", "version", "buildId", "channel", "framework", "remoteEntryUrl", "requiredHostSdkVersion", "createdAt"]) {
    requiredString(manifest, key, issues, prefix);
  }
  validateIdentifier(manifest?.id, path("id"), "MF id", issues);

  if (manifest?.schemaVersion !== "1") addIssue(issues, path("schemaVersion"), "Expected schemaVersion to be \"1\".");
  if (!isOneOf(manifest?.channel, ["production", "pr", "historical", "local"])) addIssue(issues, path("channel"), "Expected channel to be production, pr, historical, or local.");
  if (!isOneOf(manifest?.framework, FRAMEWORKS)) addIssue(issues, path("framework"), "Expected framework to be angular, react, or vue.");
  if (manifest?.isolation !== undefined && !isOneOf(manifest.isolation, ["scoped", "shadow-dom"])) addIssue(issues, path("isolation"), "Expected isolation to be scoped or shadow-dom.");

  validateSemanticVersion(manifest?.version, path("version"), issues);
  validateSemanticVersionRange(manifest?.requiredHostSdkVersion, path("requiredHostSdkVersion"), issues);
  validateHttpUrl(manifest?.remoteEntryUrl, path("remoteEntryUrl"), issues);
  validateSha256Integrity(manifest?.integrity, path("integrity"), issues);
  validateMetadata(manifest?.metadata, path("metadata"), issues);
  validateSupportedHosts(manifest?.supportedHosts, path("supportedHosts"), issues);
  validatePlacements(manifest?.placements, path("placements"), issues);
  validateExposes(manifest?.exposes, path("exposes"), issues);
  validateStyles(manifest?.styles, path("styles"), issues);
  validateExportedComponents(manifest, path("exportedComponents"), issues);
  validateUses(manifest?.uses, path("uses"), issues);
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
  const ids = new Set<string>();
  value.forEach((placement, index) => validatePlacement(placement, `${path}.${index}`, ids, issues));
}

function validatePlacement(value: unknown, path: string, ids: Set<string>, issues: AtlasValidationIssue[]): void {
  const placement = asRecord(value);
  const id = requiredString(placement, "id", issues, path);
  const hostId = requiredString(placement, "hostId", issues, path);
  if (id) validateIdentifier(id, `${path}.id`, "placement id", issues);
  if (hostId) validateIdentifier(hostId, `${path}.hostId`, "host id", issues);
  if (id) validateUniqueValue(id, `${path}.id`, "placement id", ids, issues);

  if (!isOneOf(placement?.kind, ["route", "slot"])) {
    addIssue(issues, `${path}.kind`, "Expected placement kind to be route or slot.");
    return;
  }
  if (placement.kind === "route") validateRoutePlacement(placement, path, issues);
  else validateSlotPlacement(placement, path, issues);
}

function validateRoutePlacement(placement: UnknownRecord, path: string, issues: AtlasValidationIssue[]): void {
  if (placement.slot !== undefined) addIssue(issues, `${path}.slot`, "Route placements must not define a slot.");
  const route = asRecord(placement.route);
  if (!route) {
    addIssue(issues, `${path}.route`, "Expected route details for a route placement.");
    return;
  }
  const routeId = requiredString(route, "id", issues, `${path}.route`);
  if (routeId) validateIdentifier(routeId, `${path}.route.id`, "route id", issues);
  const basePath = requiredString(route, "basePath", issues, `${path}.route`);
  requiredString(route, "title", issues, `${path}.route`);
  if (basePath && (!basePath.startsWith("/") || basePath.includes("?") || basePath.includes("#"))) {
    addIssue(issues, `${path}.route.basePath`, "Expected an absolute route path without a query or fragment.");
  }
  validateNavigation(route.nav, `${path}.route.nav`, issues);
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

function validateExportedComponents(manifest: UnknownRecord | undefined, path: string, issues: AtlasValidationIssue[]): void {
  const value = manifest?.exportedComponents;
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    addIssue(issues, path, "Expected exportedComponents to be an array.");
    return;
  }
  const ids = new Set<string>();
  value.forEach((component, index) => validateExportedComponent(component, manifest?.id, `${path}.${index}`, ids, issues));
}

function validateExportedComponent(value: unknown, ownerId: unknown, path: string, ids: Set<string>, issues: AtlasValidationIssue[]): void {
  const component = asRecord(value);
  const id = requiredString(component, "id", issues, path);
  requiredString(component, "name", issues, path);
  const ownerMfId = requiredString(component, "ownerMfId", issues, path);
  requiredString(component, "framework", issues, path);
  const remoteEntryUrl = requiredString(component, "remoteEntryUrl", issues, path);
  requiredString(component, "expose", issues, path);
  if (id) validateIdentifier(id, `${path}.id`, "component id", issues);
  if (ownerMfId) validateIdentifier(ownerMfId, `${path}.ownerMfId`, "owner MF id", issues);
  if (component?.schemaVersion !== "1") addIssue(issues, `${path}.schemaVersion`, "Expected schemaVersion to be \"1\".");
  if (component?.contractVersion !== "1") addIssue(issues, `${path}.contractVersion`, "Expected contractVersion to be \"1\".");
  if (component?.ownerMfId !== ownerId) addIssue(issues, `${path}.ownerMfId`, "Expected ownerMfId to match the MF id.");
  if (!isOneOf(component?.framework, FRAMEWORKS)) addIssue(issues, `${path}.framework`, "Expected a supported framework.");
  if (remoteEntryUrl) validateHttpUrl(remoteEntryUrl, `${path}.remoteEntryUrl`, issues);
  validateMetadata(component?.metadata, `${path}.metadata`, issues);
  if (id) validateUniqueValue(id, `${path}.id`, "exported component id", ids, issues);
}

function validateUses(value: unknown, path: string, issues: AtlasValidationIssue[]): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    addIssue(issues, path, "Expected uses to be an array.");
    return;
  }
  const references = new Set<string>();
  value.forEach((reference, index) => {
    const itemPath = `${path}.${index}`;
    if (typeof reference !== "string" || !/^[^/]+\/[^/]+$/.test(reference)) {
      addIssue(issues, itemPath, "Expected a widget reference in owner-mf/widget-id format.");
      return;
    }
    const [ownerMfId, componentId] = reference.split("/");
    const ownerIsValid = validateIdentifier(ownerMfId, itemPath, "widget owner MF id", issues);
    const componentIsValid = validateIdentifier(componentId, itemPath, "widget component id", issues);
    if (ownerIsValid && componentIsValid) validateUniqueValue(reference, itemPath, "widget reference", references, issues);
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
