import { rewriteCssUrls, type AssetResolver } from './asset-url/asset-url.js';

export type AssetRewriteRelease = () => void;
type InsertedNodePreparer = (nodes: readonly (Node | string)[]) => void;

const URL_ATTRIBUTE_NAMES = ['src', 'href', 'poster', 'data'] as const;
const SRCSET_CANDIDATE_PATTERN = /\s*,\s*/;

export function observeBoundaryAssets(
  boundary: HTMLElement,
  resolver: AssetResolver,
): MutationObserver | undefined {
  const MutationObserverConstructor =
    boundary.ownerDocument?.defaultView?.MutationObserver ??
    globalThis.MutationObserver;
  if (!MutationObserverConstructor) return undefined;
  const observer = new MutationObserverConstructor((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && isElement(mutation.target))
        rewriteElementAssetUrls(mutation.target, resolver);
      else
        mutation.addedNodes.forEach((node) =>
          rewriteNodeAssetUrls(node, resolver),
        );
    }
  });
  observer.observe(boundary, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: [...URL_ATTRIBUTE_NAMES, 'srcset', 'style'],
  });
  return observer;
}

export function rewriteAssetUrls(root: Element, resolver: AssetResolver): void {
  rewriteElementAssetUrls(root, resolver);
  root
    .querySelectorAll?.('*')
    .forEach((element) => rewriteElementAssetUrls(element, resolver));
}

export function patchBoundaryInsertion(
  boundary: HTMLElement,
  resolver: AssetResolver,
): AssetRewriteRelease {
  return patchElementInsertionMethods(boundary, (nodes) =>
    prepareInsertedNodes(nodes, resolver),
  );
}

export function patchSingleNodeInsertionMethod(
  element: Element,
  methodName: 'appendChild' | 'insertBefore' | 'replaceChild',
  prepareInsertedNodes: InsertedNodePreparer,
): AssetRewriteRelease {
  const method = element[methodName];
  if (typeof method !== 'function') return () => undefined;
  return patchElementMethod(element, methodName, (...arguments_) => {
    const [node] = arguments_;
    if (isNode(node)) prepareInsertedNodes([node]);
    return (method as (...methodArguments: unknown[]) => unknown).apply(
      element,
      arguments_,
    );
  });
}

export function rewriteStyleElement(
  element: Element,
  resolver: AssetResolver,
): void {
  if (element.tagName.toLowerCase() !== 'style' || !element.textContent) return;
  const rewrittenStyle = rewriteCssUrls(element.textContent, resolver);
  if (rewrittenStyle !== element.textContent)
    element.textContent = rewrittenStyle;
}

function rewriteNodeAssetUrls(node: Node, resolver: AssetResolver): void {
  if (isElement(node)) return rewriteAssetUrls(node, resolver);
  if (hasQuerySelectorAll(node))
    node
      .querySelectorAll('*')
      .forEach((element) => rewriteElementAssetUrls(element, resolver));
}

function patchElementInsertionMethods(
  element: Element,
  prepareInsertedNodes: InsertedNodePreparer,
): AssetRewriteRelease {
  const releases = [
    patchVariadicInsertionMethod(element, 'append', prepareInsertedNodes),
    patchVariadicInsertionMethod(element, 'prepend', prepareInsertedNodes),
    patchVariadicInsertionMethod(
      element,
      'replaceChildren',
      prepareInsertedNodes,
    ),
    patchSingleNodeInsertionMethod(
      element,
      'appendChild',
      prepareInsertedNodes,
    ),
    patchSingleNodeInsertionMethod(
      element,
      'insertBefore',
      prepareInsertedNodes,
    ),
    patchSingleNodeInsertionMethod(
      element,
      'replaceChild',
      prepareInsertedNodes,
    ),
  ];
  return () => releases.forEach((release) => release());
}

function patchVariadicInsertionMethod(
  element: Element,
  methodName: 'append' | 'prepend' | 'replaceChildren',
  prepareInsertedNodes: InsertedNodePreparer,
): AssetRewriteRelease {
  const method = element[methodName];
  if (typeof method !== 'function') return () => undefined;
  return patchElementMethod(element, methodName, (...arguments_) => {
    prepareInsertedNodes(arguments_.filter(isNodeOrString));
    return (method as (...methodArguments: unknown[]) => unknown).apply(
      element,
      arguments_,
    );
  });
}

function patchElementMethod(
  element: Element,
  methodName: string,
  patchedMethod: (...arguments_: unknown[]) => unknown,
): AssetRewriteRelease {
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    element,
    methodName,
  );
  const methods = element as unknown as Record<string, unknown>;
  Object.defineProperty(element, methodName, {
    configurable: true,
    writable: true,
    value: patchedMethod,
  });
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    if (methods[methodName] !== patchedMethod) return;
    if (originalDescriptor)
      return void Object.defineProperty(
        element,
        methodName,
        originalDescriptor,
      );
    delete methods[methodName];
  };
}

function prepareInsertedNodes(
  nodes: readonly (Node | string)[],
  resolver: AssetResolver,
): void {
  nodes.forEach((node) => {
    if (typeof node !== 'string') rewriteNodeAssetUrls(node, resolver);
  });
}

function rewriteElementAssetUrls(
  element: Element,
  resolver: AssetResolver,
): void {
  URL_ATTRIBUTE_NAMES.forEach((attributeName) =>
    rewriteAttribute(element, attributeName, resolver),
  );
  rewriteSrcsetAttribute(element, resolver);
  rewriteStyleAttribute(element, resolver);
  rewriteStyleElement(element, resolver);
}

function rewriteAttribute(
  element: Element,
  attributeName: string,
  resolver: AssetResolver,
): void {
  const value = element.getAttribute(attributeName);
  if (value === null) return;
  const rewrittenValue = resolver(value);
  if (rewrittenValue !== value)
    element.setAttribute(attributeName, rewrittenValue);
}

function rewriteSrcsetAttribute(
  element: Element,
  resolver: AssetResolver,
): void {
  const srcset = element.getAttribute('srcset');
  if (!srcset) return;
  const rewrittenSrcset = srcset
    .split(SRCSET_CANDIDATE_PATTERN)
    .map((candidate) => rewriteSrcsetCandidate(candidate, resolver))
    .join(', ');
  if (rewrittenSrcset !== srcset)
    element.setAttribute('srcset', rewrittenSrcset);
}

function rewriteSrcsetCandidate(
  candidate: string,
  resolver: AssetResolver,
): string {
  const [url, ...descriptors] = candidate.trim().split(/\s+/);
  return url ? [resolver(url), ...descriptors].join(' ') : candidate;
}

function rewriteStyleAttribute(
  element: Element,
  resolver: AssetResolver,
): void {
  const style = element.getAttribute('style');
  if (!style) return;
  const rewrittenStyle = rewriteCssUrls(style, resolver);
  if (rewrittenStyle !== style) element.setAttribute('style', rewrittenStyle);
}

function isNodeOrString(value: unknown): value is Node | string {
  return typeof value === 'string' || isNode(value);
}
function isNode(value: unknown): value is Node {
  return typeof value === 'object' && value !== null && 'nodeType' in value;
}
function isElement(node: Node | EventTarget): node is Element {
  return typeof Element === 'undefined'
    ? 'getAttribute' in node && 'setAttribute' in node
    : node instanceof Element;
}
function hasQuerySelectorAll(node: Node): node is Node & ParentNode {
  return (
    'querySelectorAll' in node && typeof node.querySelectorAll === 'function'
  );
}
