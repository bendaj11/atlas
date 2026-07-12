import { emitHostError, emitHostReady, emitHostStart, reportRetryFailure, toError } from "./dom-host-events.js";
import type { DomHostOptions, DomHostServices } from "./dom-host-options.js";
import { startDomHostRuntime } from "./dom-host-runtime.js";
import {
  createHostUi,
  type AtlasHostRuntime
} from "./index.js";

export type { DomHostOptions, DomHostServices } from "./dom-host-options.js";

export async function startDomHost<THostSdk extends object = {}>(
  options: DomHostOptions<THostSdk>,
  services: DomHostServices
): Promise<AtlasHostRuntime> {
  const startedAt = Date.now();
  emitHostStart(options);
  const document = options.document ?? globalThis.document;
  const hostUi = createHostUi({
    document,
    ...(options.renderHostLoading ? { renderHostLoading: options.renderHostLoading } : {}),
    ...(options.renderHostError ? { renderHostError: options.renderHostError } : {})
  });
  hostUi.showLoading();

  try {
    const runtime = await startDomHostRuntime({
      options,
      services,
      document,
      onInfrastructureReady: hostUi.clear
    });
    hostUi.clear();
    emitHostReady(options.observe, runtime, startedAt);
    return runtime;
  } catch (error) {
    const failure = toError(error);
    emitHostError(options, failure, startedAt);
    hostUi.showError(failure, () => { void startDomHost(options, services).catch(reportRetryFailure); });
    throw failure;
  }
}
