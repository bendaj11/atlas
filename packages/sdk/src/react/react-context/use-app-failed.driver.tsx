import { jest } from '@jest/globals';
import { createElement } from 'react';
import { render } from '@testing-library/react';
import type { AtlasAppContext } from '../../lifecycle.js';
import { anAppContext } from '../../testkit/app-context.testkit.js';
import { AtlasRuntimeContext } from './contexts.js';
import { useAppFailed } from './use-app-failed.js';

export class UseAppFailedDriver {
  private readonly fail = jest.fn<(error: unknown) => void>();
  private context: AtlasAppContext | undefined = anAppContext({
    fail: this.fail,
  });
  private appFailed: (error: unknown) => void = () => undefined;

  readonly given = {
    appContext: (context: AtlasAppContext | undefined) => {
      this.context = context;

      return this;
    },
  };

  readonly when = {
    rendered: () => {
      const AppFailedConsumer = () => {
        this.appFailed = useAppFailed();

        return null;
      };
      const consumer = createElement(AppFailedConsumer);

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
    appFailedReported: (error: unknown) => this.appFailed(error),
  };

  readonly get = {
    failMock: () => this.fail,
  };
}
