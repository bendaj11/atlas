const DOCUMENT_KEY = "atlas.runtime-overrides";

void chrome.runtime.sendMessage({
  type: "atlas.override-count",
  overrideCount: readOverrideCount()
}).catch(() => undefined);

function readOverrideCount(): number {
  const stored = sessionStorage.getItem(DOCUMENT_KEY) ?? localStorage.getItem(DOCUMENT_KEY);
  if (!stored) return 0;

  try {
    const value = JSON.parse(stored) as { overrides?: unknown[] };
    return Array.isArray(value.overrides) ? value.overrides.length : 0;
  } catch {
    return 0;
  }
}
