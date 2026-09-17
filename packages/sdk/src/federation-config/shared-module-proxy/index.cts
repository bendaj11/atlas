export {
  createSharedModuleProxy,
  loadSharedProxy,
  sharedProxyId,
} from './shared-module-proxy.cjs';
export type { LoadSharedProxyRequest } from './shared-module-proxy.cjs';
export type {
  LoadVite,
  ReadCommonJsExports,
  SharedModuleProxyDependencies,
  SharedModuleProxyOptions,
  SharedProxyLoadContext,
  ResolveSharedEntry,
  LoadSharedEntryInfo,
  ReportLoadError,
  ResolvedSharedEntry,
  SharedEntryModuleInfo,
} from './shared-module-proxy.types.cjs';
