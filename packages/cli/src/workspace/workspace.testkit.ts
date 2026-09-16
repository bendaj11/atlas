import { faker } from '@faker-js/faker';
import type { AtlasProject, AtlasWorkspace } from './types.js';

export function aProject(overrides: Partial<AtlasProject> = {}): AtlasProject {
  const id = faker.word.noun().toLowerCase();

  return {
    id,
    root: `/${faker.system.directoryPath()}/${id}`,
    packageName: `@${faker.word.noun().toLowerCase()}/${id}`,
    version: faker.system.semver(),
    outputPaths: [],
    ...overrides,
  };
}

export function aWorkspace(
  overrides: Partial<AtlasWorkspace> = {},
): AtlasWorkspace {
  const project = aProject();

  return {
    kind: faker.helpers.arrayElement([
      'nx',
      'turbo',
      'workspace',
      'standalone',
    ]),
    root: faker.system.directoryPath(),
    packageManager: faker.helpers.arrayElement(['yarn', 'pnpm', 'npm']),
    findProject: async () => project,
    listProjects: async () => [project],
    run: async () => undefined,
    spawn: () => {
      throw new Error('Workspace spawn was not expected.');
    },
    formatGenerated: async () => false,
    installDependencies: async () => undefined,
    missingScaffoldDependency: async () => undefined,
    installScaffoldDependency: async () => undefined,
    scaffoldProject: async () => false,
    generationRoot: (_type, name) =>
      `${overrides.root ?? '/workspace'}/${name}`,
    ...overrides,
  };
}
