import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@jest/globals';
import { CliArguments } from '../dist/cli/arguments.js';
import { AtlasGenerateService } from '../dist/generation/generate.service.js';
import { createTestWorkspace } from './build.driver.js';
import { createPromptDriver } from './interaction.driver.js';

test('interactive Angular app generation asks routing then stylesheet format', async () => {
  const root = await mkdtemp(join(tmpdir(), 'atlas-angular-prompts-'));
  const prompts = createPromptDriver(['true', 'scss', '4201']);
  const workspace = createTestWorkspace({
    root,
    generationRoot: (_type, name) => join(root, name),
  });
  const generate = new AtlasGenerateService(
    workspace,
    new CliArguments(['--framework=angular', '--skip-format']),
    prompts,
  );

  await generate.project('app', 'orders', 'angular');

  expect(prompts.questions).toStrictEqual([
    'select:Add Atlas inner routing to this app?',
    'select:Which stylesheet format would you like to use?',
    'input:Which port would you like to use for the dev server?',
  ]);
  expect(prompts.choiceLabels[1]).toStrictEqual([
    'CSS',
    'SCSS',
    'Sass',
    'Less',
  ]);
  expect(prompts.inputDefaults).toStrictEqual(['4201']);
});

test('generation suggests first port unused by existing Atlas projects', async () => {
  const root = await mkdtemp(join(tmpdir(), 'atlas-port-suggestion-'));
  const hostRoot = join(root, 'host');
  const appRoot = join(root, 'app');
  await Promise.all([mkdir(hostRoot), mkdir(appRoot)]);
  await Promise.all([
    writeFile(join(hostRoot, 'atlas.config.ts'), 'export default {};\n'),
    writeFile(join(hostRoot, 'vite.config.ts'), 'export default { server: { port: 4200 } };\n'),
    writeFile(join(appRoot, 'atlas.config.ts'), 'export default {};\n'),
    writeFile(join(appRoot, 'angular.json'), JSON.stringify({ projects: { app: { architect: { serve: { options: { port: 4201 } } } } } })),
  ]);
  const prompts = createPromptDriver(['4202']);
  const workspace = createTestWorkspace({
    root,
    listProjects: async () => [
      { id: 'host', root: hostRoot, packageName: 'host', version: '1.0.0', outputPaths: [] },
      { id: 'app', root: appRoot, packageName: 'app', version: '1.0.0', outputPaths: [] },
    ],
    generationRoot: (_type, name) => join(root, name),
  });
  const generate = new AtlasGenerateService(
    workspace,
    new CliArguments(['--framework=react', '--skip-format']),
    prompts,
  );

  await generate.project('host', 'next-host', 'react');

  expect(prompts.inputDefaults).toStrictEqual(['4202']);
});

test('an explicit port skips workspace port discovery', async () => {
  const root = await mkdtemp(join(tmpdir(), 'atlas-explicit-port-'));
  const workspace = createTestWorkspace({
    root,
    listProjects: async () => {
      throw new Error('Port discovery should not run for --port.');
    },
    generationRoot: (_type, name) => join(root, name),
  });
  const generate = new AtlasGenerateService(
    workspace,
    new CliArguments(['--framework=react', '--port=4500', '--skip-format']),
    createPromptDriver(['true']),
  );

  await generate.project('app', 'orders', 'react');

  expect(await readFile(join(root, 'orders/vite.config.ts'), 'utf8')).toMatch(
    /port: 4500/,
  );
});
