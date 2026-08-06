import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { LocalNativeProxy } from './types.js';

interface AngularBuildPrivateApi {
  loadProxyConfiguration(
    root: string,
    proxyConfig: string | undefined,
  ): Promise<Record<string, unknown> | undefined>;
}

export async function loadAngularHostProxy(
  projectRoot: string,
  configPath: string | undefined,
  origin: string,
): Promise<LocalNativeProxy | undefined> {
  if (!configPath) return undefined;

  const requireFromProject = createRequire(join(projectRoot, 'package.json'));
  const angularBuild = requireFromProject(
    '@angular/build/private',
  ) as AngularBuildPrivateApi;
  const routes = await angularBuild.loadProxyConfiguration(
    projectRoot,
    configPath,
  );
  if (!routes) return undefined;
  return { origin, routes };
}
