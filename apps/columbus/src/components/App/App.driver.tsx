import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const ArtifactsOverridesPage = jest.fn(() => null);
const ArtifactConfigurationPage = jest.fn(() => null);
jest.unstable_mockModule(
  '../ArtifactsOverridesPage/ArtifactsOverridesPage',
  () => ({ ArtifactsOverridesPage }),
);
jest.unstable_mockModule(
  '../ArtifactConfigurationPage/ArtifactConfigurationPage',
  () => ({ ArtifactConfigurationPage }),
);

const { App } = await import('./App');

export class AppDriver {
  private route = `/${faker.lorem.slug()}`;

  constructor() {
    ArtifactsOverridesPage.mockClear();
    ArtifactConfigurationPage.mockClear();
  }

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
    artifactsOverridesPageMock: () => ArtifactsOverridesPage,
    artifactConfigurationPageMock: () => ArtifactConfigurationPage,
  };
}
