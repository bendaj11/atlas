const DOCUMENT_KEY = "atlas.runtime-overrides";

void readOverrideCount()
  .then((overrideCount) => chrome.runtime.sendMessage({ type: "atlas.override-count", overrideCount }))
  .catch(() => undefined);

async function readOverrideCount(): Promise<number> {
  const stored = sessionStorage.getItem(DOCUMENT_KEY) ?? localStorage.getItem(DOCUMENT_KEY);
  if (stored) return overrideCount(stored);

  const config = await readAtlasConfig();
  if (!config?.hostId) return 0;

  const key = `atlas.overrides.${config.hostId}`;
  const persisted = await chrome.storage.local.get(key);
  return overrideCount(persisted[key]);
}

async function readAtlasConfig(): Promise<{ hostId?: string } | undefined> {
  try {
    const response = await fetch("/atlas.runtime.json", { cache: "no-store" });
    if (!response.ok) return undefined;

    const value = await response.json() as { schemaVersion?: string; hostId?: string };
    return value.schemaVersion === "1" ? value : undefined;
  } catch {
    return undefined;
  }
}

function overrideCount(value: unknown): number {
  const documentValue = typeof value === "string" ? parseJson(value) : value;
  if (!isOverrideDocument(documentValue)) return 0;

  return documentValue.overrides.length;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function isOverrideDocument(value: unknown): value is { overrides: unknown[] } {
  return typeof value === "object"
    && value !== null
    && "overrides" in value
    && Array.isArray(value.overrides);
}
