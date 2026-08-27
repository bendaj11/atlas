import { beforeEach, expect, it } from '@jest/globals';
import { GenerationE2eDriver } from './generation.driver.js';

let driver: GenerationE2eDriver;

beforeEach(() => {
  driver = new GenerationE2eDriver();
});

it('should generate a runnable project when creating a standalone Angular host', async () => {
  await driver.given.standaloneProject('host', 'angular');

  expect(await driver.when.inspectAngularHost()).toStrictEqual({
    bootstrapTemplate: true,
    framework: true,
    buildTarget: `${driver.get.projectName()}:esbuild:production`,
    serveTarget: `${driver.get.projectName()}:serve-original:development`,
    devCommand: `npx --no-install atlas dev ${driver.get.projectName()}`,
  });
});

it('should generate a routed project when creating a standalone React app', async () => {
  await driver.given.standaloneProject('app', 'react');

  expect(await driver.when.inspectRoutedReactApp()).toStrictEqual({
    framework: true,
    host: true,
    routedEntry: true,
    federation: true,
  });
});

it('should register the project when generating inside an Nx workspace', async () => {
  await driver.given.nxWorkspace();

  expect(await driver.when.inspectNxRegistration()).toStrictEqual({
    name: driver.get.projectName(),
    tags: ['atlas'],
    buildExecutor: 'nx:run-commands',
    configCommand: 'yarn run atlas:config',
    detected: true,
    publishCommand: `npx --no-install atlas publish ${driver.get.projectName()}`,
    publishDependsOnBuild: false,
  });
});

it('should place the project in the package directory when generating inside a pnpm workspace', async () => {
  await driver.given.pnpmWorkspace();

  expect(await driver.when.inspectPnpmAngularApp()).toStrictEqual({
    name: driver.get.projectName(),
    framework: true,
    entry: true,
    federation: true,
    detected: true,
    devCommand: `pnpm exec atlas dev ${driver.get.projectName()}`,
    publishCommand: `pnpm exec atlas publish ${driver.get.projectName()}`,
  });
});
