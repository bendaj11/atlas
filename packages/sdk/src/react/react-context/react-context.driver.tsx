import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import {
  AtlasStyleTargetContext,
  useAtlasStyleTarget,
} from './react-context.js';

function StyleTargetConsumer({ expectedTarget }: { expectedTarget: Node }) {
  const styleTarget = useAtlasStyleTarget();

  return createElement(
    'output',
    { 'aria-label': 'Atlas style target' },
    styleTarget === expectedTarget ? 'available' : 'unexpected',
  );
}

export class ReactContextDriver {
  private readonly styleTarget = document.createElement('div');

  when = {
    renderMountedApp: (): void => {
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
  };

  get = {
    styleTargetStatus: (): string | null =>
      screen.getByRole('status', { name: 'Atlas style target' }).textContent,
  };
}
