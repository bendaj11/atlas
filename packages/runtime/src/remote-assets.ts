import type { AtlasManifest } from "@atlas/schema";

export type AtlasAssetRewriteRelease = () => void;

interface DocumentStyleRewriteSession {
  appId: string;
  boundary: HTMLElement;
  mirroredStyles: Set<Element>;
  resolver: AssetResolver;
  styleTarget: ShadowRoot | undefined;
}

interface DocumentStyleRewriteRegistry {
  sessions: Set<DocumentStyleRewriteSession>;
  sessionsByAppId: Map<string, Set<DocumentStyleRewriteSession>>;
  releaseInsertionRewrite: AtlasAssetRewriteRelease;
}

const ASSET_PATH_TOKEN = "assets/";
const ASSET_PATH_PATTERN = /^(?:\.\/)?assets\//;
const ABSOLUTE_ASSET_PATH_PATTERN = /^\/assets\//;
const URL_FUNCTION_PATTERN = /url\(\s*(?:(["'])(.*?)\1|([^)]*?))\s*\)/g;
const SRCSET_CANDIDATE_PATTERN = /\s*,\s*/;
const ANGULAR_STYLE_SCOPE_PATTERN = /\[(_ng(?:content|host)-[^\]\s=]+)(?:\s*=\s*[^\]]+)?\]/gi;
const ANGULAR_STYLE_APP_ID_PATTERN = /\[_ng(?:content|host)-([^\]\s=]+)-c\d+(?:\s*=\s*[^\]]+)?\]/gi;

const documentStyleRewriteRegistries = new WeakMap<Document, DocumentStyleRewriteRegistry>();

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
  const releaseInsertionRewrite = patchBoundaryInsertion(boundary, resolver);
  const releaseDocumentStyleRewrite = registerDocumentStyleRewrite(document, {
    appId: manifest.id,
    boundary,
    mirroredStyles: new Set(),
    resolver,
    styleTarget: shadowStyleTarget(boundary)
  });
  const observer = observeBoundaryAssets(boundary, resolver);

  return () => {
    releaseInsertionRewrite();
    releaseDocumentStyleRewrite();
    observer?.disconnect();
  };
}

export function rewriteAssetUrl(value: string, manifest: AtlasManifest): string {
  return createRemoteAssetResolver(manifest)(value);
}

export function rewriteCssAssetUrls(cssText: string, manifest: AtlasManifest): string {
  return rewriteCssUrls(cssText, createRemoteAssetResolver(manifest));
}

type AssetResolver = (value: string) => string;
type InsertedNodePreparer = (nodes: readonly (Node | string)[]) => void;

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

function rewriteAssetUrls(root: Element, resolver: AssetResolver): void {
  rewriteElementAssetUrls(root, resolver);
  root.querySelectorAll?.("*").forEach((element) => rewriteElementAssetUrls(element, resolver));
}

function rewriteNodeAssetUrls(node: Node, resolver: AssetResolver): void {
  if (isElement(node)) {
    rewriteAssetUrls(node, resolver);
    return;
  }
  if (hasQuerySelectorAll(node)) {
    node.querySelectorAll("*").forEach((element) => rewriteElementAssetUrls(element, resolver));
  }
}

function patchBoundaryInsertion(element: Element, resolver: AssetResolver): AtlasAssetRewriteRelease {
  return patchElementInsertionMethods(element, (nodes) => prepareInsertedNodes(nodes, resolver));
}

function patchElementInsertionMethods(
  element: Element,
  prepareInsertedNodes: InsertedNodePreparer
): AtlasAssetRewriteRelease {
  const releaseAppend = patchVariadicInsertionMethod(element, "append", prepareInsertedNodes);
  const releasePrepend = patchVariadicInsertionMethod(element, "prepend", prepareInsertedNodes);
  const releaseReplaceChildren = patchVariadicInsertionMethod(element, "replaceChildren", prepareInsertedNodes);
  const releaseAppendChild = patchSingleNodeInsertionMethod(element, "appendChild", prepareInsertedNodes);
  const releaseInsertBefore = patchSingleNodeInsertionMethod(element, "insertBefore", prepareInsertedNodes);
  const releaseReplaceChild = patchSingleNodeInsertionMethod(element, "replaceChild", prepareInsertedNodes);

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
  prepareInsertedNodes: InsertedNodePreparer
): AtlasAssetRewriteRelease {
  const method = element[methodName];
  if (typeof method !== "function") return () => undefined;
  return patchElementMethod(element, methodName, (...args: unknown[]) => {
    const nodes = args.filter(isNodeOrString);
    prepareInsertedNodes(nodes);
    return (method as (...methodArgs: unknown[]) => unknown).apply(element, args);
  });
}

function patchSingleNodeInsertionMethod(
  element: Element,
  methodName: "appendChild" | "insertBefore" | "replaceChild",
  prepareInsertedNodes: InsertedNodePreparer
): AtlasAssetRewriteRelease {
  const method = element[methodName];
  if (typeof method !== "function") return () => undefined;
  return patchElementMethod(element, methodName, (...args: unknown[]) => {
    const [node] = args;
    if (isNode(node)) prepareInsertedNodes([node]);
    return (method as (...methodArgs: unknown[]) => unknown).apply(element, args);
  });
}

function patchElementMethod(element: Element, methodName: string, patched: (...args: unknown[]) => unknown): AtlasAssetRewriteRelease {
  const originalDescriptor = Object.getOwnPropertyDescriptor(element, methodName);
  const methods = element as unknown as Record<string, unknown>;
  Object.defineProperty(element, methodName, { configurable: true, writable: true, value: patched });
  let active = true;

  return () => {
    if (!active) return;
    active = false;
    if (methods[methodName] !== patched) return;
    if (originalDescriptor) {
      Object.defineProperty(element, methodName, originalDescriptor);
      return;
    }
    delete methods[methodName];
  };
}

function prepareInsertedNodes(
  nodes: readonly (Node | string)[],
  resolver: AssetResolver
): void {
  for (const node of nodes) {
    if (typeof node !== "string") rewriteNodeAssetUrls(node, resolver);
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
  rewriteStyleElement(element, resolver);
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

function rewriteStyleElement(element: Element, resolver: AssetResolver): void {
  if (element.tagName.toLowerCase() !== "style" || !element.textContent) return;
  const rewritten = rewriteCssUrls(element.textContent, resolver);
  if (rewritten !== element.textContent) element.textContent = rewritten;
}

function registerDocumentStyleRewrite(
  document: Document | undefined,
  session: DocumentStyleRewriteSession
): AtlasAssetRewriteRelease {
  if (!document?.head || !isElement(document.head)) return () => undefined;
  let registry = documentStyleRewriteRegistries.get(document);
  if (!registry) {
    const sessions = new Set<DocumentStyleRewriteSession>();
    registry = {
      sessions,
      sessionsByAppId: new Map(),
      releaseInsertionRewrite: () => undefined
    };
    registry.releaseInsertionRewrite = patchDocumentStyleInsertion(document.head, registry);
    documentStyleRewriteRegistries.set(document, registry);
  }

  addDocumentStyleRewriteSession(registry, session);
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    if (!registry) return;
    removeDocumentStyleRewriteSession(registry, session);
    if (registry.sessions.size) return;
    registry.releaseInsertionRewrite();
    if (documentStyleRewriteRegistries.get(document) === registry) documentStyleRewriteRegistries.delete(document);
  };
}

function addDocumentStyleRewriteSession(
  registry: DocumentStyleRewriteRegistry,
  session: DocumentStyleRewriteSession
): void {
  registry.sessions.add(session);
  const appId = normalizedAppId(session.appId);
  const sessions = registry.sessionsByAppId.get(appId) ?? new Set<DocumentStyleRewriteSession>();
  sessions.add(session);
  registry.sessionsByAppId.set(appId, sessions);
}

function removeDocumentStyleRewriteSession(
  registry: DocumentStyleRewriteRegistry,
  session: DocumentStyleRewriteSession
): void {
  session.mirroredStyles.forEach((style) => style.remove());
  session.mirroredStyles.clear();
  registry.sessions.delete(session);
  const appId = normalizedAppId(session.appId);
  const sessions = registry.sessionsByAppId.get(appId);
  sessions?.delete(session);
  if (!sessions?.size) registry.sessionsByAppId.delete(appId);
}

function patchDocumentStyleInsertion(
  head: HTMLElement,
  registry: DocumentStyleRewriteRegistry
): AtlasAssetRewriteRelease {
  const prepareStyles = (nodes: readonly (Node | string)[]): void => {
    for (const node of nodes) {
      if (typeof node !== "string") rewriteOwnedDocumentStyles(node, registry);
    }
  };
  return patchSingleNodeInsertionMethod(head, "appendChild", prepareStyles);
}

function rewriteOwnedDocumentStyles(
  root: Node,
  registry: DocumentStyleRewriteRegistry
): void {
  if (isElement(root) && root.tagName.toLowerCase() === "style") {
    rewriteOwnedDocumentStyle(root, registry);
    return;
  }
  if (hasQuerySelectorAll(root)) {
    root.querySelectorAll("style").forEach((style) => rewriteOwnedDocumentStyle(style, registry));
  }
}

function rewriteOwnedDocumentStyle(
  style: Element,
  registry: DocumentStyleRewriteRegistry
): void {
  const cssText = style.textContent;
  if (!cssText) return;
  const owner = findDocumentStyleOwner(cssText, registry);
  if (!owner) return;
  rewriteStyleElement(style, owner.resolver);
  mirrorStyle(style, owner);
}

function mirrorStyle(style: Element, session: DocumentStyleRewriteSession): void {
  if (!session.styleTarget) return;
  const mirroredStyle = style.cloneNode(true) as Element;
  session.styleTarget.appendChild(mirroredStyle);
  session.mirroredStyles.add(mirroredStyle);
}

function shadowStyleTarget(boundary: HTMLElement): ShadowRoot | undefined {
  const root = boundary.getRootNode?.();
  return root && isShadowRoot(root) ? root : undefined;
}

function isShadowRoot(root: Node): root is ShadowRoot {
  return root.nodeType === 11 && "host" in root;
}

function findDocumentStyleOwner(
  cssText: string,
  registry: DocumentStyleRewriteRegistry
): DocumentStyleRewriteSession | undefined {
  const exactOwner = findExactAngularStyleOwner(cssText, registry.sessionsByAppId);
  if (exactOwner) return exactOwner;
  if (registry.sessions.size !== 1) return undefined;

  const scopedAttributeNames = angularStyleScopeAttributeNames(cssText);
  if (!scopedAttributeNames.length) return undefined;
  const [legacyOwner] = registry.sessions;
  return legacyOwner && scopedAttributeNames.some((name) => legacyOwner.boundary.querySelector?.(`[${cssEscape(name)}]`))
    ? legacyOwner
    : undefined;
}

function findExactAngularStyleOwner(
  cssText: string,
  sessionsByAppId: ReadonlyMap<string, ReadonlySet<DocumentStyleRewriteSession>>
): DocumentStyleRewriteSession | undefined {
  let owner: DocumentStyleRewriteSession | undefined;
  for (const match of cssText.matchAll(ANGULAR_STYLE_APP_ID_PATTERN)) {
    const appId = match[1];
    if (!appId) continue;
    const candidate = sessionsByAppId.get(normalizedAppId(appId))?.values().next().value;
    if (!candidate) continue;
    if (owner && normalizedAppId(owner.appId) !== normalizedAppId(candidate.appId)) return undefined;
    owner = candidate;
  }
  return owner;
}

function angularStyleScopeAttributeNames(cssText: string): string[] {
  return [...new Set([...cssText.matchAll(ANGULAR_STYLE_SCOPE_PATTERN)].flatMap((match) => match[1] ? [match[1]] : []))];
}

function normalizedAppId(appId: string): string {
  return appId.toLowerCase();
}

function cssEscape(value: string): string {
  return globalThis.CSS?.escape ? globalThis.CSS.escape(value) : value.replace(/["\\]/g, "\\$&");
}

function rewriteCssUrls(cssText: string, resolver: AssetResolver): string {
  if (!cssText.includes(ASSET_PATH_TOKEN)) return cssText;
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

function hasQuerySelectorAll(node: Node): node is Node & ParentNode {
  return "querySelectorAll" in node && typeof node.querySelectorAll === "function";
}
