import {
  createOverrideDocument,
  reloadHostTab,
  writeDisabledOverrides,
  writeOverrides,
  writeSuppressedArtifactIds,
} from '../host/atlas-host/atlas-host.js';
import type { ExtensionSession } from '../../types/app.js';

export async function persistOverrideSession(
  session: ExtensionSession,
): Promise<void> {
  const disabledArtifactIds = disabledOverrideIds(session);
  const documentValue = createOverrideDocument({
    hostData: session.hostData,
    overrides: session.activeOverrides,
  });
  await writeOverrides({
    tabId: session.tabId,
    hostData: session.hostData,
    documentValue,
    scope: session.scope,
    disabledAppIds: disabledArtifactIds,
  });
  await writeDisabledOverrides({
    hostId: session.hostData.config.hostId,
    tabId: session.tabId,
    scope: session.scope,
    overrides: session.disabledOverrides,
  });
  await writeSuppressedArtifactIds({
    hostId: session.hostData.config.hostId,
    tabId: session.tabId,
    scope: session.scope,
    artifactIds: session.suppressedArtifactIds,
  });
  await reloadHostTab(session.tabId);
}

export function disabledOverrideIds(session: ExtensionSession): string[] {
  return [
    ...new Set([
      ...[...session.disabledOverrides.values()].map((manifest) => manifest.id),
      ...session.suppressedArtifactIds,
    ]),
  ];
}
