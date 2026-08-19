import type { AssetResolver } from './asset-url/asset-url.js';
import {
  patchSingleNodeInsertionMethod,
  rewriteStyleElement,
  type AssetRewriteRelease,
} from './element-assets.js';

export interface DocumentStyleRewriteSession {
  readonly appId: string;
  readonly boundary: HTMLElement;
  readonly mirroredStyles: Set<Element>;
  readonly resolver: AssetResolver;
  readonly styleTarget: ShadowRoot | undefined;
}

interface DocumentStyleRewriteRegistry {
  readonly sessions: Set<DocumentStyleRewriteSession>;
  readonly sessionsByAppId: Map<string, Set<DocumentStyleRewriteSession>>;
  releaseInsertionRewrite: AssetRewriteRelease;
}

const ANGULAR_STYLE_SCOPE_PATTERN =
  /\[(_ng(?:content|host)-[^\]\s=]+)(?:\s*=\s*[^\]]+)?\]/gi;
const ANGULAR_STYLE_APP_ID_PATTERN =
  /\[_ng(?:content|host)-([^\]\s=]+)-c\d+(?:\s*=\s*[^\]]+)?\]/gi;
const documentStyleRewriteRegistries = new WeakMap<
  Document,
  DocumentStyleRewriteRegistry
>();

export function createDocumentStyleRewriteSession(
  appId: string,
  boundary: HTMLElement,
  resolver: AssetResolver,
): DocumentStyleRewriteSession {
  return {
    appId,
    boundary,
    mirroredStyles: new Set(),
    resolver,
    styleTarget: shadowStyleTarget(boundary),
  };
}

export function registerDocumentStyleRewrite(
  document: Document | undefined,
  session: DocumentStyleRewriteSession,
): AssetRewriteRelease {
  if (!document?.head || !isElement(document.head)) return () => undefined;
  const registry =
    documentStyleRewriteRegistries.get(document) ??
    createDocumentStyleRewriteRegistry(document);
  addDocumentStyleRewriteSession(registry, session);
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    removeDocumentStyleRewriteSession(registry, session);
    if (registry.sessions.size) return;
    registry.releaseInsertionRewrite();
    if (documentStyleRewriteRegistries.get(document) === registry)
      documentStyleRewriteRegistries.delete(document);
  };
}

function createDocumentStyleRewriteRegistry(
  document: Document,
): DocumentStyleRewriteRegistry {
  const registry: DocumentStyleRewriteRegistry = {
    sessions: new Set(),
    sessionsByAppId: new Map(),
    releaseInsertionRewrite: () => undefined,
  };
  registry.releaseInsertionRewrite = patchDocumentStyleInsertion(
    document.head,
    registry,
  );
  documentStyleRewriteRegistries.set(document, registry);
  return registry;
}

function addDocumentStyleRewriteSession(
  registry: DocumentStyleRewriteRegistry,
  session: DocumentStyleRewriteSession,
): void {
  registry.sessions.add(session);
  const appId = normalizedAppId(session.appId);
  const sessions =
    registry.sessionsByAppId.get(appId) ??
    new Set<DocumentStyleRewriteSession>();
  sessions.add(session);
  registry.sessionsByAppId.set(appId, sessions);
}

function removeDocumentStyleRewriteSession(
  registry: DocumentStyleRewriteRegistry,
  session: DocumentStyleRewriteSession,
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
  registry: DocumentStyleRewriteRegistry,
): AssetRewriteRelease {
  return patchSingleNodeInsertionMethod(head, 'appendChild', (nodes) => {
    nodes.forEach((node) => {
      if (typeof node !== 'string') rewriteOwnedDocumentStyles(node, registry);
    });
  });
}

function rewriteOwnedDocumentStyles(
  root: Node,
  registry: DocumentStyleRewriteRegistry,
): void {
  if (isElement(root) && root.tagName.toLowerCase() === 'style')
    return rewriteOwnedDocumentStyle(root, registry);
  if (
    'querySelectorAll' in root &&
    typeof root.querySelectorAll === 'function'
  ) {
    const styles = root.querySelectorAll('style') as NodeListOf<Element>;
    styles.forEach((style) => rewriteOwnedDocumentStyle(style, registry));
  }
}

function rewriteOwnedDocumentStyle(
  style: Element,
  registry: DocumentStyleRewriteRegistry,
): void {
  const cssText = style.textContent;
  if (!cssText) return;
  const owner = findDocumentStyleOwner(cssText, registry);
  if (!owner) return;
  rewriteStyleElement(style, owner.resolver);
  mirrorStyle(style, owner);
}

function mirrorStyle(
  style: Element,
  session: DocumentStyleRewriteSession,
): void {
  if (!session.styleTarget) return;
  const mirroredStyle = style.cloneNode(true) as Element;
  session.styleTarget.appendChild(mirroredStyle);
  session.mirroredStyles.add(mirroredStyle);
}

function shadowStyleTarget(boundary: HTMLElement): ShadowRoot | undefined {
  const root = boundary.getRootNode?.();
  return root && root.nodeType === 11 && 'host' in root
    ? (root as ShadowRoot)
    : undefined;
}

function findDocumentStyleOwner(
  cssText: string,
  registry: DocumentStyleRewriteRegistry,
): DocumentStyleRewriteSession | undefined {
  const exactOwner = findExactAngularStyleOwner(
    cssText,
    registry.sessionsByAppId,
  );
  if (exactOwner) return exactOwner;
  if (registry.sessions.size !== 1) return undefined;
  const [legacyOwner] = registry.sessions;
  return legacyOwner &&
    angularStyleScopeAttributeNames(cssText).some((attributeName) =>
      legacyOwner.boundary.querySelector?.(`[${cssEscape(attributeName)}]`),
    )
    ? legacyOwner
    : undefined;
}

function findExactAngularStyleOwner(
  cssText: string,
  sessionsByAppId: ReadonlyMap<
    string,
    ReadonlySet<DocumentStyleRewriteSession>
  >,
): DocumentStyleRewriteSession | undefined {
  let owner: DocumentStyleRewriteSession | undefined;
  for (const match of cssText.matchAll(ANGULAR_STYLE_APP_ID_PATTERN)) {
    const appId = match[1];
    if (!appId) continue;
    const candidate = sessionsByAppId
      .get(normalizedAppId(appId))
      ?.values()
      .next().value;
    if (
      !candidate ||
      (owner &&
        normalizedAppId(owner.appId) !== normalizedAppId(candidate.appId))
    )
      return undefined;
    owner = candidate;
  }
  return owner;
}

function angularStyleScopeAttributeNames(cssText: string): string[] {
  return [
    ...new Set(
      [...cssText.matchAll(ANGULAR_STYLE_SCOPE_PATTERN)].flatMap((match) =>
        match[1] ? [match[1]] : [],
      ),
    ),
  ];
}

function normalizedAppId(appId: string): string {
  return appId.toLowerCase();
}
function cssEscape(value: string): string {
  return globalThis.CSS?.escape
    ? globalThis.CSS.escape(value)
    : value.replace(/["\\]/g, '\\$&');
}
function isElement(node: Node | EventTarget): node is Element {
  return typeof Element === 'undefined'
    ? 'getAttribute' in node && 'setAttribute' in node
    : node instanceof Element;
}
