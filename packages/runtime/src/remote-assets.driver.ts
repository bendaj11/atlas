import type { AtlasManifest } from '@atlas/schema';
import {
  startRemoteAssetRewrite,
  type AtlasAssetRewriteRelease,
} from './remote-assets.js';

interface TestElement extends HTMLElement {
  testChildren: TestElement[];
}

export class RemoteAssetsDriver {
  private readonly boundary = createElement('div');
  private readonly head = createElement('head');
  private readonly shadowRoot = createElement('shadow-root', 11);
  private readonly document = Object.assign(Object.create(null), {
    head: this.head,
  }) as Document;
  private release: AtlasAssetRewriteRelease = () => undefined;

  constructor() {
    Object.assign(this.boundary, {
      ownerDocument: this.document,
      getRootNode: () => this.shadowRoot,
    });
    Object.assign(this.shadowRoot, { host: this.boundary });
  }

  givenApp(appId: string): void {
    this.release = startRemoteAssetRewrite(
      createManifest(appId),
      this.boundary,
      this.document,
    );
  }

  whenAngularAddsComponentStyle(appId: string): void {
    const style = createElement('style');
    style.textContent = `.title[_ngcontent-${appId}-c0]{color:rebeccapurple}`;
    this.head.appendChild(style);
  }

  whenAppUnmounts(): void {
    this.release();
  }

  getShadowStyleTexts(): string[] {
    return this.shadowRoot.testChildren.map((style) => style.textContent ?? '');
  }
}

function createManifest(id: string): AtlasManifest {
  return {
    id,
    name: id,
    version: '1.0.0',
    schemaVersion: '1',
    kind: 'app',
    buildId: 'build',
    channel: 'production',
    framework: 'angular',
    isolation: 'shadow-dom',
    remoteEntryUrl: `https://cdn.example/${id}/remoteEntry.json`,
    exposes: { entry: './entry' },
    requiredHostSdkVersion: '^1.0.0',
    supportedHosts: ['*'],
    placements: [],
    createdAt: '2026-08-11T00:00:00.000Z',
  };
}

function createElement(tagName: string, nodeType = 1): TestElement {
  const element = Object.create(null) as TestElement;
  const attributes = new Map<string, string>();
  element.testChildren = [];
  Object.defineProperties(element, {
    nodeType: { value: nodeType },
    tagName: { value: tagName.toUpperCase() },
  });
  element.getAttribute = (name) => attributes.get(name) ?? null;
  element.setAttribute = (name, value) => void attributes.set(name, value);
  Object.defineProperty(element, 'querySelectorAll', {
    value: () => element.testChildren,
  });
  element.append = (...nodes) => appendElements(element, nodes);
  element.prepend = (...nodes) => appendElements(element, nodes);
  element.replaceChildren = (...nodes) => {
    element.testChildren = nodes.filter(isTestElement);
  };
  element.appendChild = (node) => {
    appendElements(element, [node]);
    return node;
  };
  element.insertBefore = element.appendChild;
  element.replaceChild = (node, oldNode) => {
    const index = isTestElement(oldNode)
      ? element.testChildren.indexOf(oldNode)
      : -1;
    if (index >= 0 && isTestElement(node)) element.testChildren[index] = node;
    return oldNode;
  };
  element.cloneNode = () => {
    const clone = createElement(tagName);
    clone.textContent = element.textContent;
    return clone;
  };
  return element;
}

function appendElements(
  parent: TestElement,
  nodes: readonly (Node | string)[],
): void {
  for (const node of nodes) {
    if (!isTestElement(node)) continue;
    parent.testChildren.push(node);
    node.remove = () => {
      parent.testChildren = parent.testChildren.filter(
        (child) => child !== node,
      );
    };
  }
}

function isTestElement(value: unknown): value is TestElement {
  return typeof value === 'object' && value !== null && 'testChildren' in value;
}
