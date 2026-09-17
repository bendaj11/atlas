import type { AtlasHostManifest } from '@atlas/schema';
import { jest } from '@jest/globals';
import { watchHostBuildNotifications } from './build-notifications.js';
import type {
  HostLoaderDependencies,
  RemoteMetadata,
} from './host-loader.types.js';

export class BuildNotificationsDriver {
  private eventSourceSupported = true;
  private eventSource: Pick<EventSource, 'onmessage'> | undefined;
  private eventSourceUrl: URL | undefined;
  private readonly reloadPage = jest.fn();

  readonly given = {
    eventSourceSupported: (supported: boolean): BuildNotificationsDriver => {
      this.eventSourceSupported = supported;

      return this;
    },
  };

  readonly when = {
    watched: (input: {
      metadata: RemoteMetadata;
      manifest: AtlasHostManifest;
    }): void => {
      watchHostBuildNotifications({
        ...input,
        dependencies: {
          ...(this.eventSourceSupported
            ? {
                createEventSource: (url: URL) => {
                  this.eventSourceUrl = url;
                  this.eventSource = { onmessage: null };

                  return this.eventSource;
                },
              }
            : {}),
          reloadPage: this.reloadPage,
        } as unknown as HostLoaderDependencies,
      });
    },
    notified: (data: string): void => {
      this.eventSource?.onmessage?.call(
        this.eventSource as EventSource,
        { data } as MessageEvent<string>,
      );
    },
  };

  readonly get = {
    eventSourceUrl: (): URL | undefined => this.eventSourceUrl,
    reloadPageMock: () => this.reloadPage,
  };
}
