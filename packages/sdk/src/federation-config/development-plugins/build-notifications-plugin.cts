import type { Plugin } from 'vite';
import { sourceRootOf } from './source-root.cjs';

interface EventStreamClient {
  write(chunk: string): void;
}

export const BUILD_NOTIFICATIONS_ENDPOINT =
  '/@atlas/federation-build-notifications';

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
          response.write(eventStreamMessage('connected'));

          clients.add(response);
          response.once('close', () => clients.delete(response));
        },
      );
    },

    handleHotUpdate({ file }) {
      if (!file.replaceAll('\\', '/').startsWith(sourceRoot)) return;

      const event = eventStreamMessage('federation-rebuild-complete');
      for (const client of clients) client.write(event);
    },
  };
}

function eventStreamMessage(type: string): string {
  return `data: ${JSON.stringify({ type })}\n\n`;
}
