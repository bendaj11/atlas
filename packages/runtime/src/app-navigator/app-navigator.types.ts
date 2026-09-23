import type { AtlasNavigationState } from '@atlas/sdk';

export interface AtlasNavigationTarget {
  id: string;
  path: string;
}

export type NavigateToApp = (
  appId: string,
  state?: AtlasNavigationState,
) => void;
