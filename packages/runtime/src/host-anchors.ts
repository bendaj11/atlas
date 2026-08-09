export type AtlasHostAnchorKind =
  'status' | 'navigation' | 'route-outlet' | 'slot';

export type AtlasHostAnchorListener = () => void;

/** Shared lifecycle registry used by native host anchor components. */
export class AtlasHostAnchorRegistry {
  private readonly anchors = new Map<string, HTMLElement>();
  private readonly listeners = new Set<AtlasHostAnchorListener>();
  private readonly layoutListeners = new Set<AtlasHostAnchorListener>();
  private activeLayoutId: string | undefined;

  register(
    kind: AtlasHostAnchorKind,
    element: HTMLElement,
    name?: string,
  ): () => void {
    const key = anchorKey(kind, name);
    this.anchors.set(key, element);
    this.notify();
    return () => {
      if (this.anchors.get(key) !== element) return;
      this.anchors.delete(key);
      this.notify();
    };
  }

  get(kind: Exclude<AtlasHostAnchorKind, 'slot'>): HTMLElement | undefined;
  get(kind: 'slot', name: string): HTMLElement | undefined;
  get(kind: AtlasHostAnchorKind, name?: string): HTMLElement | undefined {
    return this.anchors.get(anchorKey(kind, name));
  }

  subscribe(listener: AtlasHostAnchorListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setActiveLayout(layoutId: string | undefined): void {
    if (this.activeLayoutId === layoutId) return;
    this.activeLayoutId = layoutId;
    for (const listener of this.layoutListeners) listener();
  }

  getActiveLayout(): string | undefined {
    return this.activeLayoutId;
  }

  subscribeLayouts(listener: AtlasHostAnchorListener): () => void {
    this.layoutListeners.add(listener);
    return () => this.layoutListeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}

function anchorKey(kind: AtlasHostAnchorKind, name?: string): string {
  if (kind !== 'slot') return kind;
  if (!name) throw new Error('Atlas slot anchors require a name.');
  return `slot:${name}`;
}
