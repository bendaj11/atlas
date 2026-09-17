import type { AtlasExportedWidgetManifest } from '@atlas/schema';
import type {
  AtlasGetWidgetOptions,
  AtlasWidgetHandle,
} from '../core/sdk-types/index.js';

export interface AtlasMountedWidget<
  TInputs extends object = Record<string, unknown>,
> {
  widget: AtlasExportedWidgetManifest | undefined;
  setInputs?(inputs: TInputs): void;
  unmount(): Promise<void>;
}

/** Loads widgets only from owner versions selected in the current host catalog. */
export interface AtlasWidgetLoader {
  list(ownerAppId?: string): AtlasExportedWidgetManifest[];
  getWidget<TInputs extends object = Record<string, unknown>>(
    widgetId: string,
    options?: AtlasGetWidgetOptions,
  ): AtlasWidgetHandle<TInputs>;
  mount<TProps extends object = Record<string, unknown>>(
    widgetId: string,
    container: HTMLElement,
    props: TProps,
  ): Promise<AtlasMountedWidget<TProps>>;
}
