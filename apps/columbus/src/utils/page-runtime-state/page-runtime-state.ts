import type { ArtifactVersion } from '../../../types/artifact-version';
import type { HostData } from '../../../types/host-data';
import type { AtlasOverrideDocument as OverrideDocument } from '../../../types/override-document';
import type { Scope } from '../../../types/columbus-state';
import { isRecord } from '../../shared/messages/messages';

export interface StoredOverrides {
  overrides: OverrideDocument | undefined;
  overrideScope: Scope | undefined;
}

export function readStoredOverrides(
  documentKey: string,
  hostId: string,
): StoredOverrides {
  const tabStored = sessionStorage.getItem(documentKey);
  const stored = tabStored ?? localStorage.getItem(documentKey);
  if (!stored) return { overrides: undefined, overrideScope: undefined };

  const overrideScope: Scope = tabStored ? 'tab' : 'all';
  try {
    const document: unknown = JSON.parse(stored);
    const matchesHost =
      isRecord(document) &&
      document.schemaVersion === '1' &&
      document.hostId === hostId;

    return {
      overrides: matchesHost
        ? (document as unknown as OverrideDocument)
        : undefined,
      overrideScope,
    };
  } catch {
    return { overrides: undefined, overrideScope };
  }
}

export function localOverridesOf(
  hostId: string,
  manifests: ArtifactVersion[],
): OverrideDocument | undefined {
  const local = manifests.filter(({ channel }) => channel === 'local');
  if (!local.length) return undefined;

  const host = local.find(({ kind }) => kind === 'host');

  return {
    schemaVersion: '1',
    hostId,
    generatedAt: new Date().toISOString(),
    ...(host ? { hostOverride: host } : {}),
    overrides: local
      .filter(({ kind }) => kind === 'app')
      .map((manifest) => ({ appId: manifest.id, manifest, reason: 'local' })),
  };
}

export function readRuntimeErrors(): HostData['runtimeErrors'] {
  return [
    ...document.querySelectorAll<HTMLElement>('[data-atlas-state="error"]'),
  ].map((element) => {
    const appId =
      element.getAttribute('data-atlas-app-id') ??
      element.getAttribute('data-atlas-app');
    const message = element.textContent?.trim() || 'Unknown app error';

    return { ...(appId ? { artifactId: appId } : {}), message };
  });
}

export function readVisibleAppIds(): string[] {
  return [
    ...new Set(
      [...document.querySelectorAll<HTMLElement>('[data-atlas-app-id]')]
        .map((element) => element.getAttribute('data-atlas-app-id'))
        .filter((id): id is string => Boolean(id)),
    ),
  ];
}
