import { jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { useHost as useHostType } from '../providers';

const useHost = jest.fn<typeof useHostType>();

jest.unstable_mockModule('../providers', () => ({ useHost }));
jest.unstable_mockModule(
  '../ArtifactsOverridesPage/ArtifactsOverridesPage',
  () => ({ ArtifactsOverridesPage: () => <div>artifacts page</div> }),
);
jest.unstable_mockModule(
  '../ArtifactConfigurationPage/ArtifactConfigurationPage',
  () => ({ ArtifactConfigurationPage: () => <div>configuration page</div> }),
);

const { App } = await import('./App');

type HostValue = ReturnType<typeof useHostType>;

export class AppDriver {
  private route = '/';
  private readonly loadHost = jest.fn<HostValue['loadHost']>();

  readonly given = {
    route: (route: string): this => {
      this.route = route;

      return this;
    },
  };

  readonly when = {
    rendered: (): this => {
      useHost.mockReturnValue({
        loadHost: this.loadHost,
      } as Partial<HostValue> as HostValue);
      render(
        <MemoryRouter initialEntries={[this.route]}>
          <App />
        </MemoryRouter>,
      );

      return this;
    },
  };

  readonly get = {
    page: (name: string): Promise<HTMLElement | null> =>
      screen.findByText(name).catch(() => null),
    loadHostCount: (): number => this.loadHost.mock.calls.length,
  };
}
