import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { BUILD_NOTIFICATIONS_ENDPOINT } from './build-notifications-plugin.cjs';
import type {
  FederationExposeMetadata,
  FederationMetadata,
  FederationSharedMetadata,
} from './federation-metadata.types.cjs';

export interface FederationMetadataPluginOptions {
  readonly projectRoot: string;
  readonly pluginName: string;
  /** Metadata written to `dist/remoteEntry.json` by the production build. */
  readonly metadata: FederationMetadata;
  /** Exposes served from `/remoteEntry.json` by the Vite dev server. */
  readonly devExposes: readonly FederationExposeMetadata[];
  /** Shared entries served by the dev server; defaults to the production `metadata.shared`. */
  readonly devShared?: readonly FederationSharedMetadata[];
}

const REMOTE_ENTRY_ROUTE = '/remoteEntry.json';

/** Serves Native Federation metadata in development and writes it next to the production bundle. */
export function createFederationMetadataPlugin(
  options: FederationMetadataPluginOptions,
): Plugin {
  const developmentMetadata = JSON.stringify({
    ...options.metadata,
    buildNotificationsEndpoint: BUILD_NOTIFICATIONS_ENDPOINT,
    exposes: options.devExposes,
    shared: options.devShared ?? options.metadata.shared,
  });

  return {
    name: options.pluginName,

    configureServer(server) {
      server.middlewares.use(REMOTE_ENTRY_ROUTE, (_request, response) => {
        response.setHeader('content-type', 'application/json');
        response.setHeader('access-control-allow-origin', '*');
        response.end(developmentMetadata);
      });
    },

    writeBundle() {
      const distDirectory = resolve(options.projectRoot, 'dist');
      mkdirSync(distDirectory, { recursive: true });
      writeFileSync(
        resolve(distDirectory, 'remoteEntry.json'),
        JSON.stringify(options.metadata, null, 2),
      );
    },
  };
}
