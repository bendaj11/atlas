import { jest } from '@jest/globals';
import { createElement } from 'react';
import { render } from '@testing-library/react';
import type { AtlasAppContext } from '../../lifecycle.js';
import { anAppContext } from '../../testkit/app-context.testkit.js';
import { AtlasRuntimeContext } from './contexts.js';
import { useAppLoaded } from './use-app-loaded.js';

function AppLoadedConsumer() {
  useAppLoaded();

  return null;
}

export class UseAppLoadedDriver {
  private readonly waitUntilReady = jest.fn<() => () => void>(
    () => () => undefined,
  );
  private context: AtlasAppContext | undefined = anAppContext({
    loading: {
      show: () => undefined,
      hide: () => undefined,
      waitUntilReady: this.waitUntilReady,
    },
  });

  readonly given = {
    appContext: (context: AtlasAppContext | undefined): this => {
      this.context = context;

      return this;
    },
  };

  readonly when = {
    rendered: (): void => {
      const consumer = createElement(AppLoadedConsumer);
      render(
        this.context
          ? createElement(
              AtlasRuntimeContext.Provider,
              { value: this.context },
              consumer,
            )
          : consumer,
      );
    },
  };

  readonly get = {
    waitUntilReadyMock: (): jest.Mock<() => () => void> => this.waitUntilReady,
  };
}
