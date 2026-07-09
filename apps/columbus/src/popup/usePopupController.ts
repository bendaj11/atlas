import { useCallback, useMemo, useRef, useState } from "react";
import type { AtlasExtensionManifest as Manifest, AtlasHostData as HostData } from "../contracts.js";
import { createOverrideDocument, errorMessage, readHostData, updateActionBadge, writeOverrides } from "./atlas-host.js";
import { createAppViewModel, prVersions, productionVersions } from "./manifest-utils.js";
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

  const load = useCallback(async (): Promise<void> => {
    setStatus(readingStatus);

    try {
      const result = await readHostData(activeTabId);
      activeOverrides.current = new Map((result.hostData.overrides?.overrides ?? []).map((override) => [override.mfId, override.manifest]));
      setActiveTabId(result.tabId);
      setHostData(result.hostData);
      setScope(result.hostData.overrideScope === "tab" ? "tab" : "all");
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
    if (!activeTabId || !hostData) return;

    setStatus(applyingStatus);

    try {
      const documentValue = createOverrideDocument(hostData, activeOverrides.current);
      await writeOverrides({ tabId: activeTabId, hostData, documentValue, scope });
      window.close();
    } catch (error) {
      setStatus({ busy: false, message: errorMessage(error), tone: "error" });
    }
  }, [activeTabId, hostData, scope]);

  const toggleOverride = useCallback(async (appId: string): Promise<void> => {
    const active = activeOverrides.current.get(appId);

    if (active) {
      savedDisabledOverrides.current.set(appId, active);
      activeOverrides.current.delete(appId);
    } else {
      const disabled = savedDisabledOverrides.current.get(appId);
      if (!disabled) return;
      activeOverrides.current.set(appId, disabled);
    }

    setRevision((value) => value + 1);
    await persistActiveOverrides();
  }, [persistActiveOverrides]);

  const saveOverride = useCallback((value: SaveOverrideValue): void => {
    savedDisabledOverrides.current.delete(value.production.id);

    if (value.selected) activeOverrides.current.set(value.production.id, value.selected);
    else activeOverrides.current.delete(value.production.id);

    void persistActiveOverrides();
  }, [persistActiveOverrides]);

  const apps = useMemo<AppViewModel[]>(() => {
    return hostData?.catalog.manifests.map((manifest) => createAppViewModel(manifest, activeOverrides.current, savedDisabledOverrides.current)) ?? [];
  }, [hostData, revision]);

  const editor = useMemo<EditorModel | undefined>(() => {
    if (view.name !== "editor" || !hostData) return undefined;

    const production = hostData.catalog.manifests.find((manifest) => manifest.id === view.appId);
    if (!production) return undefined;

    return {
      hostId: hostData.config.hostId,
      production,
      selected: activeOverrides.current.get(view.appId) ?? savedDisabledOverrides.current.get(view.appId),
      productionOptions: productionVersions(hostData, production),
      prOptions: prVersions(hostData, production)
    };
  }, [hostData, revision, view]);

  return {
    apps,
    editor,
    hostData,
    scope,
    status,
    view,
    load,
    saveOverride,
    setScope,
    showDashboard: () => setView({ name: "dashboard" }),
    showEditor: (appId: string) => setView({ name: "editor", appId }),
    setError: (message: string) => setStatus({ busy: false, message, tone: "error" }),
    toggleOverride
  };
}

function hostReadyStatus(hostData: HostData): StatusState {
  const errorCount = hostData.runtimeErrors.length + hostData.versionErrors.length;
  const runtimeNote = errorCount ? ` · ${errorCount} warning${errorCount === 1 ? "" : "s"}` : "";

  return {
    busy: false,
    message: `${hostData.catalog.manifests.length} apps discovered${runtimeNote}`,
    tone: errorCount ? "error" : "standard"
  };
}
