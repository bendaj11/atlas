import type { ColumbusState } from '../../../types/columbus-state';
import { reloadHostTab } from '../../host/host-tabs/host-tabs';
import { validateLocalOverride } from '../local-override/local-override';
import { createOverrideDocument } from '../override-document/override-document';
import {
  writeDisabledArtifactVersionOverrides,
  writeOverrideDocument,
  writeClearedLocalArtifactIds,
} from '../override-storage/override-storage';

export async function persistColumbusState(
  columbusState: ColumbusState,
): Promise<void> {
  await Promise.all(
    [...columbusState.enabledArtifactVersionOverrides.values()].map(
      validateLocalOverride,
    ),
  );
  const location = {
    hostId: columbusState.hostData.config.hostId,
    tabId: columbusState.tabId,
    scope: columbusState.scope,
  };
  await writeOverrideDocument({
    tabId: columbusState.tabId,
    hostData: columbusState.hostData,
    documentValue: createOverrideDocument({
      hostData: columbusState.hostData,
      overrides: columbusState.enabledArtifactVersionOverrides,
    }),
    scope: columbusState.scope,
    disabledAppIds: disabledAppIds(columbusState),
  });
  await writeDisabledArtifactVersionOverrides(
    location,
    columbusState.disabledArtifactVersionOverrides,
  );
  await writeClearedLocalArtifactIds(
    location,
    columbusState.clearedLocalArtifactIds,
  );
  await reloadHostTab(columbusState.tabId);
}

function disabledAppIds(columbusState: ColumbusState): string[] {
  return [
    ...new Set([
      ...[...columbusState.disabledArtifactVersionOverrides.values()].map(
        (artifactVersion) => artifactVersion.id,
      ),
      ...columbusState.clearedLocalArtifactIds,
    ]),
  ];
}
