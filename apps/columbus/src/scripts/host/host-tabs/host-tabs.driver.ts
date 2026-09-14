import type { AtlasHostData as HostData } from '../../../types/contracts';
import { aHostData, aManifest } from '../../../types/app.testkit';
import {
  type FakeChrome,
  type FakeTab,
  installFakeChrome,
} from '../../chrome.testkit';
import {
  findAtlasHostTab,
  type InspectedHostTab,
  reloadHostTab,
  requestArtifactVersion,
} from './host-tabs';

export class HostTabsDriver {
  private readonly chrome: FakeChrome = installFakeChrome();
  private readonly hosts = new Map<number, HostData>();
  private artifactVersionResponse: unknown = {
    ok: true,
    manifest: aManifest(),
  };
  private found: InspectedHostTab | undefined;
  private error: unknown;

  constructor() {
    this.chrome.onTabMessage = async (tabId, message) => {
      if (isInspectRequest(message)) return this.inspectionResponse(tabId);

      return this.artifactVersionResponse;
    };
  }

  readonly given = {
    tabs: (tabs: FakeTab[]): this => {
      this.chrome.tabs = tabs;

      return this;
    },
    atlasHost: (tabId: number, hostData: HostData = aHostData()): this => {
      this.hosts.set(tabId, hostData);

      return this;
    },
    artifactVersionResponse: (response: unknown): this => {
      this.artifactVersionResponse = response;

      return this;
    },
  };

  readonly when = {
    hostTabSearched: async (): Promise<this> => {
      try {
        this.found = await findAtlasHostTab();
      } catch (error) {
        this.error = error;
      }

      return this;
    },
    artifactVersionRequested: async (): Promise<this> => {
      try {
        await requestArtifactVersion(7, 'app:orders', 'production:1.0.0:b1');
      } catch (error) {
        this.error = error;
      }

      return this;
    },
    tabReloaded: async (tabId: number): Promise<this> => {
      await reloadHostTab(tabId);

      return this;
    },
  };

  readonly get = {
    foundTabId: (): number | undefined => this.found?.tab.id,
    foundHostId: (): string | undefined => this.found?.hostData.config.hostId,
    error: (): unknown => this.error,
    errorMessage: (): string | undefined =>
      this.error instanceof Error ? this.error.message : undefined,
    inspectedTabIds: (): number[] =>
      this.chrome.tabMessages
        .filter(({ message }) => isInspectRequest(message))
        .map(({ tabId }) => tabId),
    lastTabMessage: (): unknown => this.chrome.tabMessages.at(-1)?.message,
    reloadedTabIds: (): number[] => this.chrome.reloadedTabIds,
  };

  private inspectionResponse(tabId: number): unknown {
    const hostData = this.hosts.get(tabId);

    return hostData
      ? { ok: true, hostData }
      : { ok: false, error: 'No Atlas runtime on this page.' };
  }
}

function isInspectRequest(message: unknown): boolean {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as { type?: unknown }).type === 'atlas.inspect-host'
  );
}
