import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const ArtifactsListPage = jest.fn(() => null);
const ArtifactOverrideEditorPage = jest.fn(() => null);
jest.unstable_mockModule('../ArtifactsListPage/ArtifactsListPage', () => ({
  ArtifactsListPage,
}));
jest.unstable_mockModule(
  '../ArtifactOverrideEditorPage/ArtifactOverrideEditorPage',
  () => ({ ArtifactOverrideEditorPage }),
);

const { App } = await import('./App');

export class AppDriver {
  private route = `/${faker.lorem.slug()}`;

  constructor() {
    ArtifactsListPage.mockClear();
    ArtifactOverrideEditorPage.mockClear();
  }

  readonly given = {
    route: (route: string) => {
      this.route = route;

      return this;
    },
  };

  readonly when = {
    rendered: () => {
      render(
        <MemoryRouter initialEntries={[this.route]}>
          <App />
        </MemoryRouter>,
      );
    },
  };

  readonly get = {
    artifactsListPageMock: () => ArtifactsListPage,
    artifactOverrideEditorPageMock: () => ArtifactOverrideEditorPage,
  };
}
