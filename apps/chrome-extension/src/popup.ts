import type { AtlasExtensionManifest as Manifest, AtlasHostData as HostData, AtlasOverrideDocument as OverrideDocument, AtlasRuntimeOverride as Override } from "./contracts.js";
import { assertExtensionManifest, supportsHost, uniqueVersions, versionKey } from "./manifest-versions.js";

const DOCUMENT_KEY = "atlas.runtime-overrides";
const URL_KEY = "atlas.runtime-override-url";
const model = new Map<string, Manifest>();
let hostData: HostData | undefined;
let activeTabId: number | undefined;

const hostName = requireElement<HTMLElement>("host-name");
const statusElement = requireElement<HTMLElement>("status");
const statusText = requireElement<HTMLElement>("status-text");
const versions = requireElement<HTMLElement>("versions");
const localMf = requireElement<HTMLSelectElement>("local-mf");
const localUrl = requireElement<HTMLInputElement>("local-url");
const applyButton = requireElement<HTMLButtonElement>("apply");
const clearButton = requireElement<HTMLButtonElement>("clear");
const refreshButton = requireElement<HTMLButtonElement>("refresh");
const addLocalButton = requireElement<HTMLButtonElement>("add-local");
const scopeInputs = [...document.querySelectorAll<HTMLInputElement>('input[name="scope"]')];

refreshButton.addEventListener("click", () => { void load(); });
applyButton.addEventListener("click", () => { void apply(); });
clearButton.addEventListener("click", () => {
  model.clear();
  render();
  setBusy(false, "Production selected. Apply to update the host.");
});
addLocalButton.addEventListener("click", () => { void addLocal(); });

void load();

async function load(): Promise<void> {
  setBusy(true, "Reading the active Atlas host...");
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab?.id || !tab.url?.startsWith("http")) throw new Error("Open an Atlas host in the active tab first.");
    activeTabId = tab.id;
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: inspectAtlasHost
    });
    if (!injection?.result) throw new Error("The active page did not return Atlas runtime information.");
    hostData = injection.result;
    if (!hostData.overrides) {
      const key = `atlas.overrides.${hostData.config.hostId}`;
      const persisted = await chrome.storage.local.get(key);
      hostData.overrides = persisted[key] as OverrideDocument | undefined;
    }
    model.clear();
    for (const override of hostData.overrides?.overrides ?? []) model.set(override.mfId, override.manifest);
    if (hostData.overrideScope === "tab") setScope("tab");
    render();
    const errorCount = hostData.runtimeErrors.length + hostData.versionErrors.length;
    const runtimeNote = errorCount ? ` · ${errorCount} warning${errorCount === 1 ? "" : "s"}` : "";
    setBusy(false, `${hostData.catalog.manifests.length} microfrontends discovered${runtimeNote}`);
    if (errorCount) statusElement.dataset.tone = "error";
  } catch (error) {
    setError(error);
  }
}

function render(): void {
  versions.replaceChildren();
  localMf.replaceChildren();
  if (!hostData) return;
  hostName.textContent = hostData.config.hostId;
  for (const production of hostData.catalog.manifests) {
    const section = document.createElement("article");
    section.className = "mf";
    const row = document.createElement("div");
    row.className = "mf-row";
    const name = document.createElement("span");
    name.className = "mf-name";
    name.textContent = production.name;
    const framework = document.createElement("span");
    framework.className = "framework";
    framework.textContent = production.framework;
    row.append(name, framework);

    const select = document.createElement("select");
    select.setAttribute("aria-label", `${production.name} version`);
    const candidates = uniqueVersions([production, ...(hostData.versions[production.id] ?? []), ...(model.has(production.id) ? [model.get(production.id)!] : [])]);
    for (const manifest of candidates) {
      const option = document.createElement("option");
      option.value = versionKey(manifest);
      option.textContent = manifest.channel === "production" ? `${manifest.version} (production)` : `${manifest.version} (${manifest.channel}${manifest.prNumber ? ` #${manifest.prNumber}` : ""})`;
      option.disabled = !supportsHost(manifest, hostData.config.hostId);
      option.selected = versionKey(model.get(production.id) ?? production) === option.value;
      select.append(option);
    }
    select.addEventListener("change", () => {
      const selected = candidates.find((candidate) => versionKey(candidate) === select.value)!;
      if (selected.channel === "production" && versionKey(selected) === versionKey(production)) model.delete(production.id);
      else model.set(production.id, selected);
      render();
    });
    const note = document.createElement("div");
    note.className = "note";
    const selected = model.get(production.id) ?? production;
    note.textContent = `${selected.id}@${selected.version} · ${selected.buildId}`;
    section.append(row, select, note);
    versions.append(section);

    const mfOption = document.createElement("option");
    mfOption.value = production.id;
    mfOption.textContent = production.name;
    localMf.append(mfOption);
  }
  applyButton.disabled = false;
  clearButton.disabled = model.size === 0;
}

async function addLocal(): Promise<void> {
  if (!activeTabId || !hostData) return;
  const mfId = localMf.value;
  const url = localUrl.value.trim();
  if (!url) return setError(new Error("Enter a local manifest URL."));
  setBusy(true, "Validating local manifest...");
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: activeTabId },
      world: "MAIN",
      func: fetchManifest,
      args: [url]
    });
    const fetched = injection?.result;
    const manifest = fetched && "overrides" in fetched
      ? fetched.overrides.find((override: Override) => override.mfId === mfId)?.manifest
      : fetched;
    if (!manifest || manifest.id !== mfId) throw new Error(`The manifest must belong to "${mfId}".`);
    assertExtensionManifest(manifest);
    model.set(mfId, { ...manifest, channel: "local" });
    localUrl.value = "";
    render();
    setBusy(false, `Local ${mfId} manifest is ready to apply`);
  } catch (error) { setError(error); }
}

async function apply(): Promise<void> {
  if (!activeTabId || !hostData) return;
  setBusy(true, "Applying overrides...");
  const documentValue: OverrideDocument = {
    schemaVersion: "1",
    hostId: hostData.config.hostId,
    generatedAt: new Date().toISOString(),
    overrides: [...model].map(([mfId, manifest]) => ({ mfId, manifest, reason: manifest.channel === "local" ? "local" : manifest.channel === "pr" ? "pr" : "historical" }))
  };
  try {
    const scope = selectedScope();
    const storageKey = `atlas.overrides.${hostData.config.hostId}`;
    if (scope === "all" && documentValue.overrides.length) await chrome.storage.local.set({ [storageKey]: documentValue });
    if (scope === "all" && !documentValue.overrides.length) await chrome.storage.local.remove(storageKey);
    await chrome.scripting.executeScript({
      target: { tabId: activeTabId },
      world: "MAIN",
      func: persistOverrides,
      args: [DOCUMENT_KEY, URL_KEY, JSON.stringify(documentValue), scope]
    });
    await chrome.tabs.reload(activeTabId);
    window.close();
  } catch (error) { setError(error); }
}

async function inspectAtlasHost(): Promise<HostData> {
  const configResponse = await fetch("/atlas.runtime.json", { cache: "no-store" });
  if (!configResponse.ok) throw new Error(`Atlas runtime configuration returned ${configResponse.status}.`);
  const config = await configResponse.json() as HostData["config"];
  if (config.schemaVersion !== "1" || !config.hostId || !config.catalogUrl) throw new Error("This page does not expose a valid Atlas runtime configuration.");
  const catalogUrl = new URL(config.catalogUrl, location.href);
  const catalogResponse = await fetch(catalogUrl, { cache: "no-store" });
  if (!catalogResponse.ok) throw new Error(`Atlas catalog returned ${catalogResponse.status}.`);
  const catalog = await catalogResponse.json() as HostData["catalog"];
  const hostsMarker = "/hosts/";
  const markerIndex = catalogUrl.pathname.indexOf(hostsMarker);
  if (markerIndex < 0) throw new Error("Atlas catalog URL does not identify a static Atlas registry.");
  const registryRoot = `${catalogUrl.origin}${catalogUrl.pathname.slice(0, markerIndex)}`;
  const versionErrors: string[] = [];
  const entries = await Promise.all(catalog.manifests.map(async (manifest) => {
    try {
      const response = await fetch(`${registryRoot}/microfrontends/${encodeURIComponent(manifest.id)}/index.json`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Version lookup for ${manifest.id} returned ${response.status}.`);
      const index = await response.json() as { manifests?: Manifest[] };
      if (!Array.isArray(index.manifests)) throw new Error(`Version lookup for ${manifest.id} returned an invalid index.`);
      return [manifest.id, index.manifests] as const;
    } catch (error) {
      versionErrors.push(error instanceof Error ? error.message : String(error));
      return [manifest.id, [manifest]] as const;
    }
  }));
  let overrides: OverrideDocument | undefined;
  let overrideScope: "all" | "tab" | undefined;
  const tabStored = sessionStorage.getItem("atlas.runtime-overrides");
  const stored = tabStored ?? localStorage.getItem("atlas.runtime-overrides");
  if (tabStored) overrideScope = "tab";
  else if (stored) overrideScope = "all";
  if (stored) {
    try { overrides = JSON.parse(stored) as OverrideDocument; } catch { /* SDK reports malformed documents during host boot. */ }
  }
  const runtimeErrors = [...document.querySelectorAll<HTMLElement>('[data-atlas-state="error"]')]
    .map((element) => element.textContent?.trim() || element.getAttribute("data-atlas-mf") || "Unknown MF error");
  return { config, catalog, versions: Object.fromEntries(entries), overrides, overrideScope, runtimeErrors, versionErrors };
}

async function fetchManifest(url: string): Promise<Manifest | OverrideDocument> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Local manifest returned ${response.status}.`);
  return response.json() as Promise<Manifest | OverrideDocument>;
}

function persistOverrides(documentKey: string, urlKey: string, value: string, scope: "all" | "tab"): void {
  const documentValue = JSON.parse(value) as OverrideDocument;
  if (scope === "all") {
    if (documentValue.overrides.length) localStorage.setItem(documentKey, value);
    else localStorage.removeItem(documentKey);
    sessionStorage.removeItem(documentKey);
  } else {
    sessionStorage.setItem(documentKey, value);
  }
  localStorage.removeItem(urlKey);
  const url = new URL(location.href);
  url.searchParams.delete("atlas-override");
  history.replaceState(history.state, "", url);
}

function selectedScope(): "all" | "tab" {
  return scopeInputs.find((input) => input.checked)?.value === "tab" ? "tab" : "all";
}

function setScope(scope: "all" | "tab"): void {
  for (const input of scopeInputs) input.checked = input.value === scope;
}

function setBusy(busy: boolean, message: string): void {
  statusText.textContent = message;
  statusElement.dataset.busy = String(busy);
  statusElement.dataset.tone = "";
  applyButton.disabled = busy || !hostData;
  refreshButton.disabled = busy;
  addLocalButton.disabled = busy;
}

function setError(value: unknown): void {
  const error = value instanceof Error ? value : new Error(String(value));
  statusText.textContent = error.message;
  statusElement.dataset.busy = "false";
  statusElement.dataset.tone = "error";
  applyButton.disabled = !hostData;
  refreshButton.disabled = false;
  addLocalButton.disabled = false;
}

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing extension element #${id}.`);
  return element as T;
}
