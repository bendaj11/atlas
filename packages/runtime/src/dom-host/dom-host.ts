import type { AtlasHostRuntime } from '../host-runtime/host-runtime.types.js';
import { logBrowserError } from '../shared/errors.js';
import {
  emitHostError,
  emitHostReady,
  emitHostStart,
} from './dom-host-events.js';
import { startDomHostRuntime } from './dom-host-runtime.js';
import { AtlasHostRetryError, AtlasHostStartError } from './dom-host.errors.js';
import type { DomHostOptions, DomHostServices } from './dom-host.types.js';
import { AtlasHostAnchorRegistry } from './host-anchors.js';
import { createHostUi } from './host-ui.js';

export type { DomHostOptions, DomHostServices } from './dom-host.types.js';

export async function startDomHost<THostSdk extends object = {}>(
  options: DomHostOptions<THostSdk>,
  services: DomHostServices<THostSdk>,
): Promise<AtlasHostRuntime<THostSdk>> {
  const startedAt = Date.now();
  const anchors = options.anchors ?? new AtlasHostAnchorRegistry();
  const runtimeOptions = { ...options, anchors };

  emitHostStart(options);

  const document = options.document ?? globalThis.document;
  const hostUi = createHostUi({
    document,
    anchors,
    ...(options.renderHostLoading
      ? { renderHostLoading: options.renderHostLoading }
      : {}),
    ...(options.renderHostError
      ? { renderHostError: options.renderHostError }
      : {}),
  });

  hostUi.showLoading();

  try {
    const runtime = await startDomHostRuntime({
      options: runtimeOptions,
      services,
      document,
      onInfrastructureReady: hostUi.clear,
    });

    hostUi.dispose();
    emitHostReady(options.observe, runtime, startedAt);

    return runtime;
  } catch (error) {
    const failure = new AtlasHostStartError(error);

    emitHostError(options, failure, startedAt);

    hostUi.showError(failure, () => {
      hostUi.dispose();

      void startDomHost(runtimeOptions, services).catch((retryError) =>
        logBrowserError(
          'Atlas host retry failed.',
          new AtlasHostRetryError(retryError),
        ),
      );
    });

    throw failure;
  }
}
