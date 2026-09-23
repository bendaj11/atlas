import { AtlasSlotNameMissingError } from './dom-host.errors.js';
import type {
  AtlasHostAnchorKind,
  AtlasHostAnchorListener,
  ReleaseAnchor,
  UnsubscribeAnchorListener,
} from './host-anchors.types.js';

/** Shared lifecycle registry used by native host anchor components. */
export class AtlasHostAnchorRegistry {
  private readonly anchorsByKey = new Map<string, HTMLElement>();
  private readonly anchorListeners = new Set<AtlasHostAnchorListener>();
  private readonly layoutListeners = new Set<AtlasHostAnchorListener>();
  private activeLayoutId: string | undefined;

  register(
    kind: AtlasHostAnchorKind,
    element: HTMLElement,
    name?: string,
  ): ReleaseAnchor {
    const key = createAnchorKey(kind, name);

    this.anchorsByKey.set(key, element);
    this.notifyAnchorListeners();

    return () => {
      if (this.anchorsByKey.get(key) !== element) return;

      this.anchorsByKey.delete(key);
      this.notifyAnchorListeners();
    };
  }

  get(kind: Exclude<AtlasHostAnchorKind, 'slot'>): HTMLElement | undefined;
  get(kind: 'slot', name: string): HTMLElement | undefined;
  get(kind: AtlasHostAnchorKind, name?: string): HTMLElement | undefined {
    return this.anchorsByKey.get(createAnchorKey(kind, name));
  }

  subscribe(listener: AtlasHostAnchorListener): UnsubscribeAnchorListener {
    this.anchorListeners.add(listener);

    return () => this.anchorListeners.delete(listener);
  }

  setActiveLayout(layoutId: string | undefined): void {
    if (this.activeLayoutId === layoutId) return;

    this.activeLayoutId = layoutId;

    for (const listener of this.layoutListeners) listener();
  }

  getActiveLayout(): string | undefined {
    return this.activeLayoutId;
  }

  subscribeLayouts(
    listener: AtlasHostAnchorListener,
  ): UnsubscribeAnchorListener {
    this.layoutListeners.add(listener);

    return () => this.layoutListeners.delete(listener);
  }

  private notifyAnchorListeners(): void {
    for (const listener of this.anchorListeners) listener();
  }
}

function createAnchorKey(kind: AtlasHostAnchorKind, name?: string): string {
  if (kind !== 'slot') return kind;

  if (!name) throw new AtlasSlotNameMissingError();

  return `slot:${name}`;
}
