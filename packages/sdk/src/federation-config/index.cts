export {
  createAngularFederationConfig,
  createAngularFederationOptions,
  type AngularFederationConfigOptions,
  type AngularFederationOptions,
  type AngularProjectExpose,
  type ShareAll,
} from './angular-federation/angular-federation.cjs';
export {
  createReactAppViteConfig,
  createReactHostViteConfig,
  type ReactFederationConfigOptions,
} from './react-vite-config/react-vite-config.cjs';
export type { SkipEntry } from './shared-dependencies/shared-dependencies.cjs';
export {
  createReactWidgetEntries,
  type ReactWidgetEntriesOptions,
  type WidgetEntry,
} from './widget-entries/widget-entries.cjs';
export {
  FederationConfigError,
  type FederationConfigErrorOptions,
} from './federation-config-error/federation-config-error.cjs';
