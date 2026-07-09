import type { AtlasManifest } from "@atlas/schema";

export type AtlasAssetRewriteRelease = () => void;

const ASSET_PATH_PATTERN = /^(?:\.\/)?assets\//;
const ABSOLUTE_ASSET_PATH_PATTERN = /^\/assets\//;
const URL_FUNCTION_PATTERN = /url\(\s*(?:(["'])(.*?)\1|([^)]*?))\s*\)/g;
const SRCSET_CANDIDATE_PATTERN = /\s*,\s*/;

const URL_ATTRIBUTE_NAMES = [
  "src",
  "href",
  "poster",
  "data"
] as const;

export function startRemoteAssetRewrite(
  manifest: AtlasManifest,
  boundary: HTMLElement,
  document: Document | undefined = boundary.ownerDocument ?? globalThis.document
): AtlasAssetRewriteRelease {
  if (!isElement(boundary)) return () => undefined;
  const resolver = createRemoteAssetResolver(manifest);
  rewriteAssetUrls(boundary, resolver);
  const releaseInsertionRewrite = patchElementInsertion(boundary, resolver);
  const observers = [
    observeBoundaryAssets(boundary, resolver),
    observeRemoteStyleAssets(document, resolver)
  ].filter((observer): observer is MutationObserver => observer !== undefined);

  return () => {
    releaseInsertionRewrite();
    observers.forEach((observer) => observer.disconnect());
  };
}

export function rewriteAssetUrl(value: string, manifest: AtlasManifest): string {
  return createRemoteAssetResolver(manifest)(value);
}

export function rewriteCssAssetUrls(cssText: string, manifest: AtlasManifest): string {
  return rewriteCssUrls(cssText, createRemoteAssetResolver(manifest));
}

type AssetResolver = (value: string) => string;

function createRemoteAssetResolver(manifest: AtlasManifest): AssetResolver {
  const remoteEntryUrl = new URL(manifest.remoteEntryUrl, globalThis.location?.href ?? "http://atlas.local");
  const remoteOrigin = remoteEntryUrl.origin;
  const remoteDirectory = new URL(".", remoteEntryUrl);

  return (value) => {
    const trimmed = value.trim();
    if (isExternalUrl(trimmed) || isFragmentUrl(trimmed)) return value;
    if (ABSOLUTE_ASSET_PATH_PATTERN.test(trimmed)) return `${remoteOrigin}${trimmed}`;
    if (ASSET_PATH_PATTERN.test(trimmed)) return new URL(trimmed.replace(/^\.\//, ""), remoteDirectory).href;
    return value;
  };
}

function observeBoundaryAssets(boundary: HTMLElement, resolver: AssetResolver): MutationObserver | undefined {
  const MutationObserverConstructor = boundary.ownerDocument?.defaultView?.MutationObserver ?? globalThis.MutationObserver;
  if (!MutationObserverConstructor) return undefined;

  const observer = new MutationObserverConstructor((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes" && isElement(mutation.target)) {
        rewriteElementAssetUrls(mutation.target, resolver);
        continue;
      }
      mutation.addedNodes.forEach((node) => rewriteNodeAssetUrls(node, resolver));
    }
  });
  observer.observe(boundary, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: [...URL_ATTRIBUTE_NAMES, "srcset", "style"]
  });
  return observer;
}

function observeRemoteStyleAssets(document: Document | undefined, resolver: AssetResolver): MutationObserver | undefined {
  if (!document?.head) return undefined;
  const MutationObserverConstructor = document.defaultView?.MutationObserver ?? globalThis.MutationObserver;
  if (!MutationObserverConstructor) return undefined;

  const knownStyleElements = new WeakSet<HTMLStyleElement>();
  document.head.querySelectorAll?.("style").forEach((element) => knownStyleElements.add(element));
  const observer = new MutationObserverConstructor((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => rewriteNewStyleNode(node, knownStyleElements, resolver));
    }
  });
  observer.observe(document.head, { childList: true, subtree: true });
  return observer;
}

function rewriteNewStyleNode(node: Node, knownStyleElements: WeakSet<HTMLStyleElement>, resolver: AssetResolver): void {
  if (isStyleElement(node)) {
    if (!knownStyleElements.has(node as HTMLStyleElement)) {
      knownStyleElements.add(node as HTMLStyleElement);
      node.textContent = rewriteCssUrls(node.textContent ?? "", resolver);
    }
    return;
  }

  if (!isElement(node)) return;
  node.querySelectorAll?.("style").forEach((styleElement) => rewriteNewStyleNode(styleElement, knownStyleElements, resolver));
}

function rewriteAssetUrls(root: Element, resolver: AssetResolver): void {
  rewriteElementAssetUrls(root, resolver);
  root.querySelectorAll?.("*").forEach((element) => rewriteElementAssetUrls(element, resolver));
}

function rewriteNodeAssetUrls(node: Node, resolver: AssetResolver): void {
  if (isElement(node)) rewriteAssetUrls(node, resolver);
}

function patchElementInsertion(element: Element, resolver: AssetResolver): AtlasAssetRewriteRelease {
  const state: ElementInsertionPatchState = { patchedElements: new WeakSet(), releases: [] };
  patchElementAndChildren(element, resolver, state);

  return () => state.releases.forEach((release) => release());
}

interface ElementInsertionPatchState {
  patchedElements: WeakSet<Element>;
  releases: AtlasAssetRewriteRelease[];
}

function patchElementAndChildren(
  element: Element,
  resolver: AssetResolver,
  state: ElementInsertionPatchState
): void {
  patchSingleElementInsertion(element, resolver, state);
  element.querySelectorAll?.("*").forEach((child) => {
    if (isElement(child)) patchSingleElementInsertion(child, resolver, state);
  });
}

function patchSingleElementInsertion(
  element: Element,
  resolver: AssetResolver,
  state: ElementInsertionPatchState
): void {
  if (state.patchedElements.has(element)) return;
  state.patchedElements.add(element);
  state.releases.push(patchElementInsertionMethods(element, resolver, state));
}

function patchElementInsertionMethods(
  element: Element,
  resolver: AssetResolver,
  state: ElementInsertionPatchState
): AtlasAssetRewriteRelease {
  const releaseAppend = patchVariadicInsertionMethod(element, "append", resolver, state);
  const releasePrepend = patchVariadicInsertionMethod(element, "prepend", resolver, state);
  const releaseReplaceChildren = patchVariadicInsertionMethod(element, "replaceChildren", resolver, state);
  const releaseAppendChild = patchSingleNodeInsertionMethod(element, "appendChild", resolver, state);
  const releaseInsertBefore = patchSingleNodeInsertionMethod(element, "insertBefore", resolver, state);
  const releaseReplaceChild = patchSingleNodeInsertionMethod(element, "replaceChild", resolver, state);

  return () => {
    releaseAppend();
    releasePrepend();
    releaseReplaceChildren();
    releaseAppendChild();
    releaseInsertBefore();
    releaseReplaceChild();
  };
}

function patchVariadicInsertionMethod(
  element: Element,
  methodName: "append" | "prepend" | "replaceChildren",
  resolver: AssetResolver,
  state: ElementInsertionPatchState
): AtlasAssetRewriteRelease {
  const method = element[methodName];
  if (typeof method !== "function") return () => undefined;
  return patchElementMethod(element, methodName, (...args: unknown[]) => {
    const nodes = args.filter(isNodeOrString);
    prepareInsertedNodes(nodes, resolver, state);
    return (method as (...methodArgs: unknown[]) => unknown).apply(element, args);
  });
}

function patchSingleNodeInsertionMethod(
  element: Element,
  methodName: "appendChild" | "insertBefore" | "replaceChild",
  resolver: AssetResolver,
  state: ElementInsertionPatchState
): AtlasAssetRewriteRelease {
  const method = element[methodName];
  if (typeof method !== "function") return () => undefined;
  return patchElementMethod(element, methodName, (node: unknown, otherNode?: unknown) => {
    if (!isNode(node)) return (method as (...methodArgs: unknown[]) => unknown).call(element, node, otherNode);
    prepareInsertedNodes([node], resolver, state);
    return (method as (...methodArgs: unknown[]) => unknown).call(element, node, otherNode);
  });
}

function patchElementMethod(element: Element, methodName: string, patched: (...args: unknown[]) => unknown): AtlasAssetRewriteRelease {
  const hadOwnMethod = Object.hasOwn(element, methodName);
  const originalOwnMethod = (element as unknown as Record<string, unknown>)[methodName];
  Object.defineProperty(element, methodName, { configurable: true, value: patched });

  return () => {
    if (hadOwnMethod) {
      Object.defineProperty(element, methodName, { configurable: true, value: originalOwnMethod });
      return;
    }
    delete (element as unknown as Record<string, unknown>)[methodName];
  };
}

function prepareInsertedNodes(
  nodes: readonly (Node | string)[],
  resolver: AssetResolver,
  state: ElementInsertionPatchState
): void {
  for (const node of nodes) {
    if (typeof node === "string" || !isElement(node)) continue;
    rewriteAssetUrls(node, resolver);
    patchElementAndChildren(node, resolver, state);
  }
}

function isNodeOrString(value: unknown): value is Node | string {
  return typeof value === "string" || isNode(value);
}

function rewriteElementAssetUrls(element: Element, resolver: AssetResolver): void {
  for (const attributeName of URL_ATTRIBUTE_NAMES) {
    rewriteAttribute(element, attributeName, resolver);
  }
  rewriteSrcsetAttribute(element, resolver);
  rewriteStyleAttribute(element, resolver);
}

function rewriteAttribute(element: Element, attributeName: string, resolver: AssetResolver): void {
  const value = element.getAttribute(attributeName);
  if (value === null) return;
  const next = resolver(value);
  if (next !== value) element.setAttribute(attributeName, next);
}

function rewriteSrcsetAttribute(element: Element, resolver: AssetResolver): void {
  const srcset = element.getAttribute("srcset");
  if (!srcset) return;
  const rewritten = srcset
    .split(SRCSET_CANDIDATE_PATTERN)
    .map((candidate) => rewriteSrcsetCandidate(candidate, resolver))
    .join(", ");
  if (rewritten !== srcset) element.setAttribute("srcset", rewritten);
}

function rewriteSrcsetCandidate(candidate: string, resolver: AssetResolver): string {
  const [url, ...descriptors] = candidate.trim().split(/\s+/);
  if (!url) return candidate;
  return [resolver(url), ...descriptors].join(" ");
}

function rewriteStyleAttribute(element: Element, resolver: AssetResolver): void {
  const style = element.getAttribute("style");
  if (!style) return;
  const rewritten = rewriteCssUrls(style, resolver);
  if (rewritten !== style) element.setAttribute("style", rewritten);
}

function rewriteCssUrls(cssText: string, resolver: AssetResolver): string {
  return cssText.replace(URL_FUNCTION_PATTERN, (_match, quote: string | undefined, quotedValue: string | undefined, unquotedValue: string | undefined) => {
    const rawValue = quotedValue ?? unquotedValue ?? "";
    const rewritten = resolver(rawValue);
    const nextQuote = quote ?? "";
    return `url(${nextQuote}${rewritten}${nextQuote})`;
  });
}

function isExternalUrl(value: string): boolean {
  return /^[a-z][a-z\d+\-.]*:/i.test(value) || value.startsWith("//");
}

function isFragmentUrl(value: string): boolean {
  return value.startsWith("#");
}

function isNode(value: unknown): value is Node {
  return typeof value === "object" && value !== null && "nodeType" in value;
}

function isElement(node: Node | EventTarget): node is Element {
  return typeof Element === "undefined"
    ? "getAttribute" in node && "setAttribute" in node
    : node instanceof Element;
}

function isStyleElement(node: Node): node is HTMLStyleElement {
  return typeof HTMLStyleElement === "undefined"
    ? isElement(node) && node.tagName?.toLowerCase() === "style"
    : node instanceof HTMLStyleElement;
}
