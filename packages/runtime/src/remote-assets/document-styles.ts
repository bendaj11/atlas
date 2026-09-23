import { hasQuerySelectorAll, isElement } from '../shared/dom.js';
import {
  patchSingleNodeInsertionMethod,
  rewriteStyleElement,
} from './element-assets.js';
import type {
  AssetResolver,
  AtlasAssetRewriteRelease,
  DocumentStyleRewriteRegistry,
  DocumentStyleRewriteSession,
} from './remote-assets.types.js';

const ANGULAR_STYLE_SCOPE_PATTERN =
  /\[(_ng(?:content|host)-[^\]\s=]+)(?:\s*=\s*[^\]]+)?\]/gi;
const ANGULAR_STYLE_APP_ID_PATTERN =
  /\[_ng(?:content|host)-([^\]\s=]+)-c\d+(?:\s*=\s*[^\]]+)?\]/gi;
const documentStyleRewriteRegistries = new WeakMap<
  Document,
  DocumentStyleRewriteRegistry
>();

export function createDocumentStyleRewriteSession(input: {
  appId: string;
  boundary: HTMLElement;
  resolver: AssetResolver;
}): DocumentStyleRewriteSession {
  return {
    appId: input.appId,
    boundary: input.boundary,
    mirroredStyles: new Set(),
    resolver: input.resolver,
    styleTarget: findShadowRootOfBoundary(input.boundary),
  };
}

export function registerDocumentStyleRewrite(
  document: Document | undefined,
  session: DocumentStyleRewriteSession,
): AtlasAssetRewriteRelease {
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

  const appId = normalizeAppId(session.appId);
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

  const appId = normalizeAppId(session.appId);
  const sessions = registry.sessionsByAppId.get(appId);

  sessions?.delete(session);

  if (!sessions?.size) registry.sessionsByAppId.delete(appId);
}

function patchDocumentStyleInsertion(
  head: HTMLElement,
  registry: DocumentStyleRewriteRegistry,
): AtlasAssetRewriteRelease {
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

  if (hasQuerySelectorAll(root)) {
    root
      .querySelectorAll('style')
      .forEach((style) => rewriteOwnedDocumentStyle(style, registry));
  }
}

function rewriteOwnedDocumentStyle(
  style: Element,
  registry: DocumentStyleRewriteRegistry,
): void {
  const cssText = style.textContent;

  if (!cssText) return;
  const owner = findOwnerSessionOfStyle(cssText, registry);

  if (!owner) return;

  rewriteStyleElement(style, owner.resolver);
  mirrorStyle(style, owner);
}

function mirrorStyle(
  style: Element,
  session: DocumentStyleRewriteSession,
): void {
  if (!session.styleTarget) return;

  const mirroredStyle = style.cloneNode(true);

  if (!isElement(mirroredStyle)) return;

  session.styleTarget.appendChild(mirroredStyle);
  session.mirroredStyles.add(mirroredStyle);
}

function findShadowRootOfBoundary(
  boundary: HTMLElement,
): ShadowRoot | undefined {
  const root = boundary.getRootNode?.();

  return root instanceof ShadowRoot ? root : undefined;
}

function findOwnerSessionOfStyle(
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
    extractAngularScopeAttributeNames(cssText).some((attributeName) =>
      legacyOwner.boundary.querySelector?.(
        `[${escapeCssIdentifier(attributeName)}]`,
      ),
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
      .get(normalizeAppId(appId))
      ?.values()
      .next().value;

    if (
      !candidate ||
      (owner && normalizeAppId(owner.appId) !== normalizeAppId(candidate.appId))
    )
      return undefined;
    owner = candidate;
  }
  return owner;
}

function extractAngularScopeAttributeNames(cssText: string): string[] {
  return [
    ...new Set(
      [...cssText.matchAll(ANGULAR_STYLE_SCOPE_PATTERN)].flatMap((match) =>
        match[1] ? [match[1]] : [],
      ),
    ),
  ];
}

function normalizeAppId(appId: string): string {
  return appId.toLowerCase();
}

function escapeCssIdentifier(value: string): string {
  return globalThis.CSS?.escape
    ? globalThis.CSS.escape(value)
    : value.replace(/["\\]/g, '\\$&');
}
