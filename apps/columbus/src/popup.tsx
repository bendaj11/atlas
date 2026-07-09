import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import WsrBadge from "wix-style-react/dist/es/src/Badge";
import WsrBox from "wix-style-react/dist/es/src/Box";
import WsrButton from "wix-style-react/dist/es/src/Button";
import WsrCard from "wix-style-react/dist/es/src/Card";
import WsrDivider from "wix-style-react/dist/es/src/Divider";
import WsrDropdown from "wix-style-react/dist/es/src/Dropdown";
import WsrInput from "wix-style-react/dist/es/src/Input";
import WsrLoader from "wix-style-react/dist/es/src/Loader";
import WsrRadioGroup from "wix-style-react/dist/es/src/RadioGroup";
import WsrText from "wix-style-react/dist/es/src/Text";
import WsrToggleSwitch from "wix-style-react/dist/es/src/ToggleSwitch";
import WsrProvider from "wix-style-react/dist/es/src/WixStyleReactProvider";
import "./popup.css";
import type { AtlasExtensionManifest as Manifest, AtlasHostData as HostData, AtlasOverrideDocument as OverrideDocument } from "./contracts.js";
import { supportsHost, uniqueVersions, versionKey } from "./manifest-versions.js";

const Badge = WsrBadge as unknown as React.ComponentType<Record<string, unknown>>;
const Box = WsrBox as unknown as React.ComponentType<Record<string, unknown>>;
const Button = WsrButton as unknown as React.ComponentType<Record<string, unknown>>;
const Card = WsrCard as unknown as React.ComponentType<Record<string, unknown>> & {
  Content: React.ComponentType<Record<string, unknown>>;
  Header: React.ComponentType<Record<string, unknown>>;
};
const Divider = WsrDivider as unknown as React.ComponentType<Record<string, unknown>>;
const Dropdown = WsrDropdown as unknown as React.ComponentType<Record<string, unknown>>;
const Input = WsrInput as unknown as React.ComponentType<Record<string, unknown>>;
const Loader = WsrLoader as unknown as React.ComponentType<Record<string, unknown>>;
const RadioGroup = WsrRadioGroup as unknown as React.ComponentType<Record<string, unknown>> & {
  Radio: React.ComponentType<Record<string, unknown>>;
};
const Text = WsrText as unknown as React.ComponentType<Record<string, unknown>>;
const ToggleSwitch = WsrToggleSwitch as unknown as React.ComponentType<Record<string, unknown>>;
const WixStyleReactProvider = WsrProvider as unknown as React.ComponentType<Record<string, unknown>>;

const DOCUMENT_KEY = "atlas.runtime-overrides";
const URL_KEY = "atlas.runtime-override-url";
const CUSTOM_BUILD_ID = "custom-url";
const CUSTOM_VERSION = "custom-url";

type OverrideType = "none" | "custom" | "production" | "pr";
type Scope = "all" | "tab";
type StatusTone = "standard" | "error";
type View = { name: "dashboard" } | { name: "editor"; appId: string };

interface AppViewModel {
  production: Manifest;
  selected: Manifest | undefined;
  overrideType: OverrideType;
  currentUrl: string;
  overrideEnabled: boolean;
}

interface EditorDraft {
  type: Exclude<OverrideType, "none">;
  customUrl: string;
  productionKey: string;
  prKey: string;
}

interface StatusState {
  busy: boolean;
  message: string;
  tone: StatusTone;
}

const activeOverrides = new Map<string, Manifest>();
const savedDisabledOverrides = new Map<string, Manifest>();

function PopupApp(): JSX.Element {
  const [hostData, setHostData] = useState<HostData>();
  const [activeTabId, setActiveTabId] = useState<number>();
  const [view, setView] = useState<View>({ name: "dashboard" });
  const [scope, setScope] = useState<Scope>("all");
  const [status, setStatus] = useState<StatusState>({ busy: true, message: "Reading active Atlas host...", tone: "standard" });
  const [revision, setRevision] = useState(0);

  const reloadDashboard = (): void => {
    setView({ name: "dashboard" });
    setRevision((value) => value + 1);
  };

  const load = async (): Promise<void> => {
    setStatus({ busy: true, message: "Reading active Atlas host...", tone: "standard" });
    let inspectedTabId = activeTabId;
    try {
      const tab = await findInspectableHostTab();
      inspectedTabId = tab.id;
      setActiveTabId(tab.id);
      const [injection] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN",
        func: inspectAtlasHost
      });
      if (!injection?.result) throw new Error("Active page did not return Atlas runtime information.");
      const data = injection.result;
      if (!data.overrides) {
        const key = `atlas.overrides.${data.config.hostId}`;
        const persisted = await chrome.storage.local.get(key);
        data.overrides = persisted[key] as OverrideDocument | undefined;
      }
      activeOverrides.clear();
      for (const override of data.overrides?.overrides ?? []) activeOverrides.set(override.mfId, override.manifest);
      await updateActionBadge(tab.id, activeOverrides.size);
      setHostData(data);
      setScope(data.overrideScope === "tab" ? "tab" : "all");
      setView({ name: "dashboard" });
      const errorCount = data.runtimeErrors.length + data.versionErrors.length;
      const runtimeNote = errorCount ? ` · ${errorCount} warning${errorCount === 1 ? "" : "s"}` : "";
      setStatus({ busy: false, message: `${data.catalog.manifests.length} apps discovered${runtimeNote}`, tone: errorCount ? "error" : "standard" });
    } catch (error) {
      if (inspectedTabId) await updateActionBadge(inspectedTabId, 0);
      setStatus({ busy: false, message: errorMessage(error), tone: "error" });
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const persistActiveOverrides = async (): Promise<void> => {
    if (!activeTabId || !hostData) return;
    setStatus({ busy: true, message: "Applying overrides...", tone: "standard" });
    const documentValue = createOverrideDocument(hostData, activeOverrides);
    try {
      await updateActionBadge(activeTabId, documentValue.overrides.length);
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
    } catch (error) {
      setStatus({ busy: false, message: errorMessage(error), tone: "error" });
    }
  };

  const toggleOverride = async (appId: string): Promise<void> => {
    const active = activeOverrides.get(appId);
    if (active) {
      savedDisabledOverrides.set(appId, active);
      activeOverrides.delete(appId);
    } else {
      const disabled = savedDisabledOverrides.get(appId);
      if (!disabled) return;
      activeOverrides.set(appId, disabled);
    }
    setRevision((value) => value + 1);
    await persistActiveOverrides();
  };

  return (
    <WixStyleReactProvider>
      <Box className="popup-shell" direction="vertical" backgroundColor="D80" minHeight="100vh">
        <Box padding="16px" direction="vertical" gap="14px">
          <StatusCard hostId={hostData?.config.hostId} status={status} onRefresh={() => void load()} />
          <ScopePicker value={scope} disabled={status.busy} onChange={setScope} />
          {view.name === "dashboard" ? (
            <Dashboard
              hostData={hostData}
              revision={revision}
              busy={status.busy}
              onEdit={(appId) => setView({ name: "editor", appId })}
              onToggle={(appId) => void toggleOverride(appId)}
            />
          ) : (
            <Editor
              appId={view.appId}
              hostData={hostData}
              busy={status.busy}
              onCancel={reloadDashboard}
              onSave={(manifest) => {
                if (!hostData) return;
                savedDisabledOverrides.delete(manifest.production.id);
                if (manifest.selected && versionKey(manifest.selected) !== versionKey(manifest.production)) activeOverrides.set(manifest.production.id, manifest.selected);
                else activeOverrides.delete(manifest.production.id);
                void persistActiveOverrides();
              }}
              onError={(message) => setStatus({ busy: false, message, tone: "error" })}
            />
          )}
        </Box>
      </Box>
    </WixStyleReactProvider>
  );
}

function StatusCard({ hostId, status, onRefresh }: { hostId: string | undefined; status: StatusState; onRefresh: () => void }): JSX.Element {
  return (
    <Card className="status-card">
      <Card.Content>
        <Box verticalAlign="middle" gap="12px" minWidth="0">
          {status.busy ? <Loader size="tiny" /> : <Badge skin={status.tone === "error" ? "danger" : "success"}>{status.tone === "error" ? "Issue" : "Ready"}</Badge>}
          <Box direction="vertical" flex="1" minWidth="0">
            <Text size="small" weight="bold" ellipsis>{hostId ?? "No host"}</Text>
            <Text size="tiny" skin={status.tone === "error" ? "error" : "standard"} ellipsis>{status.message}</Text>
          </Box>
          <Button size="small" priority="secondary" disabled={status.busy} onClick={onRefresh} aria-label="Refresh host data">Refresh</Button>
        </Box>
      </Card.Content>
    </Card>
  );
}

function ScopePicker({ value, disabled, onChange }: { value: Scope; disabled: boolean; onChange: (value: Scope) => void }): JSX.Element {
  return (
    <Card className="scope-card">
      <Card.Content>
        <Box verticalAlign="middle" gap="12px">
          <Text weight="bold">Apply overrides to</Text>
          <RadioGroup value={value} disabled={disabled} display="horizontal" onChange={(nextValue: Scope) => onChange(nextValue)}>
            <RadioGroup.Radio value="all">All tabs</RadioGroup.Radio>
            <RadioGroup.Radio value="tab">This tab</RadioGroup.Radio>
          </RadioGroup>
        </Box>
      </Card.Content>
    </Card>
  );
}

function Dashboard({ hostData, revision, busy, onEdit, onToggle }: {
  hostData: HostData | undefined;
  revision: number;
  busy: boolean;
  onEdit: (appId: string) => void;
  onToggle: (appId: string) => void;
}): JSX.Element {
  const apps = useMemo(() => hostData?.catalog.manifests.map((manifest) => createAppViewModel(manifest)) ?? [], [hostData, revision]);
  if (!hostData) return <EmptyFrame title="No Atlas host" message="Open an Atlas host tab, then refresh." />;
  return (
    <Box direction="vertical" gap="12px">
      {apps.map((app) => (
        <Card key={app.production.id} className="app-card">
          <Card.Content>
            <Box verticalAlign="middle" gap="12px" minWidth="0">
              <Box direction="vertical" flex="1" minWidth="0">
                <Text weight="bold" ellipsis>{app.production.name}</Text>
                <Text className="app-url" size="tiny" secondary>{app.currentUrl}</Text>
              </Box>
              <Badge skin={badgeSkin(app.overrideType)}>{overrideLabel(app.overrideType)}</Badge>
              <Box className="app-actions" gap="8px" verticalAlign="middle">
                <ToggleSwitch
                  size="small"
                  checked={app.overrideEnabled}
                  disabled={busy || (!app.selected && !savedDisabledOverrides.has(app.production.id))}
                  onChange={() => onToggle(app.production.id)}
                  aria-label={`${app.selected ? "Disable" : "Enable"} ${app.production.name} override`}
                />
                <Button
                  size="small"
                  priority="secondary"
                  disabled={busy}
                  onClick={() => onEdit(app.production.id)}
                >
                  Edit
                </Button>
              </Box>
            </Box>
          </Card.Content>
        </Card>
      ))}
    </Box>
  );
}

function Editor({ appId, hostData, busy, onCancel, onSave, onError }: {
  appId: string;
  hostData: HostData | undefined;
  busy: boolean;
  onCancel: () => void;
  onSave: (value: { production: Manifest; selected: Manifest | undefined }) => void;
  onError: (message: string) => void;
}): JSX.Element {
  const production = hostData?.catalog.manifests.find((manifest) => manifest.id === appId);
  const selected = production ? activeOverrides.get(appId) ?? savedDisabledOverrides.get(appId) : undefined;
  const productionOptions = useMemo(() => production && hostData ? productionVersions(hostData, production) : [], [hostData, production]);
  const prOptions = useMemo(() => production && hostData ? prVersions(hostData, production) : [], [hostData, production]);
  const [draft, setDraft] = useState<EditorDraft>(() => createEditorDraft(production, selected, productionOptions, prOptions));

  useEffect(() => {
    setDraft(createEditorDraft(production, selected, productionOptions, prOptions));
  }, [appId, production, selected, productionOptions, prOptions]);

  if (!hostData || !production) return <EmptyFrame title="App missing" message="Refresh host data and try again." />;

  const save = (): void => {
    try {
      onSave({ production, selected: selectedManifest({ production, draft, productionOptions, prOptions }) });
    } catch (error) {
      onError(errorMessage(error));
    }
  };

  return (
    <Card>
      <Card.Header
        title={production.name}
        subtitle="Choose source"
        suffix={<Button size="small" priority="secondary" onClick={onCancel}>Back</Button>}
      />
      <Card.Content>
        <Box direction="vertical" gap="18px">
          <RadioGroup value={draft.type} onChange={(nextValue: EditorDraft["type"]) => setDraft({ ...draft, type: nextValue })}>
            <EditorRow active={draft.type === "custom"}>
              <RadioGroup.Radio value="custom">Base URL</RadioGroup.Radio>
              <Input
                id="custom-url"
                ariaLabel="Base URL"
                value={draft.customUrl}
                disabled={draft.type !== "custom"}
                placeholder="http://localhost:4513"
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, customUrl: event.target.value })}
              />
            </EditorRow>
            <EditorRow active={draft.type === "production"}>
              <RadioGroup.Radio value="production">Production</RadioGroup.Radio>
              <VersionDropdown
                id="production-version"
                ariaLabel="Production"
                disabled={draft.type !== "production"}
                selectedId={draft.productionKey}
                versions={productionOptions}
                hostId={hostData.config.hostId}
                onChange={(productionKey) => setDraft({ ...draft, productionKey })}
              />
            </EditorRow>
            <EditorRow active={draft.type === "pr"}>
              <RadioGroup.Radio value="pr">PR</RadioGroup.Radio>
              <VersionDropdown
                id="pr-version"
                ariaLabel="PR"
                disabled={draft.type !== "pr"}
                selectedId={draft.prKey}
                versions={prOptions}
                hostId={hostData.config.hostId}
                onChange={(prKey) => setDraft({ ...draft, prKey })}
              />
            </EditorRow>
          </RadioGroup>
          <Divider />
          <Box align="right" gap="8px">
            <Button priority="secondary" disabled={busy} onClick={onCancel}>Cancel</Button>
            <Button disabled={busy} onClick={save}>Save</Button>
          </Box>
        </Box>
      </Card.Content>
    </Card>
  );
}

function EditorRow({ active, children }: { active: boolean; children: React.ReactNode }): JSX.Element {
  return (
    <Box className="editor-option" direction="vertical" gap="8px" opacity={active ? 1 : 0.56}>
      {children}
    </Box>
  );
}

function VersionDropdown({ id, ariaLabel, disabled, selectedId, versions, hostId, onChange }: {
  id: string;
  ariaLabel: string;
  disabled: boolean;
  selectedId: string;
  versions: Manifest[];
  hostId: string;
  onChange: (value: string) => void;
}): JSX.Element {
  return (
    <Dropdown
      id={id}
      ariaLabel={ariaLabel}
      disabled={disabled || versions.length === 0}
      selectedId={selectedId}
      placeholder="No versions found"
      options={versions.map((manifest) => ({
        id: versionKey(manifest),
        value: versionLabel(manifest),
        disabled: !supportsHost(manifest, hostId)
      }))}
      onSelect={(option: { id: string }) => onChange(option.id)}
    />
  );
}

function EmptyFrame({ title, message }: { title: string; message: string }): JSX.Element {
  return (
    <Card>
      <Card.Content>
        <Box direction="vertical" gap="6px">
          <Text weight="bold">{title}</Text>
          <Text size="small" secondary>{message}</Text>
        </Box>
      </Card.Content>
    </Card>
  );
}

async function findInspectableHostTab(): Promise<chrome.tabs.Tab & { id: number; url: string }> {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (isInspectableTab(activeTab)) return activeTab;

  const tabs = await chrome.tabs.query({ currentWindow: true });
  const candidates = tabs.filter(isInspectableTab).sort((first, second) => (second.lastAccessed ?? 0) - (first.lastAccessed ?? 0));
  const tab = candidates[0];
  if (!tab) throw new Error("Open an Atlas host in the active tab first.");
  return tab;
}

function isInspectableTab(tab: chrome.tabs.Tab | undefined): tab is chrome.tabs.Tab & { id: number; url: string } {
  return typeof tab?.id === "number" && typeof tab.url === "string" && tab.url.startsWith("http");
}

function createOverrideDocument(hostData: HostData, overrides: Map<string, Manifest>): OverrideDocument {
  return {
    schemaVersion: "1",
    hostId: hostData.config.hostId,
    generatedAt: new Date().toISOString(),
    overrides: [...overrides].map(([mfId, manifest]) => ({ mfId, manifest, reason: overrideReason(manifest) }))
  };
}

function createAppViewModel(production: Manifest): AppViewModel {
  const selected = activeOverrides.get(production.id);
  return {
    production,
    selected,
    overrideType: overrideTypeFor(production, selected),
    currentUrl: (selected ?? production).remoteEntryUrl
      ? baseUrlFromRemoteEntry((selected ?? production).remoteEntryUrl)
      : "",
    overrideEnabled: Boolean(selected)
  };
}

function createEditorDraft(
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

function versionKeyOrEmpty(manifest: Manifest | undefined): string {
  return manifest ? versionKey(manifest) : "";
}

function selectedManifest({ production, draft, productionOptions, prOptions }: {
  production: Manifest;
  draft: EditorDraft;
  productionOptions: Manifest[];
  prOptions: Manifest[];
}): Manifest | undefined {
  if (draft.type === "custom") return customManifest(production, draft.customUrl);
  if (draft.type === "production") return productionOptions.find((manifest) => versionKey(manifest) === draft.productionKey);
  return prOptions.find((manifest) => versionKey(manifest) === draft.prKey);
}

function customManifest(production: Manifest, rawUrl: string): Manifest {
  const baseUrl = normalizeBaseUrl(rawUrl);
  if (!baseUrl) throw new Error("Enter base URL.");
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
  } catch {
    throw new Error("Base URL must be absolute HTTP URL.");
  }
  const remoteEntryUrl = `${baseUrl}/remoteEntry.json`;
  return { ...production, version: CUSTOM_VERSION, buildId: CUSTOM_BUILD_ID, channel: "local", remoteEntryUrl };
}

function baseUrlFromRemoteEntry(remoteEntryUrl: string): string {
  return normalizeBaseUrl(remoteEntryUrl);
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/remoteEntry\.json$/u, "").replace(/\/$/u, "");
}

async function updateActionBadge(tabId: number, overrideCount: number): Promise<void> {
  await chrome.action.setBadgeBackgroundColor({ color: "#116dff" });
  await chrome.action.setBadgeText({ tabId, text: overrideCount > 0 ? String(overrideCount) : "" });
}

function overrideTypeFor(production: Manifest, selected: Manifest | undefined): OverrideType {
  if (!selected || versionKey(selected) === versionKey(production)) return "none";
  if (selected.channel === "local") return "custom";
  if (selected.channel === "pr") return "pr";
  return "production";
}

function productionVersions(hostData: HostData, production: Manifest): Manifest[] {
  const versions = hostData.versions[production.id] ?? [];
  return uniqueVersions([production, ...versions]).filter((manifest) => manifest.channel !== "local" && manifest.channel !== "pr");
}

function prVersions(hostData: HostData, production: Manifest): Manifest[] {
  return uniqueVersions(hostData.versions[production.id] ?? []).filter((manifest) => manifest.channel === "pr");
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
  let overrideScope: Scope | undefined;
  const tabStored = sessionStorage.getItem("atlas.runtime-overrides");
  const stored = tabStored ?? localStorage.getItem("atlas.runtime-overrides");
  if (tabStored) overrideScope = "tab";
  else if (stored) overrideScope = "all";
  if (stored) {
    try { overrides = JSON.parse(stored) as OverrideDocument; } catch { /* SDK reports malformed documents during host boot. */ }
  }
  const runtimeErrors = [...document.querySelectorAll<HTMLElement>('[data-atlas-state="error"]')]
    .map((element) => element.textContent?.trim() || element.getAttribute("data-atlas-mf") || "Unknown app error");
  return { config, catalog, versions: Object.fromEntries(entries), overrides, overrideScope, runtimeErrors, versionErrors };
}

function persistOverrides(documentKey: string, urlKey: string, value: string, scope: Scope): void {
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

function overrideReason(manifest: Manifest): "local" | "pr" | "historical" {
  if (manifest.channel === "local") return "local";
  if (manifest.channel === "pr") return "pr";
  return "historical";
}

function overrideLabel(type: OverrideType): string {
  if (type === "custom") return "Custom URL";
  if (type === "production") return "Production version";
  if (type === "pr") return "PR version";
  return "None";
}

function badgeSkin(type: OverrideType): string {
  if (type === "none") return "neutralStandard";
  if (type === "custom") return "warning";
  if (type === "pr") return "premium";
  return "standard";
}

function versionLabel(manifest: Manifest): string {
  if (manifest.channel === "pr") return `${manifest.version} (pr #${manifest.prNumber ?? "unknown"})`;
  return manifest.version;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing extension element #root.");
createRoot(root).render(<PopupApp />);
