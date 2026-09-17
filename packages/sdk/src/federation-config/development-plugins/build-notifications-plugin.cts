import type { Plugin } from 'vite';
import { resolveProjectSourceRoot } from './source-root.cjs';

interface EventStreamClient {
  write(chunk: string): void;
}

export const BUILD_NOTIFICATIONS_ENDPOINT =
  '/@atlas/federation-build-notifications';

/** Streams a server-sent event to connected Atlas hosts whenever a source file under `src/` changes. */
export function createFederationBuildNotificationsPlugin(
  projectRoot: string,
): Plugin {
  const clients = new Set<EventStreamClient>();
  const sourceRoot = resolveProjectSourceRoot(projectRoot);

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
          response.write(formatEventStreamMessage('connected'));

          clients.add(response);
          response.once('close', () => clients.delete(response));
        },
      );
    },

    handleHotUpdate({ file }) {
      if (!file.replaceAll('\\', '/').startsWith(sourceRoot)) return;

      const event = formatEventStreamMessage('federation-rebuild-complete');

      for (const client of clients) client.write(event);
    },
  };
}

function formatEventStreamMessage(type: string): string {
  return `data: ${JSON.stringify({ type })}\n\n`;
}
