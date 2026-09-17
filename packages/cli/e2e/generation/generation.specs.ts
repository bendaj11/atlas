import { GenerationDriver } from './generation.driver.js';

describe('atlas generate', () => {
  let driver: GenerationDriver;

  beforeEach(() => {
    driver = new GenerationDriver();
  });

  describe('when a standalone Angular host is generated', () => {
    beforeEach(async () => {
      await driver.given.workspace('standalone');

      await driver.when.generated({
        type: 'host',
        framework: 'angular',
        flags: [`--directory=${driver.get.projectRoot()}`],
      });
    });

    it('should write the bootstrap template', async () => {
      expect(await driver.get.fileExists('atlas.bootstrap.html')).toBe(true);
    });

    it('should pin the framework in atlas.config.ts', async () => {
      expect(await driver.get.file('atlas.config.ts')).toContain(
        'framework: "angular"',
      );
    });

    it('should wire build and serve targets in angular.json', async () => {
      const project = await driver.get.angularProject();

      expect([
        project.architect.build.options.target,
        project.architect.serve.options.target,
      ]).toStrictEqual([
        `${driver.get.projectName()}:esbuild:production`,
        `${driver.get.projectName()}:serve-original:development`,
      ]);
    });

    it('should add an atlas dev script', async () => {
      expect((await driver.get.packageJson()).scripts.dev).toBe(
        `atlas dev ${driver.get.projectName()}`,
      );
    });
  });

  describe('when a standalone React app is generated with a host id', () => {
    beforeEach(async () => {
      await driver.given.workspace('standalone');

      await driver.when.generated({
        type: 'app',
        framework: 'react',
        flags: [
          `--directory=${driver.get.projectRoot()}`,
          `--host-id=${driver.get.hostId()}`,
        ],
      });
    });

    it('should route the app to the given host in atlas.config.ts', async () => {
      expect(await driver.get.file('atlas.config.ts')).toContain(
        driver.get.hostId(),
      );
    });

    it('should bootstrap a routed app', async () => {
      expect(await driver.get.file('src/bootstrap.tsx')).toContain(
        'createRoutedApp',
      );
    });

    it('should configure federation through the React Vite preset', async () => {
      expect(await driver.get.file('vite.config.ts')).toContain(
        'createReactAppViteConfig',
      );
    });
  });

  describe('when an app is generated inside an Nx workspace', () => {
    beforeEach(async () => {
      await driver.given.workspace('nx');

      await driver.when.generated({
        type: 'app',
        framework: 'react',
        flags: ['--skip-workspace-generator'],
      });
    });

    it('should report the detected workspace', () => {
      expect(driver.get.output()).toContain('Detected an Nx workspace');
    });

    it('should register the project with atlas targets in project.json', async () => {
      const project = await driver.get.nxProject();

      expect({
        name: project.name,
        tags: project.tags,
        buildExecutor: project.targets.build.executor,
        configCommand: project.targets['atlas:config'].options.command,
        publishCommand: project.targets['atlas:publish'].options.command,
        publishDependsOn: project.targets['atlas:publish'].dependsOn,
      }).toStrictEqual({
        name: driver.get.projectName(),
        tags: ['atlas'],
        buildExecutor: 'nx:run-commands',
        configCommand: 'yarn run atlas:config',
        publishCommand: `npx --no-install atlas publish ${driver.get.projectName()}`,
        publishDependsOn: undefined,
      });
    });
  });

  describe('when an Angular app is generated inside a pnpm workspace', () => {
    beforeEach(async () => {
      await driver.given.workspace('pnpm');

      await driver.when.generated({ type: 'app', framework: 'angular' });
    });

    it('should report the detected workspace', () => {
      expect(driver.get.output()).toContain('package-manager workspace');
    });

    it('should place the project under packages', async () => {
      expect(await driver.get.fileExists('atlas.config.ts')).toBe(true);
    });

    it('should define the app entry', async () => {
      expect(await driver.get.file('src/entry.ts')).toContain('defineApp');
    });

    it('should configure federation through the Angular preset', async () => {
      expect(await driver.get.file('federation.config.mjs')).toContain(
        'createAngularV4FederationConfig',
      );
    });

    it('should add atlas dev and publish scripts', async () => {
      const { name, scripts } = await driver.get.packageJson();

      expect({
        name,
        dev: scripts.dev,
        publish: scripts['atlas:publish'],
      }).toStrictEqual({
        name: driver.get.projectName(),
        dev: `atlas dev ${driver.get.projectName()}`,
        publish: `atlas publish ${driver.get.projectName()}`,
      });
    });
  });
});
