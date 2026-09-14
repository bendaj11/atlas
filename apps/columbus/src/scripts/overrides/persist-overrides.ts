import {
  reloadHostTab,
  validateLocalOverride,
  writeDisabledOverrides,
  writeOverrides,
  writeSuppressedArtifactIds,
} from '../host/atlas-host/atlas-host';
import type { ExtensionSession } from '../../types/app';
import { createOverrideDocument } from './override-document/override-document';

export async function persistOverrideSession(
  session: ExtensionSession,
): Promise<void> {
  await Promise.all(
    [...session.activeOverrides.values()].map(validateLocalOverride),
  );
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

function disabledOverrideIds(session: ExtensionSession): string[] {
  return [
    ...new Set([
      ...[...session.disabledOverrides.values()].map((manifest) => manifest.id),
      ...session.suppressedArtifactIds,
    ]),
  ];
}
