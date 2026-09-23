import type { Environment, Plugin, ResolvedConfig, Rollup } from 'vite';

export type ViteIdResolver = ReturnType<typeof import('vite').createIdResolver>;

export type LoadVite = () => Promise<
  Pick<typeof import('vite'), 'createIdResolver'>
>;

export type ReadCommonJsExports = (entryPoint: string) => readonly string[];

export interface SharedModuleProxyOptions {
  readonly projectRoot: string;
  readonly specifiers: readonly string[];
}

export interface SharedModuleProxyDependencies {
  readonly loadVite: LoadVite;
  readonly readCommonJsExports: ReadCommonJsExports;
}

export type ResolvedSharedEntry = Pick<Rollup.ResolvedId, 'id' | 'external'>;

export type SharedEntryModuleInfo = Pick<
  Rollup.ModuleInfo,
  'hasDefaultExport' | 'syntheticNamedExports'
>;

export type ResolveSharedEntry = (
  id: string,
  importer: string,
) => Promise<ResolvedSharedEntry | null>;

export type LoadSharedEntryInfo = (options: {
  id: string;
}) => Promise<SharedEntryModuleInfo>;

export type ReportLoadError = (message: string) => never;

/** The part of Rollup's `PluginContext` the proxy `load` hook uses; a full context satisfies it. */
export interface SharedProxyLoadContext {
  readonly environment: Environment;
  resolve: ResolveSharedEntry;
  load: LoadSharedEntryInfo;
  error: ReportLoadError;
}

/** The shared-proxy plugin with its three hooks declared, so tests can call them without narrowing. */
export interface SharedModuleProxyPlugin extends Plugin {
  readonly name: string;
  configResolved(config: ResolvedConfig): Promise<void>;
  resolveId(source: string): string | undefined;
  load(this: SharedProxyLoadContext, id: string): Promise<string | undefined>;
}

export interface ProxySourceOptions {
  readonly entryPoint: string;
  readonly namedExports: readonly string[];
  readonly hasDefaultExport: boolean;
}
