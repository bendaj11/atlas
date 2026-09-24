import { jest } from '@jest/globals';
import { faker } from '@faker-js/faker';
import type { AtlasManifest } from '@atlas/schema';
import { getAtlasNavigation } from '@atlas/sdk';
import type { AtlasAppEntry, AtlasAppMountRequest } from '@atlas/sdk/lifecycle';
import { createTestHostSdk } from '@atlas/testkit';
import { flushAsyncWork } from '@atlas/testkit/internal';
import { AtlasHostAnchorRegistry } from '../dom-host/host-anchors.js';
import { startAtlasHostRuntime } from './host-runtime.js';
import type {
  AtlasHostMountEvent,
  AtlasHostRuntime,
  PublishActiveLayout,
} from './host-runtime.types.js';

type EntryBehavior = (request: AtlasAppMountRequest) => void | Promise<void>;

export class HostRuntimeDriver {
  readonly hostId = faker.string.uuid();
  readonly sdk = createTestHostSdk(this.hostId);
  private readonly anchors = new AtlasHostAnchorRegistry();
  private readonly routeOutlet = document.body.appendChild(
    document.createElement('main'),
  );
  private manifests: AtlasManifest[] = [];
  private resourcesTimeoutMs: number | undefined;
  private readonly entryBehaviors = new Map<string, EntryBehavior>();
  private readonly pendingMounts = new Map<string, () => void>();
  private readonly events: AtlasHostMountEvent[] = [];
  private readonly unmounts = jest.fn<(appId: string) => void>();
  private readonly imports = jest.fn<(appId: string) => void>();
  private readonly setActiveLayout = jest.fn<PublishActiveLayout>();
  private readonly consoleError = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);
  private importFailure: Error | undefined;
  private runtime: AtlasHostRuntime | undefined;

  constructor() {
    this.consoleError.mockClear();
  }

  readonly given = {
    manifests: (manifests: AtlasManifest[]) => {
      this.manifests = manifests;

      return this;
    },
    resourcesTimeoutMs: (timeoutMs: number) => {
      this.resourcesTimeoutMs = timeoutMs;

      return this;
    },
    importFailure: (error: Error) => {
      this.importFailure = error;

      return this;
    },
    entryBehavior: (appId: string, behavior: EntryBehavior) => {
      this.entryBehaviors.set(appId, behavior);

      return this;
    },
    mountBlockedFor: (appId: string) => {
      this.entryBehaviors.set(
        appId,
        () =>
          new Promise<void>((resolve) =>
            this.pendingMounts.set(appId, resolve),
          ),
      );

      return this;
    },
    slotAnchor: (slot: string) => {
      this.anchors.register(
        'slot',
        document.body.appendChild(document.createElement('aside')),
        slot,
      );

      return this;
    },
  };

  readonly when = {
    started: async () => {
      this.runtime = await startAtlasHostRuntime({
        hostId: this.hostId,
        manifests: this.manifests,
        sdk: this.sdk,
        resolveRouteContainer: () => this.routeOutlet,
        resolveSlotContainer: (_manifest, placement) =>
          this.anchors.get('slot', placement.slot!),
        subscribeAnchors: (listener) => this.anchors.subscribe(listener),
        setActiveLayout: this.setActiveLayout,
        onMountStateChange: (event) => this.events.push(event),
        importRemote: (manifest) => this.importRemote(manifest),
        ...(this.resourcesTimeoutMs !== undefined
          ? { resourcesTimeoutMs: this.resourcesTimeoutMs }
          : {}),
      });

      await flushAsyncWork();
    },
    navigatedTo: async (path: string) => {
      getAtlasNavigation(this.sdk).navigate(path);

      await flushAsyncWork();
    },
    slotAnchorRegistered: async (slot: string) => {
      this.anchors.register(
        'slot',
        document.body.appendChild(document.createElement('aside')),
        slot,
      );

      await flushAsyncWork();
    },
    blockedMountReleased: async (appId: string) => {
      this.pendingMounts.get(appId)!();

      await flushAsyncWork();
    },
    retried: (appId: string) => this.runtime!.retry(appId),
    retriedTwiceConcurrently: async (appId: string) => {
      await Promise.all([
        this.runtime!.retry(appId),
        this.runtime!.retry(appId),
      ]);
    },
    waited: (milliseconds: number) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
    stopped: () => this.runtime!.stop(),
  };

  readonly get = {
    states: (appId?: string) =>
      this.events
        .filter((event) => !appId || event.manifest.id === appId)
        .map((event) => event.state),
    lastError: () => this.events.at(-1)?.error,
    importsMock: () => this.imports,
    unmountsMock: () => this.unmounts,
    setActiveLayoutMock: () => this.setActiveLayout,
    consoleErrorMock: () => this.consoleError,
    currentPathname: () =>
      getAtlasNavigation(this.sdk).getCurrentLocation().pathname,
  };

  private async importRemote(manifest: AtlasManifest): Promise<AtlasAppEntry> {
    this.imports(manifest.id);

    if (this.importFailure) throw this.importFailure;

    return {
      mount: async (request) => {
        await this.entryBehaviors.get(manifest.id)?.(request);

        return { unmount: () => this.unmounts(manifest.id) };
      },
    };
  }
}
