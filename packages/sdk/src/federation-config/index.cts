export {
  createAngularFederationConfig,
  createAngularFederationOptions,
  type AngularFederationConfigOptions,
  type AngularFederationOptions,
  type AngularProjectExpose,
  type ShareAll,
} from './angular-federation/index.cjs';
export {
  FederationConfigError,
  type FederationConfigErrorOptions,
} from './federation-config-error/federation-config-error.cjs';
export {
  createReactAppViteConfig,
  createReactHostViteConfig,
  type ReactFederationConfigOptions,
} from './react-vite-config/index.cjs';
export type { SkipEntry } from './shared-dependencies/index.cjs';
export {
  createReactWidgetEntries,
  type ReactWidgetEntriesOptions,
  type WidgetEntry,
} from './widget-entries/widget-entries.cjs';
