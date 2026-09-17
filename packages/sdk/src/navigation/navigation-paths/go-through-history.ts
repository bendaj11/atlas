import type { AtlasNavigation } from '../navigation-types/navigation-types.js';

/** Moves through history by `delta`, falling back to `back()` when the navigation has no `go`. */
export function goThroughHistory(
  navigation: Pick<AtlasNavigation, 'go' | 'back'>,
  delta: number,
): void {
  if (navigation.go) {
    navigation.go(delta);

    return;
  }

  if (delta === -1) navigation.back();
}
