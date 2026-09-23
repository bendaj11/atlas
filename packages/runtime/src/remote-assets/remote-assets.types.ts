export type AssetResolver = (value: string) => string;

export type AtlasAssetRewriteRelease = () => void;

export type InsertedNodeRewriter = (nodes: readonly (Node | string)[]) => void;

export interface DocumentStyleRewriteSession {
  readonly appId: string;
  readonly boundary: HTMLElement;
  readonly mirroredStyles: Set<Element>;
  readonly resolver: AssetResolver;
  readonly styleTarget: ShadowRoot | undefined;
}

export interface DocumentStyleRewriteRegistry {
  readonly sessions: Set<DocumentStyleRewriteSession>;
  readonly sessionsByAppId: Map<string, Set<DocumentStyleRewriteSession>>;
  releaseInsertionRewrite: AtlasAssetRewriteRelease;
}
