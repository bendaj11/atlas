import type { AtlasHostRuntimeConfig } from '@atlas/schema';
import { createBrowserAssetFiles } from './bootstrap-assets.js';
import {
  createBootstrapHtml,
  validateBootstrapHtml,
  versionLoaderSource,
} from './bootstrap-html.js';
import type {
  AtlasBootstrapFile,
  AtlasBootstrapOptions,
} from './bootstrap-types.js';
import { createNginxConfig } from './nginx-config.js';

export function createAtlasBootstrapFiles(
  options: AtlasBootstrapOptions,
): AtlasBootstrapFile[] {
  const html = versionLoaderSource(
    options.html ??
      createBootstrapHtml({
        ...(options.title !== undefined ? { title: options.title } : {}),
        ...(options.loadingHtml !== undefined
          ? { loadingHtml: options.loadingHtml }
          : {}),
      }),
  );

  validateBootstrapHtml(html);

  const files: AtlasBootstrapFile[] = [
    { path: 'index.html', contents: withTrailingNewline(html) },

    ...createBrowserAssetFiles(),
  ];

  if (options.runtimeConfig === 'external') return files;

  const runtime = requiredRuntime(options.runtime);

  return [
    ...files,

    {
      path: 'atlas.runtime.json',
      contents: `${JSON.stringify(runtime, null, 2)}\n`,
    },

    {
      path: 'nginx.conf',
      contents: createNginxConfig(
        options.assetOrigins ?? runtimeAssetOrigins(runtime),
      ),
    },
  ];
}

function withTrailingNewline(contents: string): string {
  return contents.endsWith('\n') ? contents : `${contents}\n`;
}

function runtimeAssetOrigins(runtime: AtlasHostRuntimeConfig): string[] {
  return [
    new URL(runtime.manifestUrl).origin,
    ...(runtime.assetOrigins ?? []),
    ...(runtime.externalRegistries ?? []).map(
      ({ registryUrl }) => new URL(registryUrl).origin,
    ),
  ];
}

function requiredRuntime(
  runtime: AtlasHostRuntimeConfig | undefined,
): AtlasHostRuntimeConfig {
  if (!runtime) {
    throw new Error(
      'Atlas bootstrap requires runtime configuration unless --runtime-config=external is used.',
    );
  }

  validateRuntime(runtime);

  return runtime;
}

function validateRuntime(runtime: AtlasHostRuntimeConfig): void {
  if (!runtime.hostId.trim()) {
    throw new Error('Atlas bootstrap requires a non-empty hostId.');
  }

  if (!runtime.environment.trim()) {
    throw new Error('Atlas bootstrap requires a non-empty environment.');
  }

  try {
    new URL(runtime.manifestUrl);
  } catch {
    throw new Error('Atlas bootstrap requires an absolute manifestUrl.');
  }
}
