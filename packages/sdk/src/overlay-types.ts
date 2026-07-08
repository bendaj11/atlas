import type { AtlasModalControls, AtlasModalOpener, AtlasModalRef, AtlasModalRequest, AtlasPopupRef, AtlasPopupRequest } from "./host-overlays.js";

export interface AtlasOverlayContentMount {
  readonly kind: "widget";
  readonly widget: string;
  mount(container: HTMLElement): Promise<void>;
  unmount(): Promise<void>;
}

export type AtlasModalProvider = <
  TResult = unknown,
  TProps extends object = Record<string, unknown>
>(
  request: AtlasModalRequest<TResult, TProps>,
  controls: AtlasModalControls<TResult>,
  content?: AtlasOverlayContentMount
) => AtlasModalRef<TResult> | Promise<AtlasModalRef<TResult>>;

export interface AtlasOverlayProviders {
  openModal?: AtlasModalProvider;
  openPopup?(request: AtlasPopupRequest, content?: AtlasOverlayContentMount): AtlasPopupRef;
}

export interface AtlasOverlayController extends Omit<Required<AtlasOverlayProviders>, "openModal"> {
  openModal: AtlasModalOpener;
}
