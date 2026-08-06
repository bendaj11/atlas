import type { AtlasNavigationState } from '@atlas/sdk';
import type { AtlasNavigation } from '@atlas/sdk/navigation';
import {
  createAppNavigator,
  type AtlasNavigationTarget,
} from './app-navigator.js';

export class AppNavigatorDriver {
  private error: { code?: string } | undefined;
  private navigationPath: string | undefined;
  private targets: readonly AtlasNavigationTarget[] = [];

  given = {
    targets: (targets: readonly AtlasNavigationTarget[]): void => {
      this.targets = targets;
    },
  };

  when = {
    navigateTo: (appId: string, state?: AtlasNavigationState): void => {
      try {
        createAppNavigator(this.navigation(), this.targets)(appId, state);
      } catch (error) {
        this.error = error as { code?: string };
      }
    },
  };

  get = {
    navigationPath: (): string | undefined => this.navigationPath,
    errorCode: (): string | undefined => this.error?.code,
  };

  private navigation(): AtlasNavigation {
    return {
      navigate: (path) => {
        this.navigationPath = path;
      },
      replace: () => undefined,
      back: () => undefined,
      createHref: (path) => path,
      subscribe: () => () => undefined,
      getCurrentLocation: () => ({ pathname: '/', search: '', hash: '' }),
    };
  }
}
