import { useCallback, useMemo, useRef, useState } from "react";
import { artifactKey, type AtlasExtensionManifest as Manifest, type AtlasHostData as HostData } from "../contracts.js";
import {
  createOverrideDocument,
  errorMessage,
  readDisabledOverrides,
  readHostData,
  updateActionBadge,
  writeDisabledOverrides,
  writeOverrides
} from "./atlas-host.js";
import { createAppViewModel, normalizeStoredManifest, prVersions, productionVersions } from "./manifest-utils.js";
import type { AppViewModel, EditorModel, SaveOverrideValue, Scope, StatusState, View } from "./types.js";

const readingStatus: StatusState = { busy: true, message: "Reading active Atlas host...", tone: "standard" };
const applyingStatus: StatusState = { busy: true, message: "Applying overrides...", tone: "standard" };

export function usePopupController() {
  const [hostData, setHostData] = useState<HostData>();
  const [activeTabId, setActiveTabId] = useState<number>();
  const [view, setView] = useState<View>({ name: "dashboard" });
  const [scope, setScope] = useState<Scope>("all");
  const [status, setStatus] = useState<StatusState>(readingStatus);
  const [revision, setRevision] = useState(0);
  const activeOverrides = useRef(new Map<string, Manifest>());
  const savedDisabledOverrides = useRef(new Map<string, Manifest>());
  const applying = useRef(false);

  const load = useCallback(async (): Promise<void> => {
    setStatus(readingStatus);

    try {
      const result = await readHostData(activeTabId);
      const documentValue = result.hostData.overrides;
      const selectedOverrides = [
        ...(documentValue?.host ? [documentValue.host.manifest] : []),
        ...(documentValue?.apps ?? []).map((override) => override.manifest)
      ];
      activeOverrides.current = new Map(selectedOverrides.map((manifest) => [artifactKey(manifest), normalizeStoredManifest(manifest)]));
      const loadedScope = result.hostData.overrideScope === "tab" ? "tab" : "all";
      savedDisabledOverrides.current = await readDisabledOverrides(result.hostData.config.hostId, result.tabId, loadedScope);
      includeDisabledApps(result.hostData, savedDisabledOverrides.current);
      setActiveTabId(result.tabId);
      setHostData(result.hostData);
      setScope(loadedScope);
      setView({ name: "dashboard" });
      setRevision((value) => value + 1);
      setStatus(hostReadyStatus(result.hostData));
    } catch (error) {
      if (activeTabId) await updateActionBadge(activeTabId, 0);
      setHostData(undefined);
      setStatus({ busy: false, message: errorMessage(error), tone: "error" });
    }
  }, [activeTabId]);

  const persistActiveOverrides = useCallback(async (): Promise<void> => {
    if (!activeTabId || !hostData || applying.current) return;

    applying.current = true;
    setStatus(applyingStatus);

    try {
      await writeDisabledOverrides({
        hostId: hostData.config.hostId,
        tabId: activeTabId,
        scope,
        overrides: savedDisabledOverrides.current
      });
      const documentValue = createOverrideDocument(hostData, activeOverrides.current);
      await writeOverrides({
        tabId: activeTabId,
        hostData,
        documentValue,
        scope,
        disabledAppIds: [...savedDisabledOverrides.current.keys()]
      });
      window.close();
    } catch (error) {
      setStatus({ busy: false, message: errorMessage(error), tone: "error" });
    } finally {
      applying.current = false;
    }
  }, [activeTabId, hostData, scope]);

  const toggleOverride = useCallback(async (key: string): Promise<void> => {
    if (applying.current) return;
    const active = activeOverrides.current.get(key);

    if (active) {
      savedDisabledOverrides.current.set(key, active);
      activeOverrides.current.delete(key);
    } else {
      const disabled = savedDisabledOverrides.current.get(key);
      if (!disabled) return;
      activeOverrides.current.set(key, disabled);
      savedDisabledOverrides.current.delete(key);
    }

    setRevision((value) => value + 1);
    await persistActiveOverrides();
  }, [persistActiveOverrides]);

  const saveOverride = useCallback((value: SaveOverrideValue): void => {
    if (applying.current) return;
    const key = artifactKey(value.production);
    savedDisabledOverrides.current.delete(key);

    if (value.selected) activeOverrides.current.set(key, value.selected);
    else activeOverrides.current.delete(key);

    void persistActiveOverrides();
  }, [persistActiveOverrides]);

  const apps = useMemo<AppViewModel[]>(() => {
    return hostData?.catalog.apps.map((manifest) => createAppViewModel(manifest, activeOverrides.current, savedDisabledOverrides.current)) ?? [];
  }, [hostData, revision]);

  const widgetProviders = useMemo<AppViewModel[]>(() => {
    return hostData?.catalog.widgetProviders?.map((manifest) => createAppViewModel(manifest, activeOverrides.current, savedDisabledOverrides.current)) ?? [];
  }, [hostData, revision]);

  const host = useMemo<AppViewModel | undefined>(() => hostData
    ? createAppViewModel(hostData.catalog.host, activeOverrides.current, savedDisabledOverrides.current)
    : undefined, [hostData, revision]);

  const editor = useMemo<EditorModel | undefined>(() => {
    if (view.name !== "editor" || !hostData) return undefined;

    const production = [hostData.catalog.host, ...hostData.catalog.apps, ...(hostData.catalog.widgetProviders ?? [])]
      .find((manifest) => artifactKey(manifest) === view.artifactKey);
    if (!production) return undefined;

    return {
      hostId: hostData.config.hostId,
      production,
      selected: activeOverrides.current.get(view.artifactKey) ?? savedDisabledOverrides.current.get(view.artifactKey),
      productionOptions: productionVersions(hostData, production),
      prOptions: prVersions(hostData, production)
    };
  }, [hostData, revision, view]);

  return {
    apps,
    widgetProviders,
    host,
    editor,
    hostData,
    scope,
    status,
    view,
    load,
    saveOverride,
    setScope,
    showDashboard: () => setView({ name: "dashboard" }),
    showEditor: (key: string) => setView({ name: "editor", artifactKey: key }),
    setError: (message: string) => setStatus({ busy: false, message, tone: "error" }),
    toggleOverride
  };
}

function includeDisabledApps(hostData: HostData, disabledOverrides: Map<string, Manifest>): void {
  const knownAppIds = new Set(hostData.catalog.apps.map((manifest) => artifactKey(manifest)));
  const dependencyIds = new Set(hostData.catalog.apps.flatMap((manifest) => manifest.externalAppsDependencies ?? []));
  hostData.catalog.widgetProviders ??= [];
  for (const manifest of disabledOverrides.values()) {
    if (manifest.kind !== "app" || knownAppIds.has(artifactKey(manifest))) continue;
    if (dependencyIds.has(manifest.id)) hostData.catalog.widgetProviders.push(manifest);
    else hostData.catalog.apps.push(manifest);
  }
}

function hostReadyStatus(hostData: HostData): StatusState {
  const errorCount = hostData.runtimeErrors.length + hostData.versionErrors.length;
  const runtimeNote = errorCount ? ` · ${errorCount} warning${errorCount === 1 ? "" : "s"}` : "";

  return {
    busy: false,
    message: `Host client, ${hostData.catalog.apps.length} apps, and ${hostData.catalog.widgetProviders?.length ?? 0} external widget providers discovered${runtimeNote}`,
    tone: errorCount ? "error" : "standard"
  };
}
