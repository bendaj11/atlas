import type { AtlasModalControls, AtlasModalRef, AtlasModalRequest, AtlasPopupRef } from "./host-overlays.js";
import type { AtlasWidgetLoader } from "./lifecycle.js";
import { createOverlayContentMount } from "./overlay-content.js";
import type { AtlasModalProvider, AtlasOverlayController, AtlasOverlayContentMount, AtlasOverlayProviders } from "./overlay-types.js";

type ModalControlOutcome<TResult> =
  | { readonly kind: "close"; readonly result: TResult | undefined }
  | { readonly kind: "dismiss" };

/** Connects SDK overlay calls to the host's UI library and mounts catalog-selected widgets into its outlet. */
export function createAtlasOverlayController(options: {
  providers: AtlasOverlayProviders;
  getWidgetLoader: () => AtlasWidgetLoader | undefined;
}): AtlasOverlayController {
  let modalQueue = Promise.resolve();

  return {
    async openModal<TResult, TProps extends object>(request: AtlasModalRequest<TResult, TProps>): Promise<TResult | undefined> {
      const queued = modalQueue.then(
        () => openQueuedModal(request, options.providers.openModal, options.getWidgetLoader),
        () => openQueuedModal(request, options.providers.openModal, options.getWidgetLoader)
      );
      modalQueue = queued.then(() => undefined, () => undefined);
      return queued;
    },
    openPopup(request) {
      const content = createOverlayContentMount(request.content, options.getWidgetLoader);
      const popupRef = options.providers.openPopup?.(request, content);
      if (!popupRef) throw new Error("This Atlas host has not configured a popup provider.");
      return createManagedPopupRef(popupRef, content);
    }
  };
}

async function openQueuedModal<TResult, TProps extends object>(
  request: AtlasModalRequest<TResult, TProps>,
  provider: AtlasModalProvider | undefined,
  getWidgetLoader: () => AtlasWidgetLoader | undefined
): Promise<TResult | undefined> {
  if (!provider) return undefined;

  const settlement = createModalSettlement<TResult>();
  const content = createOverlayContentMount(request.component, getWidgetLoader, {
    atlasModal: settlement.controls
  });

  try {
    const ref = await provider(request, settlement.controls, content);
    return await waitForModalClose(ref, settlement.outcome);
  } finally {
    await content?.unmount();
  }
}

async function waitForModalClose<TResult>(
  ref: AtlasModalRef<TResult>,
  controlOutcome: Promise<ModalControlOutcome<TResult>>
): Promise<TResult | undefined> {
  const completion = await Promise.race([
    controlOutcome.then((outcome) => ({ source: "controls" as const, outcome })),
    ref.closed.then((result) => ({ source: "ref" as const, result }))
  ]);

  if (completion.source === "ref") return completion.result;
  if (completion.outcome.kind === "dismiss") {
    await ref.dismiss();
    return undefined;
  }

  await ref.close(completion.outcome.result);
  return completion.outcome.result;
}

function createModalSettlement<TResult>(): {
  readonly controls: AtlasModalControls<TResult>;
  readonly outcome: Promise<ModalControlOutcome<TResult>>;
} {
  let settle: (outcome: ModalControlOutcome<TResult>) => void = () => undefined;
  let settled = false;
  const outcome = new Promise<ModalControlOutcome<TResult>>((resolve) => {
    settle = resolve;
  });

  const settleOnce = (next: ModalControlOutcome<TResult>): void => {
    if (settled) return;
    settled = true;
    settle(next);
  };

  return {
    controls: {
      close(result) {
        settleOnce({ kind: "close", result });
      },
      dismiss() {
        settleOnce({ kind: "dismiss" });
      }
    },
    outcome
  };
}

function createManagedPopupRef(ref: AtlasPopupRef, content: AtlasOverlayContentMount | undefined): AtlasPopupRef {
  let closed = false;

  const cleanup = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    await content?.unmount();
  };

  void ref.closed?.then(cleanup, cleanup);

  return {
    id: ref.id,
    ...(ref.closed ? { closed: ref.closed.then(cleanup) } : {}),
    ...(ref.update ? { update: ref.update.bind(ref) } : {}),
    async close() {
      if (closed) return;
      try {
        await ref.close();
      } finally {
        await cleanup();
      }
    }
  };
}
