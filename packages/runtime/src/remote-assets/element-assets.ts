import { hasQuerySelectorAll, isElement, isNode } from '../shared/dom.js';
import { rewriteCssUrls } from './asset-url/asset-url.js';
import type {
  AssetResolver,
  AtlasAssetRewriteRelease,
  InsertedNodeRewriter,
} from './remote-assets.types.js';

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
): AtlasAssetRewriteRelease {
  return patchElementInsertionMethods(boundary, (nodes) =>
    rewriteInsertedNodes(nodes, resolver),
  );
}

export function patchSingleNodeInsertionMethod(
  element: Element,
  methodName: 'appendChild' | 'insertBefore' | 'replaceChild',
  rewriteInsertedNodes: InsertedNodeRewriter,
): AtlasAssetRewriteRelease {
  const method = element[methodName];

  if (typeof method !== 'function') return () => undefined;
  return patchElementMethod(element, methodName, (...arguments_) => {
    const [node] = arguments_;

    if (isNode(node)) rewriteInsertedNodes([node]);
    return Reflect.apply(method, element, arguments_);
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
  rewriteInsertedNodes: InsertedNodeRewriter,
): AtlasAssetRewriteRelease {
  const releases = [
    patchVariadicInsertionMethod(element, 'append', rewriteInsertedNodes),
    patchVariadicInsertionMethod(element, 'prepend', rewriteInsertedNodes),
    patchVariadicInsertionMethod(
      element,
      'replaceChildren',
      rewriteInsertedNodes,
    ),
    patchSingleNodeInsertionMethod(
      element,
      'appendChild',
      rewriteInsertedNodes,
    ),
    patchSingleNodeInsertionMethod(
      element,
      'insertBefore',
      rewriteInsertedNodes,
    ),
    patchSingleNodeInsertionMethod(
      element,
      'replaceChild',
      rewriteInsertedNodes,
    ),
  ];
  return () => releases.forEach((release) => release());
}

function patchVariadicInsertionMethod(
  element: Element,
  methodName: 'append' | 'prepend' | 'replaceChildren',
  rewriteInsertedNodes: InsertedNodeRewriter,
): AtlasAssetRewriteRelease {
  const method = element[methodName];

  if (typeof method !== 'function') return () => undefined;
  return patchElementMethod(element, methodName, (...arguments_) => {
    rewriteInsertedNodes(arguments_.filter(isNodeOrString));

    return Reflect.apply(method, element, arguments_);
  });
}

function patchElementMethod(
  element: Element,
  methodName: string,
  patchedMethod: (...arguments_: unknown[]) => unknown,
): AtlasAssetRewriteRelease {
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    element,
    methodName,
  );
  Object.defineProperty(element, methodName, {
    configurable: true,
    writable: true,
    value: patchedMethod,
  });
  let active = true;
  return () => {
    if (!active) return;
    active = false;

    if (Reflect.get(element, methodName) !== patchedMethod) return;

    if (originalDescriptor)
      return void Object.defineProperty(
        element,
        methodName,
        originalDescriptor,
      );
    Reflect.deleteProperty(element, methodName);
  };
}

function rewriteInsertedNodes(
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
