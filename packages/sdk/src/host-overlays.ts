export interface AtlasToastRequest {
  title: string;
  message?: string;
  state?: "info" | "warning" | "error" | "success" | "loading";
  dismissible?: boolean;
}

export interface AtlasWidgetContent {
  widget: string;
  props?: Record<string, unknown>;
}

export interface AtlasModalRequest<
  TResult = unknown,
  TProps extends object = Record<string, unknown>
> {
  id?: string;
  component: unknown | AtlasWidgetContent;
  props?: TProps;
}

export interface AtlasModalControls<TResult = unknown> {
  close(result?: TResult): void;
  dismiss(): void;
}

export interface AtlasModalRef<TResult = unknown> {
  readonly id: string;
  readonly closed: Promise<TResult | undefined>;
  close(result?: TResult): void | Promise<void>;
  dismiss(): void | Promise<void>;
}

export type AtlasModalOpener = <
  TResult = unknown,
  TProps extends object = Record<string, unknown>
>(request: AtlasModalRequest<TResult, TProps>) => Promise<TResult | undefined>;

export interface AtlasPopupBounds {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface AtlasPopupRequest {
  id?: string;
  title?: string;
  /** Native framework content or an Atlas widget reference. */
  content: unknown | AtlasWidgetContent;
  draggable?: boolean;
  resizable?: boolean;
  bounds?: AtlasPopupBounds;
}

export interface AtlasPopupRef {
  readonly id: string;
  /** Resolves when the host UI closes the popup through any path (button, escape, provider API). */
  readonly closed?: Promise<void>;
  close(): void | Promise<void>;
  update?(bounds: AtlasPopupBounds): void;
}
