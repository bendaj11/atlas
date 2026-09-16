import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { toPosixPath } from '../project-paths/project-paths.cjs';

export interface FederationExposeMetadata {
  readonly key: string;
  readonly outFileName: string;
}

export interface FederationSharedMetadata {
  readonly packageName: string;
  readonly outFileName: string;
  readonly requiredVersion: string;
  readonly singleton: boolean;
  readonly strictVersion: boolean;
  readonly version: string;
}

export interface FederationMetadata {
  readonly name: string;
  readonly exposes: readonly FederationExposeMetadata[];
  readonly shared: readonly FederationSharedMetadata[];
}

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

export const BUILD_NOTIFICATIONS_ENDPOINT =
  '/@atlas/federation-build-notifications';
const REMOTE_ENTRY_ROUTE = '/remoteEntry.json';
const SOURCE_FILE_PATTERN = /\.[cm]?[jt]sx?$/;

interface EventStreamClient {
  write(chunk: string): void;
}

/** Serves Native Federation metadata in development and writes it next to the production bundle. */
export function federationMetadataPlugin(
  options: FederationMetadataPluginOptions,
): Plugin {
  return {
    name: options.pluginName,
    configureServer(server) {
      server.middlewares.use(REMOTE_ENTRY_ROUTE, (_request, response) => {
        response.setHeader('content-type', 'application/json');
        response.setHeader('access-control-allow-origin', '*');
        response.end(
          JSON.stringify({
            ...options.metadata,
            buildNotificationsEndpoint: BUILD_NOTIFICATIONS_ENDPOINT,
            exposes: options.devExposes,
            shared: options.devShared ?? options.metadata.shared,
          }),
        );
      });
    },
    writeBundle() {
      mkdirSync(resolve(options.projectRoot, 'dist'), { recursive: true });
      writeFileSync(
        resolve(options.projectRoot, 'dist/remoteEntry.json'),
        JSON.stringify(options.metadata, null, 2),
      );
    },
  };
}

/** Streams a server-sent event to connected Atlas hosts whenever a source file under `src/` changes. */
export function federationBuildNotificationsPlugin(
  projectRoot: string,
): Plugin {
  const clients = new Set<EventStreamClient>();
  const sourceRoot = sourceRootOf(projectRoot);

  return {
    name: 'atlas-federation-build-notifications',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(
        BUILD_NOTIFICATIONS_ENDPOINT,
        (_request, response) => {
          response.writeHead(200, {
            'access-control-allow-origin': '*',
            'cache-control': 'no-cache',
            connection: 'keep-alive',
            'content-type': 'text/event-stream',
          });
          response.write(eventStreamMessage({ type: 'connected' }));
          clients.add(response);
          response.once('close', () => clients.delete(response));
        },
      );
    },
    handleHotUpdate({ file }) {
      if (!toPosixPath(file).startsWith(sourceRoot)) return;
      const event = eventStreamMessage({ type: 'federation-rebuild-complete' });
      for (const client of clients) client.write(event);
    },
  };
}

/** Forces a full page reload instead of HMR for React sources: federated module identity must stay stable. */
export function reactSourceReloadPlugin(projectRoot: string): Plugin {
  const sourceRoot = sourceRootOf(projectRoot);

  return {
    name: 'atlas-react-source-reload',
    apply: 'serve',
    handleHotUpdate({ file, server }) {
      const sourceFile = toPosixPath(file);
      if (
        !sourceFile.startsWith(sourceRoot) ||
        !SOURCE_FILE_PATTERN.test(sourceFile)
      ) {
        return;
      }
      server.ws.send({ type: 'full-reload', path: '*' });

      return [];
    },
  };
}

function sourceRootOf(projectRoot: string): string {
  return `${toPosixPath(resolve(projectRoot, 'src'))}/`;
}

function eventStreamMessage(payload: { readonly type: string }): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}
