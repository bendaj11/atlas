import { readFile } from 'node:fs/promises';

interface AtlasPreviewStateFile {
  schemaVersion: '1';
  complete: true;
  artifacts: AtlasArtifactPreviewStateEntry[];
}

interface AtlasArtifactPreviewStateEntry {
  kind: 'app' | 'host';
  id: string;
  openPreviews: number[];
}

export interface AtlasArtifactPreviewState {
  readonly kind: 'app' | 'host';
  readonly id: string;
  readonly openPreviews: ReadonlySet<number>;
}

export interface PullRequestStateDependencies {
  readState(path: string): Promise<string>;
}

const defaultDependencies: PullRequestStateDependencies = {
  readState: async (path) => readFile(path, 'utf8'),
};

export async function readOpenPreviews(
  path: string,
  dependencies = defaultDependencies,
): Promise<readonly AtlasArtifactPreviewState[]> {
  let value: unknown;

  try {
    value = JSON.parse(await dependencies.readState(path));
  } catch (error) {
    throw new Error(
      `Atlas could not read the authoritative preview state file "${path}".`,
      { cause: error },
    );
  }

  if (!isPreviewStateFile(value)) {
    throw new Error(
      `Atlas preview state file "${path}" must contain { "schemaVersion": "1", "complete": true, "artifacts": [{ "kind": "app", "id": "orders", "openPreviews": [1, 2] }] }.`,
    );
  }

  return value.artifacts.map(({ kind, id, openPreviews }) => ({
    kind,
    id,
    openPreviews: new Set(openPreviews),
  }));
}

function isPreviewStateFile(value: unknown): value is AtlasPreviewStateFile {
  if (typeof value !== 'object' || value === null) return false;
  const state = value as Partial<AtlasPreviewStateFile>;
  if (
    state.schemaVersion !== '1' ||
    state.complete !== true ||
    !Array.isArray(state.artifacts) ||
    !state.artifacts.every(isArtifactPreviewStateEntry)
  ) {
    return false;
  }

  const keys = state.artifacts.map(({ kind, id }) => `${kind}:${id}`);
  return new Set(keys).size === keys.length;
}

function isArtifactPreviewStateEntry(
  value: unknown,
): value is AtlasArtifactPreviewStateEntry {
  if (typeof value !== 'object' || value === null) return false;
  const artifact = value as Partial<AtlasArtifactPreviewStateEntry>;
  return (
    (artifact.kind === 'app' || artifact.kind === 'host') &&
    typeof artifact.id === 'string' &&
    /^[A-Za-z0-9][A-Za-z0-9._~-]*$/u.test(artifact.id) &&
    Array.isArray(artifact.openPreviews) &&
    artifact.openPreviews.every(isPreviewNumber) &&
    new Set(artifact.openPreviews).size === artifact.openPreviews.length
  );
}

function isPreviewNumber(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}
