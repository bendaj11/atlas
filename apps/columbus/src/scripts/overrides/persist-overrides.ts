import type { ExtensionSession } from '../../types/app';
import { reloadHostTab } from '../host/host-tabs/host-tabs';
import { validateLocalOverride } from './local-override/local-override';
import { createOverrideDocument } from './override-document/override-document';
import {
  writeDisabledOverrides,
  writeOverrideDocument,
  writeSuppressedArtifactIds,
} from './override-storage/override-storage';

export async function persistOverrideSession(
  session: ExtensionSession,
): Promise<void> {
  await Promise.all(
    [...session.activeOverrides.values()].map(validateLocalOverride),
  );
  const location = {
    hostId: session.hostData.config.hostId,
    tabId: session.tabId,
    scope: session.scope,
  };
  await writeOverrideDocument({
    tabId: session.tabId,
    hostData: session.hostData,
    documentValue: createOverrideDocument({
      hostData: session.hostData,
      overrides: session.activeOverrides,
    }),
    scope: session.scope,
    disabledAppIds: disabledAppIds(session),
  });
  await writeDisabledOverrides(location, session.disabledOverrides);
  await writeSuppressedArtifactIds(location, session.suppressedArtifactIds);
  await reloadHostTab(session.tabId);
}

function disabledAppIds(session: ExtensionSession): string[] {
  return [
    ...new Set([
      ...[...session.disabledOverrides.values()].map((manifest) => manifest.id),
      ...session.suppressedArtifactIds,
    ]),
  ];
}
