import { jest } from '@jest/globals';
import { faker } from '@faker-js/faker';
import {
  installBrowserCompat,
  replaceNodeChildren,
  timeoutSignal,
} from './browser-compat.js';

type FakeChild = { id: string };

type FakeParent = {
  firstChild: FakeChild | null;
  children: FakeChild[];
  replaceChildren?: (...nodes: FakeChild[]) => void;
  appendChild: (child: FakeChild) => FakeChild;
  removeChild: (child: FakeChild) => FakeChild;
};

const originalTimeout = AbortSignal.timeout;
const originalElement = (globalThis as { Element?: unknown }).Element;

export class BrowserCompatDriver {
  private readonly delay = faker.number.int({ min: 2, max: 5_000 });
  private nativeSignal: AbortSignal | undefined;
  private signal: AbortSignal | undefined;
  private parent: FakeParent | undefined;
  private replacement: FakeChild | undefined;
  private replacedNodes: FakeChild[] | undefined;

  constructor() {
    AbortSignal.timeout = originalTimeout;
    restoreElement(originalElement);
    jest.useRealTimers();
  }

  readonly given = {
    nativeTimeoutApi: (): BrowserCompatDriver => {
      this.nativeSignal = new AbortController().signal;
      AbortSignal.timeout = jest
        .fn<typeof AbortSignal.timeout>()
        .mockReturnValue(this.nativeSignal);
      return this;
    },
    missingTimeoutApi: (): BrowserCompatDriver => {
      Reflect.deleteProperty(AbortSignal, 'timeout');
      jest.useFakeTimers();
      return this;
    },
    parentWithoutReplaceChildren: (): BrowserCompatDriver => {
      this.parent = createFakeParent();
      return this;
    },
    parentWithReplaceChildren: (): BrowserCompatDriver => {
      this.parent = createFakeParent();
      this.parent.replaceChildren = (...nodes: FakeChild[]) => {
        this.replacedNodes = nodes;
      };
      return this;
    },
    existingChild: (): BrowserCompatDriver => {
      const child = { id: faker.string.uuid() };
      this.parent?.appendChild(child);
      return this;
    },
    elementPrototypeWithoutReplaceChildren: (): BrowserCompatDriver => {
      this.parent = createFakeParent();
      this.parent.appendChild({ id: faker.string.uuid() });
      (globalThis as unknown as { Element: { prototype: FakeParent } }).Element =
        {
          prototype: this.parent,
        };
      return this;
    },
  };

  readonly when = {
    createTimeoutSignal: (): BrowserCompatDriver => {
      this.signal = timeoutSignal(this.delay);
      return this;
    },
    elapseDelay: (): BrowserCompatDriver => {
      jest.advanceTimersByTime(this.delay);
      return this;
    },
    elapseBeforeDelay: (): BrowserCompatDriver => {
      jest.advanceTimersByTime(this.delay - 1);
      return this;
    },
    replaceChildren: (): BrowserCompatDriver => {
      replaceNodeChildren(this.parent as unknown as ParentNode);
      return this;
    },
    replaceChildrenWithNode: (): BrowserCompatDriver => {
      this.replacement = { id: faker.string.uuid() };
      replaceNodeChildren(
        this.parent as unknown as ParentNode,
        this.replacement as unknown as Node,
      );
      return this;
    },
    installCompat: (): BrowserCompatDriver => {
      installBrowserCompat();
      return this;
    },
    replaceChildrenOnInstalledElement: (): BrowserCompatDriver => {
      this.parent?.replaceChildren?.();
      return this;
    },
  };

  readonly get = {
    signal: (): AbortSignal | undefined => this.signal,
    nativeSignal: (): AbortSignal | undefined => this.nativeSignal,
    aborted: (): boolean => this.signal?.aborted === true,
    childCount: (): number => this.parent?.children.length ?? 0,
    children: (): FakeChild[] => [...(this.parent?.children ?? [])],
    replacementNode: (): FakeChild | undefined => this.replacement,
    replacedNodes: (): FakeChild[] => this.replacedNodes ?? [],
  };
}

function createFakeParent(): FakeParent {
  const parent: FakeParent = {
    firstChild: null,
    children: [],
    appendChild: (child) => {
      parent.children.push(child);
      parent.firstChild = parent.children[0] ?? null;
      return child;
    },
    removeChild: (child) => {
      const index = parent.children.indexOf(child);
      if (index >= 0) parent.children.splice(index, 1);
      parent.firstChild = parent.children[0] ?? null;
      return child;
    },
  };
  return parent;
}

function restoreElement(original: unknown): void {
  if (original) {
    (globalThis as { Element?: unknown }).Element = original;
    return;
  }

  delete (globalThis as { Element?: unknown }).Element;
}
