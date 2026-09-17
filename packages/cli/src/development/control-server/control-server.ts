import { CONTROL_RECONCILIATION_INTERVAL_MS } from '../constants.js';
import { isAddressInUse } from '../http/http.js';
import type { DevControlServer, StartControlServerOptions } from '../types.js';
import {
  removeControlServerLease,
  writeControlServerLease,
} from './control-server-lease.js';
import { joinControlServer } from './joined-control-server.js';
import { startOwnedControlServer } from './owned-control-server.js';

export async function startControlServer(
  options: StartControlServerOptions,
): Promise<DevControlServer> {
  await writeControlServerLease({ ...options, ready: false });

  try {
    const control = await startOrJoinControlServer(options);

    return withControlServerLease({ control, options });
  } catch (error) {
    await removeControlServerLease(options);

    throw error;
  }
}

async function startOrJoinControlServer(
  options: StartControlServerOptions,
): Promise<DevControlServer> {
  try {
    return await startOwnedControlServer(options);
  } catch (error) {
    if (!isAddressInUse(error)) throw error;

    return joinControlServer(options);
  }
}

function withControlServerLease({
  control,
  options,
}: {
  control: DevControlServer;
  options: StartControlServerOptions;
}): DevControlServer {
  let ready = false;
  const renew = () =>
    writeControlServerLease({
      port: control.port,
      document: options.document,
      ready,
    });
  const renewal = setInterval(
    () => void renew(),
    CONTROL_RECONCILIATION_INTERVAL_MS,
  );
  renewal.unref();

  return {
    port: control.port,
    async markReady() {
      ready = true;
      await renew();
      await control.markReady();
    },
    reconcile: () => control.reconcile(),
    async close() {
      clearInterval(renewal);
      await removeControlServerLease({
        port: control.port,
        document: options.document,
      });
      await control.close();
    },
  };
}
