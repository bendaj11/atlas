export type AtlasHostAnchorKind =
  'status' | 'navigation' | 'route-outlet' | 'slot';

export type AtlasHostAnchorListener = () => void;

export type ReleaseAnchor = () => void;

export type UnsubscribeAnchorListener = () => void;
