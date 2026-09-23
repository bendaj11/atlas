import { jest } from '@jest/globals';
import { AtlasHostAnchorRegistry } from './host-anchors.js';
import type {
  AtlasHostAnchorKind,
  AtlasHostAnchorListener,
  ReleaseAnchor,
} from './host-anchors.types.js';

export class HostAnchorsDriver {
  private readonly registry = new AtlasHostAnchorRegistry();
  private readonly listener = jest.fn<AtlasHostAnchorListener>();
  private readonly layoutListener = jest.fn<AtlasHostAnchorListener>();
  private readonly releases: ReleaseAnchor[] = [];
  private error: unknown;

  readonly given = {
    subscribed: () => {
      this.registry.subscribe(this.listener);

      return this;
    },
    layoutsSubscribed: () => {
      this.registry.subscribeLayouts(this.layoutListener);

      return this;
    },
  };

  readonly when = {
    registered: (
      kind: AtlasHostAnchorKind,
      element: HTMLElement,
      name?: string,
    ) => {
      try {
        this.releases.push(this.registry.register(kind, element, name));
      } catch (error) {
        this.error = error;
      }
    },
    released: (index: number) => this.releases[index]!(),
    activeLayoutSet: (layoutId: string | undefined) =>
      this.registry.setActiveLayout(layoutId),
  };

  readonly get = {
    anchor: (kind: Exclude<AtlasHostAnchorKind, 'slot'>) =>
      this.registry.get(kind),
    slot: (name: string) => this.registry.get('slot', name),
    activeLayout: () => this.registry.getActiveLayout(),
    listenerMock: () => this.listener,
    layoutListenerMock: () => this.layoutListener,
    error: () => this.error,
  };
}
