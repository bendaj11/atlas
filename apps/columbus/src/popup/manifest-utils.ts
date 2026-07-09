import type { AtlasExtensionManifest as Manifest, AtlasHostData as HostData } from "../contracts.js";
import { supportsHost, uniqueVersions, versionKey } from "../manifest-versions.js";
import { CUSTOM_BUILD_ID, CUSTOM_VERSION } from "./constants.js";
import type { BadgeSkin } from "@wix/design-system";
import type { EditorDraft, OverrideType } from "./types.js";

export function createAppViewModel(
  production: Manifest,
  activeOverrides: Map<string, Manifest>,
  savedDisabledOverrides: Map<string, Manifest>
) {
  const selected = activeOverrides.get(production.id);

  return {
    production,
    selected,
    overrideType: overrideTypeFor(production, selected),
    currentUrl: (selected ?? production).remoteEntryUrl ? baseUrlFromRemoteEntry((selected ?? production).remoteEntryUrl) : "",
    overrideEnabled: Boolean(selected),
    canToggle: Boolean(selected) || savedDisabledOverrides.has(production.id)
  };
}

export function createEditorDraft(
  production: Manifest | undefined,
  selected: Manifest | undefined,
  productionOptions: Manifest[],
  prOptions: Manifest[]
): EditorDraft {
  const type = selected ? overrideTypeFor(production ?? selected, selected) : "custom";
  const selectedType = type === "none" ? "custom" : type;

  return {
    type: selectedType,
    customUrl: selected?.channel === "local" ? baseUrlFromRemoteEntry(selected.remoteEntryUrl) : baseUrlFromRemoteEntry(production?.remoteEntryUrl ?? ""),
    productionKey: versionKeyOrEmpty(selectedType === "production" && selected ? selected : productionOptions[0] ?? production),
    prKey: versionKeyOrEmpty(selectedType === "pr" && selected ? selected : prOptions[0])
  };
}

export function selectedManifest({ production, draft, productionOptions, prOptions }: {
  production: Manifest;
  draft: EditorDraft;
  productionOptions: Manifest[];
  prOptions: Manifest[];
}): Manifest | undefined {
  if (draft.type === "custom") return customManifest(production, draft.customUrl);
  if (draft.type === "production") return productionOptions.find((manifest) => versionKey(manifest) === draft.productionKey);
  return prOptions.find((manifest) => versionKey(manifest) === draft.prKey);
}

export function customManifest(production: Manifest, rawUrl: string): Manifest {
  const baseUrl = normalizeBaseUrl(rawUrl);

  if (!baseUrl) throw new Error("Enter base URL.");

  try {
    const url = new URL(baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
  } catch {
    throw new Error("Base URL must be absolute HTTP URL.");
  }

  return {
    ...production,
    version: CUSTOM_VERSION,
    buildId: CUSTOM_BUILD_ID,
    channel: "local",
    remoteEntryUrl: `${baseUrl}/remoteEntry.json`
  };
}

export function productionVersions(hostData: HostData, production: Manifest): Manifest[] {
  const versions = hostData.versions[production.id] ?? [];
  return uniqueVersions([production, ...versions]).filter((manifest) => manifest.channel !== "local" && manifest.channel !== "pr");
}

export function prVersions(hostData: HostData, production: Manifest): Manifest[] {
  return uniqueVersions(hostData.versions[production.id] ?? []).filter((manifest) => manifest.channel === "pr");
}

export function overrideTypeFor(production: Manifest, selected: Manifest | undefined): OverrideType {
  if (!selected || versionKey(selected) === versionKey(production)) return "none";
  if (selected.channel === "local") return "custom";
  if (selected.channel === "pr") return "pr";
  return "production";
}

export function overrideLabel(type: OverrideType): string {
  if (type === "custom") return "Custom";
  if (type === "production") return "Production";
  if (type === "pr") return "PR";
  return "None";
}

export function badgeSkin(type: OverrideType): BadgeSkin {
  if (type === "none") return "neutralStandard";
  if (type === "custom") return "warning";
  if (type === "pr") return "premium";
  return "standard";
}

export function versionLabel(manifest: Manifest): string {
  if (manifest.channel === "pr") return `${manifest.version} (pr #${manifest.prNumber ?? "unknown"})`;
  return manifest.version;
}

export function versionDisabled(manifest: Manifest, hostId: string): boolean {
  return !supportsHost(manifest, hostId);
}

function baseUrlFromRemoteEntry(remoteEntryUrl: string): string {
  return normalizeBaseUrl(remoteEntryUrl);
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/remoteEntry\.json$/u, "").replace(/\/$/u, "");
}

function versionKeyOrEmpty(manifest: Manifest | undefined): string {
  return manifest ? versionKey(manifest) : "";
}
