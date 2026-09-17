type PrototypeOwner = { prototype: object };

const globalScope = globalThis as typeof globalThis & {
  Element?: PrototypeOwner;
  Document?: PrototypeOwner;
  DocumentFragment?: PrototypeOwner;
};

export function timeoutSignal(milliseconds: number): AbortSignal {
  if (typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(milliseconds);
  }

  return createTimeoutSignal(milliseconds);
}

export function replaceNodeChildren(
  parent: ParentNode,
  ...nodes: Array<Node | string>
): void {
  if (typeof parent.replaceChildren === 'function') {
    parent.replaceChildren(...nodes);
    return;
  }

  replaceNodeChildrenFallback(parent, nodes);
}

export function installBrowserCompat(): void {
  if (typeof AbortSignal.timeout !== 'function') {
    AbortSignal.timeout = createTimeoutSignal;
  }

  for (const constructor of [
    globalScope.Element,
    globalScope.Document,
    globalScope.DocumentFragment,
  ]) {
    installReplaceChildren(constructor?.prototype);
  }
}

function createTimeoutSignal(milliseconds: number): AbortSignal {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, milliseconds);

  controller.signal.addEventListener(
    'abort',
    () => {
      clearTimeout(timeoutId);
    },
    { once: true },
  );

  return controller.signal;
}

function installReplaceChildren(prototype: object | undefined): void {
  if (
    !prototype ||
    typeof (prototype as ParentNode).replaceChildren === 'function'
  ) {
    return;
  }

  Object.defineProperty(prototype, 'replaceChildren', {
    configurable: true,
    writable: true,
    value: function replaceChildren(
      this: ParentNode,
      ...nodes: Array<Node | string>
    ): void {
      replaceNodeChildrenFallback(this, nodes);
    },
  });
}

function replaceNodeChildrenFallback(
  parent: ParentNode,
  nodes: Array<Node | string>,
): void {
  while (parent.firstChild) {
    parent.removeChild(parent.firstChild);
  }

  if (nodes.length === 0) return;

  if (typeof parent.append === 'function') {
    parent.append(...nodes);
    return;
  }

  for (const node of nodes) {
    parent.appendChild(toChildNode(parent, node));
  }
}

function toChildNode(parent: ParentNode, node: Node | string): Node {
  if (typeof node !== 'string') return node;

  const owner = parent.ownerDocument ?? (parent as Document);
  return owner.createTextNode(node);
}
