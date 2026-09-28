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

  let ready = false;
  let stopWaitingForHostAnchor = () => {};

  const reportReady = () => {
    stopWaitingForHostAnchor();

    if (ready) return;

    ready = true;
    services.onReady?.();
  };
  const reportReadyWhenHostAnchorRenders = () => {
    const reportReadyIfHostAnchorRendered = () => {
      if (anchors.get('route-outlet') ?? anchors.get('status')) reportReady();
    };

    stopWaitingForHostAnchor = anchors.subscribe(
      reportReadyIfHostAnchorRendered,
    );

    reportReadyIfHostAnchorRendered();
  };

  emitHostStart(options);

  const document = options.document ?? globalThis.document;
  const hostUi = createHostUi({
    document,
    anchors,
    ...(options.hostContainer
      ? { fallbackContainer: options.hostContainer }
      : {}),
    ...(services.ui?.renderHostError
      ? { renderHostError: services.ui.renderHostError }
      : {}),
  });

  try {
    const runtime = await startDomHostRuntime({
      options: runtimeOptions,
      services,
      document,
      onInfrastructureReady: reportReadyWhenHostAnchorRenders,
      onPlacementStateChange: reportReady,
    });

    emitHostReady(options.observe, runtime, startedAt);
    reportReady();

    return runtime;
  } catch (error) {
    const failure = new AtlasHostStartError(error);
    let retried = false;

    emitHostError(options, failure, startedAt);

    hostUi.showError(failure, () => {
      if (retried) return;

      retried = true;

      void startDomHost(runtimeOptions, {
        ...services,
        onReady: () => {
          hostUi.clear();
          services.onReady?.();
        },
      }).catch((retryError) =>
        logBrowserError(
          'Atlas host retry failed.',
          new AtlasHostRetryError(retryError),
        ),
      );
    });
    reportReady();

    throw failure;
  }
}
