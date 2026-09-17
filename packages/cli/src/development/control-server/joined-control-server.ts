import { CONTROL_RECONCILIATION_INTERVAL_MS } from '../constants.js';
import {
  deleteJson,
  isAddressInUse,
  buildLocalOrigin,
  postJson,
} from '../http/http.js';
import type { DevControlServer, StartControlServerOptions } from '../types.js';
import { startOwnedControlServer } from './owned-control-server.js';

export async function joinControlServer(
  options: StartControlServerOptions,
): Promise<DevControlServer> {
  const { document, port } = options;
  const baseUrl = buildLocalOrigin(port);
  const appIds = document.overrides.map((override) => override.manifest.id);
  const hostQuery = `?hostId=${encodeURIComponent(document.hostId)}`;
  const hostPath = `${baseUrl}/atlas.dev-session/hosts/${encodeURIComponent(document.hostId)}`;
  let ownedControl: DevControlServer | undefined;

  const synchronize = async (): Promise<void> => {
    await postJson(`${baseUrl}/atlas.dev-session/overrides`, document);
    await Promise.all([
      ...appIds.map((appId) =>
        postJson(
          `${baseUrl}/atlas.dev-session/overrides/${encodeURIComponent(appId)}/ready${hostQuery}`,
          {},
        ),
      ),
      ...(document.hostOverride ? [postJson(`${hostPath}/ready`, {})] : []),
    ]);
  };

  const reconcile = async (): Promise<void> => {
    try {
      await synchronize();
    } catch {
      try {
        ownedControl = await startOwnedControlServer(options);
        await ownedControl.markReady();
      } catch (error) {
        if (!isAddressInUse(error)) throw error;

        await synchronize();
      }
    }
  };

  const removeJoinedOverrides = async (): Promise<void> => {
    try {
      await Promise.all([
        ...appIds.map((appId) =>
          deleteJson(
            `${baseUrl}/atlas.dev-session/overrides/${encodeURIComponent(appId)}${hostQuery}`,
          ),
        ),
        ...(document.hostOverride ? [deleteJson(hostPath)] : []),
      ]);
    } catch {
      return;
    }
  };

  await reconcile();

  const reconciliation = setInterval(() => {
    void reconcile().catch(() => undefined);
  }, CONTROL_RECONCILIATION_INTERVAL_MS);
  reconciliation.unref();

  return {
    port,
    markReady: reconcile,
    reconcile,
    async close() {
      clearInterval(reconciliation);

      if (ownedControl) {
        await ownedControl.close();

        return;
      }

      await removeJoinedOverrides();
    },
  };
}
