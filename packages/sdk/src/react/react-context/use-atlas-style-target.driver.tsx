import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { AtlasStyleTargetContext } from './contexts.js';
import { useAtlasStyleTarget } from './use-atlas-style-target.js';

const STATUS_LABEL = 'Atlas style target';

function StyleTargetConsumer({ expectedTarget }: { expectedTarget: Node }) {
  return createElement(
    'output',
    { 'aria-label': STATUS_LABEL },
    useAtlasStyleTarget() === expectedTarget ? 'available' : 'unexpected',
  );
}

export class UseAtlasStyleTargetDriver {
  private readonly styleTarget = document.createElement('div');

  readonly when = {
    rendered: () => {
      render(
        createElement(
          AtlasStyleTargetContext.Provider,
          { value: this.styleTarget },
          createElement(StyleTargetConsumer, {
            expectedTarget: this.styleTarget,
          }),
        ),
      );
    },
    renderedWithoutProvider: () => {
      render(
        createElement(StyleTargetConsumer, {
          expectedTarget: this.styleTarget,
        }),
      );
    },
  };

  readonly get = {
    status: () =>
      screen.getByRole('status', { name: STATUS_LABEL }).textContent,
  };
}
