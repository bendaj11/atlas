import {
  createOverrideDocument,
  writeDisabledOverrides,
  writeOverrides,
} from './atlas-host.js';
import type { PopupSession } from './types.js';

export async function persistOverrideSession(
  session: PopupSession,
): Promise<void> {
  await writeDisabledOverrides({
    hostId: session.hostData.config.hostId,
    tabId: session.tabId,
    scope: session.scope,
    overrides: session.disabledOverrides,
  });
  const documentValue = createOverrideDocument(
    session.hostData,
    session.activeOverrides,
  );
  await writeOverrides({
    tabId: session.tabId,
    hostData: session.hostData,
    documentValue,
    scope: session.scope,
    disabledAppIds: [...session.disabledOverrides.keys()],
  });
}
