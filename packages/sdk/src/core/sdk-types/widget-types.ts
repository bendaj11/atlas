export interface AtlasMountedWidgetHandle<
  TInputs extends object = Record<string, unknown>,
> {
  setInputs?(inputs: TInputs): void;
  unmount(): Promise<void>;
}

export type AtlasWidgetLoadingRenderer = (
  container: HTMLElement,
) => void | (() => void);

export interface AtlasGetWidgetOptions {
  renderLoading?: AtlasWidgetLoadingRenderer;
}

/** Widget selected by UUID and mounted into a caller-owned card/container. */
export interface AtlasWidgetHandle<
  TInputs extends object = Record<string, unknown>,
> {
  readonly id: string;
  readonly name: string;
  mount(
    container: HTMLElement,
    inputs: TInputs,
  ): Promise<AtlasMountedWidgetHandle<TInputs>>;
}

export type AtlasGetWidget = <TInputs extends object = Record<string, unknown>>(
  widgetId: string,
  options?: AtlasGetWidgetOptions,
) => AtlasWidgetHandle<TInputs>;
