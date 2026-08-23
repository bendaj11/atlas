import { beforeEach, describe, expect, it } from '@jest/globals';
import { NxDriver } from './nx.driver.js';

describe('Nx generation', () => {
  let driver: NxDriver;

  beforeEach(() => {
    driver = new NxDriver();
  });

  it('should create run-command target when package script is delegated', () => {
    driver.when.createTarget();

    expect(driver.get.value()).toStrictEqual(driver.get.target());
  });

  it('should declare config output when Atlas config target is created', () => {
    driver.when.createConfigTarget();

    expect(driver.get.value()).toStrictEqual(driver.get.configTarget());
  });

  it('should include Atlas config when Angular tsconfig is aligned', async () => {
    await driver.given.tsconfig('angular');

    await driver.when.alignTsconfig();

    expect(driver.get.value()).toStrictEqual({
      emitDeclarationOnly: false,
      hasViteClient: false,
      include: ['src/**/*.ts', 'atlas.config.ts'],
      module: undefined,
      moduleResolution: undefined,
    });
  });

  it('should configure bundler and Vite when React tsconfig is aligned', async () => {
    await driver.given.tsconfig('react');

    await driver.when.alignTsconfig();

    expect(driver.get.value()).toStrictEqual({
      emitDeclarationOnly: true,
      hasViteClient: true,
      include: ['src/**/*.ts', 'atlas.config.ts'],
      module: 'ESNext',
      moduleResolution: 'bundler',
    });
  });

  it('should use cwd-independent paths when Angular federation is aligned', async () => {
    await driver.given.federationConfig();

    await driver.when.alignFederation();

    expect(driver.get.value()).toStrictEqual({
      entryCount: 2,
      hasRelativeEntry: false,
      hasRelativeWidget: false,
      widgetCount: 2,
    });
  });

  it('should add Angular host targets when project root is current', async () => {
    await driver.given.project({
      framework: 'angular',
      root: 'current',
      type: 'host',
    });

    await driver.when.ensureTargets();

    expect(driver.get.value()).toStrictEqual({
      buildExecutor: '@angular-architects/native-federation:build',
      devCommand: expect.stringMatching(
        /(?:pnpm exec|npx --no-install) atlas dev \{project\}/,
      ),
      devForwardsArguments: true,
      devTty: true,
      hasBootstrap: true,
      hasConfig: true,
      hasDev: true,
      hasPublish: true,
      hasServeOriginal: true,
      publishCommand: expect.stringMatching(
        /(?:pnpm exec|npx --no-install) atlas publish \{project\}/,
      ),
      publishDependencies: ['build'],
      serveExecutor: '@angular-architects/native-federation:build',
      tagged: true,
    });
  });

  it('should use v4 Angular builder when framework major is twenty', async () => {
    await driver.given.project({
      framework: 'angular',
      root: 'current',
      type: 'app',
    });

    await driver.when.ensureTargets({ frameworkVersion: '^20.1.0' });

    expect(driver.get.value<{ buildExecutor: string }>().buildExecutor).toBe(
      '@angular-architects/native-federation-v4:build',
    );
  });

  it('should add React app targets when project root is current', async () => {
    await driver.given.project({
      framework: 'react',
      root: 'current',
      type: 'app',
    });

    await driver.when.ensureTargets();

    expect(driver.get.value()).toStrictEqual({
      devCommand: expect.stringMatching(
        /(?:pnpm exec|npx --no-install) atlas dev \{project\}/,
      ),
      devForwardsArguments: true,
      devTty: true,
      hasBootstrap: false,
      hasConfig: true,
      hasDev: true,
      hasPublish: true,
      hasServeOriginal: false,
      publishCommand: expect.stringMatching(
        /(?:pnpm exec|npx --no-install) atlas publish \{project\}/,
      ),
      publishDependencies: ['build'],
      tagged: true,
    });
  });

  it('should reject generation when Nx project root is stale', async () => {
    await driver.given.project({
      framework: 'angular',
      root: 'stale',
      type: 'app',
    });

    await expect(driver.when.ensureTargets()).rejects.toThrow(
      /Nx project root mismatch.*Stale paths/,
    );
  });
});
