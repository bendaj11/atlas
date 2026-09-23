import { jest } from '@jest/globals';
import { faker } from '@faker-js/faker';
import type { AtlasManifest } from '@atlas/schema';
import type { AtlasNavigation, NavigateToPath } from '@atlas/sdk/navigation';
import { createMemoryNavigation } from '@atlas/testkit';
import {
  createHostNavigationItems,
  publishAtlasNavigationItems,
  readAtlasNavigationItems,
  subscribeAtlasNavigationItems,
} from './host-navigation.js';
import type {
  AtlasHostNavigationItem,
  NavigationItemsListener,
} from './host-navigation.types.js';

export class HostNavigationDriver {
  private hostId = faker.string.uuid();
  private manifests: AtlasManifest[] = [];
  private navigation: AtlasNavigation = createMemoryNavigation();
  private readonly navigate = jest.fn<NavigateToPath>();
  private readonly listener = jest.fn<NavigationItemsListener>();
  private items: readonly AtlasHostNavigationItem[] = [];

  readonly given = {
    hostId: (hostId: string) => {
      this.hostId = hostId;

      return this;
    },
    manifests: (manifests: AtlasManifest[]) => {
      this.manifests = manifests;

      return this;
    },
    currentPath: (pathname: string) => {
      this.navigation = createMemoryNavigation(pathname);

      return this;
    },
  };

  readonly when = {
    created: () => {
      this.items = createHostNavigationItems({
        manifests: this.manifests,
        hostId: this.hostId,
        navigation: { ...this.navigation, navigate: this.navigate },
      });
    },
    itemNavigated: (index: number) => this.items[index]!.navigate(),
    subscribed: () => {
      subscribeAtlasNavigationItems(this.listener, document);
    },
    published: () => publishAtlasNavigationItems(document, this.items),
  };

  readonly get = {
    items: () => this.items,
    navigateMock: () => this.navigate,
    listenerMock: () => this.listener,
    readItems: () => readAtlasNavigationItems(document),
  };
}
