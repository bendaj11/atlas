import { jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
jest.unstable_mockModule(
  '../ArtifactsOverridesPage/ArtifactsOverridesPage',
  () => ({ ArtifactsOverridesPage: () => <div>artifacts page</div> }),
);
jest.unstable_mockModule(
  '../ArtifactConfigurationPage/ArtifactConfigurationPage',
  () => ({ ArtifactConfigurationPage: () => <div>configuration page</div> }),
);

const { App } = await import('./App');

export class AppDriver {
  private route = '/';

  readonly given = {
    route: (route: string): this => {
      this.route = route;

      return this;
    },
  };

  readonly when = {
    rendered: (): void => {
      render(
        <MemoryRouter initialEntries={[this.route]}>
          <App />
        </MemoryRouter>,
      );
    },
  };

  readonly get = {
    page: (name: string): Promise<HTMLElement | null> =>
      screen.findByText(name).catch(() => null),
  };
}
