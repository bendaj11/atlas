import type {
  AtlasAppManifest,
  AtlasExportedWidgetManifest,
  AtlasHostCatalog,
  AtlasHostRuntimeConfig,
  AtlasManifest,
} from '@atlas/schema';
import type { AtlasSdk, AtlasWidgetLoadingRenderer } from '@atlas/sdk/host';
import type {
  AtlasExportedWidgetEntry,
  AtlasMountedWidget,
} from '@atlas/sdk/lifecycle';
import type { AtlasRemoteTrustPolicy } from '../loader/trust/trust-policy.types.js';

export interface AtlasWidgetRenderContext {
  widgetId: string;
  widget?: AtlasExportedWidgetManifest;
  ownerManifest?: AtlasManifest;
}

export interface AtlasWidgetErrorRenderContext extends AtlasWidgetRenderContext {
  error: Error;
}

export type DisposeRenderer = () => void;

export type RetryWidgetMount = () => void;

export type RenderWidgetLoading = (
  container: HTMLElement,
  context: AtlasWidgetRenderContext,
) => void | DisposeRenderer;

export type RenderWidgetError = (
  container: HTMLElement,
  context: AtlasWidgetErrorRenderContext,
  retry: RetryWidgetMount,
) => void | DisposeRenderer;

export interface AtlasWidgetUiOptions {
  renderWidgetLoading?: RenderWidgetLoading;
  renderWidgetError?: RenderWidgetError;
}

export type AtlasWidgetImporter = (
  widget: AtlasExportedWidgetManifest,
  ownerManifest: AtlasManifest,
) => Promise<AtlasExportedWidgetEntry>;

export interface AtlasResolvedWidget {
  widget: AtlasExportedWidgetManifest;
  ownerManifest: AtlasAppManifest;
}

export type AtlasWidgetResolver = (
  widgetId: string,
) => Promise<AtlasResolvedWidget>;

export interface AtlasWidgetLoaderOptions extends AtlasWidgetUiOptions {
  importWidget?: AtlasWidgetImporter;
  resolveWidget?: AtlasWidgetResolver;
  trustPolicy?: AtlasRemoteTrustPolicy;
}

export interface CreateWidgetLoaderInput {
  manifests: AtlasManifest[];
  sdk: AtlasSdk;
  options?: AtlasWidgetLoaderOptions;
}

export interface WidgetRegistryOptions {
  catalog: AtlasHostCatalog;
  /** @deprecated Runtime config is no longer used for external registry discovery. */
  runtimeConfig?: AtlasHostRuntimeConfig;
}

export type ResolveWidgetById = (
  widgetId: string,
) => Promise<AtlasResolvedWidget>;

export type VerifyWidgetOwnerIntegrity = (
  resolved: AtlasResolvedWidget,
) => Promise<void>;

export type ImportResolvedWidgetEntry = (
  resolved: AtlasResolvedWidget,
) => Promise<AtlasExportedWidgetEntry>;

export interface MountResolvedWidgetInput<TProps extends object> {
  widgetId: string;
  container: HTMLElement;
  props: TProps;
  sdk: AtlasSdk;
  resolveWidget: ResolveWidgetById;
  verifyOwnerIntegrity: VerifyWidgetOwnerIntegrity;
  importEntry: ImportResolvedWidgetEntry;
  initialContext: AtlasWidgetRenderContext;
  options: AtlasWidgetLoaderOptions;
  renderLoading?: AtlasWidgetLoadingRenderer;
}

export interface MountedWidgetState<TInputs extends object> {
  current?: AtlasMountedWidget<TInputs>;
  disposed: boolean;
}

export interface WidgetCardInput {
  parent: HTMLElement;
  context: AtlasWidgetRenderContext;
  options: AtlasWidgetUiOptions;
  renderLoading?: AtlasWidgetLoadingRenderer;
}

export interface WidgetCardErrorInput {
  error: Error;
  retry: RetryWidgetMount;
  resolved?: AtlasResolvedWidget;
}

export interface WidgetCard {
  element: HTMLElement;
  clearStatus(): void;
  showLoading(): void;
  showError(input: WidgetCardErrorInput): void;
  remove(): void;
}
