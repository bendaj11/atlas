import { jest } from '@jest/globals';
import { createElement } from 'react';
import { render } from '@testing-library/react';
import { anAppContext } from '../../testkit/app-context.testkit.js';
import { AtlasErrorBoundary } from './atlas-error-boundary.js';

export class AtlasErrorBoundaryDriver {
  private readonly fail = jest.fn<(error: unknown) => void>();

  constructor() {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  }
  private childError: Error | undefined;
  private childText = '';
  private container!: HTMLElement;

  readonly given = {
    childError: (error: Error | undefined) => {
      this.childError = error;

      return this;
    },
    childText: (text: string) => {
      this.childText = text;

      return this;
    },
  };

  readonly when = {
    rendered: () => {
      const Child = () => {
        if (this.childError) throw this.childError;

        return this.childText;
      };

      this.container = render(
        createElement(AtlasErrorBoundary, {
          context: anAppContext({ fail: this.fail }),
          children: createElement(Child),
        }),
      ).container;
    },
  };

  readonly get = {
    failMock: () => this.fail,
    text: () => this.container.textContent,
  };
}
