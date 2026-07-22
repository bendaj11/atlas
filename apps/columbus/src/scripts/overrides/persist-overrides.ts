import {
  createOverrideDocument,
  reloadHostTab,
  writeDisabledOverrides,
  writeOverrides,
} from '../host/atlas-host/atlas-host.js';
import type { ExtensionSession } from '../../types/app.js';

export async function persistOverrideSession(
  session: ExtensionSession,
): Promise<void> {
  const documentValue = createOverrideDocument({
    hostData: session.hostData,
    overrides: session.activeOverrides,
  });
  await writeOverrides({
    tabId: session.tabId,
    hostData: session.hostData,
    documentValue,
    scope: session.scope,
    disabledAppIds: [...session.disabledOverrides.keys()],
  });
  await writeDisabledOverrides({
    hostId: session.hostData.config.hostId,
    tabId: session.tabId,
    scope: session.scope,
    overrides: session.disabledOverrides,
  });
  await reloadHostTab(session.tabId);
}
