import type { AtlasExportedWidgetManifest, AtlasManifest } from '@atlas/schema';
import type { AtlasSdk } from '../host.js';
import type { AtlasAppContext } from './app-context.js';
import type { AtlasAppMountResult, AtlasMountOutcome } from './app-entry.js';

export interface AtlasExportedWidgetMountRequest<
  TProps extends object = object,
  THostSdk extends object = {},
> {
  container: HTMLElement;
  /** Boundary where framework runtime styles must be inserted. */
  styleTarget: Node & ParentNode;
  props: TProps;
  sdk: AtlasSdk<THostSdk>;
  context: AtlasAppContext;
  widget: AtlasExportedWidgetManifest;
  ownerManifest: AtlasManifest;
}

export interface AtlasExportedWidgetMountResult<
  TInputs extends object = object,
> extends AtlasAppMountResult {
  setInputs?(inputs: TInputs): void;
}

export interface AtlasExportedWidgetEntry<TProps extends object = object> {
  mount(
    request: AtlasExportedWidgetMountRequest<TProps>,
  ): AtlasMountOutcome<AtlasExportedWidgetMountResult<TProps>>;
}
