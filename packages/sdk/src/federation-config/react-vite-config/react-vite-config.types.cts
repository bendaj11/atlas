import type { Plugin } from 'vite';
import type {
  SharedDependency,
  SkipEntry,
} from '../shared-dependencies/index.cjs';

export interface ReactFederationConfigOptions {
  readonly projectRoot: string;
  /** Project name; becomes the Native Federation remote name `atlas_<name>`. */
  readonly projectName: string;
  /** React major of the app; 17 selects the legacy `react-dom` root API in generated widget entries. */
  readonly reactMajor?: number;
  /** Packages that Vite bundles into the remote instead of sharing with the host. */
  readonly skip?: readonly SkipEntry[];
}

/** Rollup-facing pieces derived from the shared dependencies of one React remote. */
export interface ReactFederationBuild {
  readonly shared: readonly SharedDependency[];
  readonly sharedFallbackPlugin: Plugin;
  readonly commonJsOptions: {
    readonly include: ReadonlyArray<string | RegExp>;
  };
  readonly input: Readonly<Record<string, string>>;
  readonly external: (source: string) => boolean;
}
