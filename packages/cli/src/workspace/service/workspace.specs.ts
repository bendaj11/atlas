import { beforeEach, describe, expect, it } from '@jest/globals';
import { WorkspaceDriver } from './workspace.driver.js';

describe('workspace', () => {
  let driver: WorkspaceDriver;

  beforeEach(() => {
    driver = new WorkspaceDriver();
  });

  it('should discover project when Nx workspace has Atlas configuration', async () => {
    await driver.given.workspace('nx-project');

    await driver.when.detect();

    expect(driver.get.value()).toStrictEqual({
      generationRoot: 'apps/catalog',
      kind: 'nx',
      outputPaths: ['dist/apps/{project}'],
      packageManager: 'yarn',
      projectRoot: 'apps/{project}',
      version: driver.get.version(),
      workspaceRoot: '.',
    });
  });

  it('should reject project when Nx configuration is missing', async () => {
    await driver.given.workspace('missing-config');

    await expect(driver.when.detect()).rejects.toThrow(
      /missing required configuration file/,
    );
  });

  it('should detect workspace when package declares workspaces', async () => {
    await driver.given.workspace('package-workspace');

    await driver.when.detect();

    expect(driver.get.value()).toMatchObject({
      generationRoot: 'packages/catalog',
      kind: 'workspace',
      workspaceRoot: '.',
    });
  });

  it('should detect pnpm when pnpm workspace file is present', async () => {
    await driver.given.workspace('pnpm-workspace');

    await driver.when.detect();

    expect(driver.get.value()).toMatchObject({
      kind: 'workspace',
      packageManager: 'pnpm',
    });
  });

  it('should include configured outputs when Nx project is discovered', async () => {
    await driver.given.workspace('nx-outputs');

    await driver.when.detect();

    expect(
      driver.get.value<{ outputPaths: string[] }>().outputPaths,
    ).toStrictEqual([
      'dist/{project}/browser',
      'dist/{project}',
      'dist/dev/{project}',
      'custom/{project}',
      'apps/{project}/public',
    ]);
  });

  it('should follow delegated output when Angular federation build is discovered', async () => {
    await driver.given.workspace('delegated-output');

    await driver.when.detect();

    expect(
      driver.get.value<{ outputPaths: string[] }>().outputPaths,
    ).toStrictEqual(['apps/{project}/dist/browser', 'apps/{project}/dist']);
  });

  it('should create Nx command when Nx task is requested', async () => {
    await driver.when.createCommand('nx-task');

    expect(driver.get.value()).toStrictEqual({
      args: ['nx', 'run', '{project}:build'],
      command: 'yarn',
      cwd: '{root}',
    });
  });

  it('should create filtered command when Turbo task is requested', async () => {
    await driver.when.createCommand('turbo-task');

    expect(driver.get.value()).toStrictEqual({
      args: [
        'exec',
        'turbo',
        'run',
        'dev',
        '--filter=@scope/{project}',
        '--',
        '--port',
        '4201',
      ],
      command: 'pnpm',
      cwd: '{root}',
    });
  });

  it('should create workspace command when npm task is requested', async () => {
    await driver.when.createCommand('npm-workspace-task');

    expect(driver.get.value()).toStrictEqual({
      args: ['run', 'build', '--workspace', '@scope/{project}'],
      command: 'npm',
      cwd: '{root}',
    });
  });

  it('should install from project when package manager is detected', async () => {
    await driver.when.createCommand('install');

    expect(driver.get.value()).toStrictEqual({
      args: ['install'],
      command: 'pnpm',
      cwd: '{projectRoot}',
    });
  });

  it('should format from project when format script exists', async () => {
    await driver.when.createCommand('format');

    expect(driver.get.value()).toStrictEqual({
      args: ['run', 'format'],
      command: 'pnpm',
      cwd: '{projectRoot}',
      stdio: ['ignore', 'ignore', 'inherit'],
    });
  });

  it('should configure Angular defaults when Nx host generation is requested', async () => {
    await driver.when.createCommand('angular-generation');

    expect(driver.get.value()).toStrictEqual({
      '@nx/angular:application': true,
      '--interactive=false': true,
      '--port=4200': true,
      '--ssr=false': true,
      '--bundler=esbuild': true,
    });
  });

  it('should configure React defaults when Nx app generation is requested', async () => {
    await driver.when.createCommand('react-generation');

    expect(driver.get.value()).toStrictEqual({
      '@nx/react:application': true,
      '--interactive=false': true,
      '--port=4201': true,
      '--bundler=vite': true,
    });
  });

  it('should add React plugin when Nx dependency is missing', async () => {
    await driver.when.createCommand('plugin-install');

    expect(driver.get.value()).toStrictEqual({
      args: ['nx', 'add', '@nx/react', '--interactive=false'],
      command: 'npx',
      cwd: '{root}',
    });
  });

  it('should use workspace root when Nx project package is missing', async () => {
    await driver.when.resolveInstallationRoot({ projectPackage: 'missing' });

    expect(driver.get.value()).toBe('.');
  });

  it('should use project root when Nx project package exists', async () => {
    await driver.when.resolveInstallationRoot({ projectPackage: 'present' });

    expect(driver.get.value()).toBe('apps/{project}');
  });

  it('should require Angular plugin when solution workspace lacks dependency', async () => {
    await driver.given.workspace('solution-workspace');

    await driver.when.detect();

    expect(driver.get.value()).toStrictEqual({
      generationRoot: 'packages/host',
      missingPlugin: '@nx/angular',
    });
  });
});
