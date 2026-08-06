import type { AtlasValidationIssue } from "./atlas-validation-issue.js";
import { validateManifest } from "./manifest-validation.js";
import { validateAtlasHostManifest } from "./validate-atlas-host-manifest.js";
import { addIssue, asRecord, requiredString, validateIdentifier } from "./validation.js";

export function validateHostCatalog(value: unknown): AtlasValidationIssue[] {
  const issues: AtlasValidationIssue[] = [];
  const catalog = asRecord(value);
  requiredString(catalog, "schemaVersion", issues);
  const hostId = requiredString(catalog, "hostId", issues);
  if (hostId) validateIdentifier(hostId, "hostId", "host id", issues);
  requiredString(catalog, "generatedAt", issues);
  requiredString(catalog, "revision", issues);
  if (catalog?.schemaVersion !== "1") addIssue(issues, "schemaVersion", "Expected schemaVersion to be \"1\".");
  issues.push(...validateAtlasHostManifest(catalog?.host).map((issue) => ({ ...issue, path: `host.${issue.path}` })));
  const host = asRecord(catalog?.host);
  if (hostId && typeof host?.id === "string" && host.id !== hostId) addIssue(issues, "host.id", "Expected selected host id to match catalog hostId.");
  if (!Array.isArray(catalog?.apps)) {
    addIssue(issues, "apps", "Expected apps to be an array.");
    return issues;
  }

  catalog.apps.forEach((manifest, index) => issues.push(...validateManifest(manifest, `apps.${index}`)));
  validateUniqueManifestIds(catalog.apps, issues);
  validateHeadlessAppTargets(catalog, issues);
  if (catalog.widgetProviders !== undefined) {
    if (!Array.isArray(catalog.widgetProviders)) addIssue(issues, "widgetProviders", "Expected widgetProviders to be an array.");
    else {
      catalog.widgetProviders.forEach((manifest, index) => issues.push(...validateManifest(manifest, `widgetProviders.${index}`)));
      validateUniqueManifestIds(catalog.widgetProviders, issues, "widgetProviders");
    }
  }
  return issues;
}

function validateHeadlessAppTargets(catalog: ReturnType<typeof asRecord>, issues: AtlasValidationIssue[]): void {
  const host = asRecord(catalog?.host);
  const headlessApps = Array.isArray(host?.headlessApps) ? host.headlessApps : [];
  const appIds = new Set<string>();
  const routePaths = new Set<string>();
  const hostId = typeof catalog?.hostId === "string" ? catalog.hostId : undefined;

  ((catalog?.apps as unknown[] | undefined) ?? []).forEach((manifestValue) => {
    const manifest = asRecord(manifestValue);
    if (typeof manifest?.id === "string") appIds.add(manifest.id);
    if (!hostId || !Array.isArray(manifest?.placements)) return;
    manifest.placements.forEach((placementValue) => {
      const placement = asRecord(placementValue);
      const route = asRecord(placement?.route);
      if (placement?.kind !== "route" || placement.hostId !== hostId || typeof route?.path !== "string") return;
      routePaths.add(normalizePath(route.path));
    });
  });

  headlessApps.forEach((headlessApp, index) => {
    const app = asRecord(headlessApp);
    const path = `host.headlessApps.${index}`;
    if (typeof app?.id === "string" && appIds.has(app.id))
      addIssue(issues, `${path}.id`, `Headless app id "${app.id}" conflicts with selected app id "${app.id}".`);
    if (typeof app?.path === "string" && routePaths.has(normalizePath(app.path)))
      addIssue(issues, `${path}.path`, `Headless app path "${normalizePath(app.path)}" conflicts with a selected app route.`);
  });
}

function normalizePath(path: string): string {
  return path === "/" ? path : path.replace(/\/+$/, "");
}

function validateUniqueManifestIds(manifests: unknown[], issues: AtlasValidationIssue[], path = "apps"): void {
  const manifestIds = new Set<string>();
  manifests.forEach((manifestValue, manifestIndex) => {
    const manifest = asRecord(manifestValue);
    if (typeof manifest?.id !== "string") return;
    if (manifestIds.has(manifest.id)) {
      addIssue(issues, `${path}.${manifestIndex}.id`, `Duplicate app id "${manifest.id}".`);
    } else {
      manifestIds.add(manifest.id);
    }
  });
}
