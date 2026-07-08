import type { AtlasModalRequest, AtlasPopupRef, AtlasPopupRequest } from "./host-overlays.js";

export interface AtlasOverlayContentMount {
  readonly kind: "widget";
  readonly widget: string;
  mount(container: HTMLElement): Promise<void>;
  unmount(): Promise<void>;
}

export interface AtlasOverlayProviders {
  openModal?<TResult = unknown>(request: AtlasModalRequest<TResult>, content?: AtlasOverlayContentMount): Promise<TResult | undefined>;
  openPopup?(request: AtlasPopupRequest, content?: AtlasOverlayContentMount): AtlasPopupRef;
}

export interface AtlasOverlayController extends Required<AtlasOverlayProviders> {}
