import { resolve } from 'node:path';
import { faker } from '@faker-js/faker';
import { ProjectScaffoldDriver } from './project-scaffold.driver.js';

const NON_NX_KINDS = ['turbo', 'workspace', 'standalone'] as const;
const NON_TURBO_KINDS = ['nx', 'workspace', 'standalone'] as const;

describe('project scaffold', () => {
  let driver: ProjectScaffoldDriver;

  beforeEach(() => {
    driver = new ProjectScaffoldDriver();
  });

  describe('resolveGenerationRoot', () => {
    it('should resolve --directory when it names a directory', () => {
      const directory = faker.system.directoryPath();
      driver.given.flags([`--directory=${directory}`]);

      expect(driver.get.generationRoot([driver.get.name()])).toBe(
        resolve(directory),
      );
    });

    it('should resolve segments from cwd when --directory is bare', () => {
      const segments = [faker.word.noun(), faker.word.noun()];
      driver.given.flags(['--directory']);

      expect(driver.get.generationRoot(segments)).toBe(
        resolve(process.cwd(), ...segments),
      );
    });

    it('should resolve segments from cwd when workspace is nx', () => {
      const segments = [driver.get.name()];
      driver.given.workspaceKind('nx');

      expect(driver.get.generationRoot(segments)).toBe(
        resolve(process.cwd(), ...segments),
      );
    });

    it.each(NON_NX_KINDS)(
      'should resolve segments from cwd when path has several segments and workspace is %s',
      (kind) => {
        const segments = [faker.word.noun(), driver.get.name()];
        driver.given.workspaceKind(kind);

        expect(driver.get.generationRoot(segments)).toBe(
          resolve(process.cwd(), ...segments),
        );
      },
    );

    it.each(NON_NX_KINDS)(
      'should use workspace generation root when path is a bare name and workspace is %s',
      (kind) => {
        driver.given.workspaceKind(kind);

        expect(driver.get.generationRoot([driver.get.name()])).toBe(
          driver.get
            .workspace()
            .generationRoot(driver.get.type(), driver.get.name()),
        );
      },
    );
  });

  describe('takeOverScaffold', () => {
    it('should take over app source when scaffold is taken over', async () => {
      await driver.when.scaffoldTakenOver();

      expect(driver.get.takeOverAppSourceMock()).toHaveBeenCalledWith(
        driver.get.root(),
      );
    });

    it('should remove delegated Vite configs when framework is react', async () => {
      driver.given.framework('react');

      await driver.when.scaffoldTakenOver();

      expect(
        driver.get.removeDelegatedReactViteConfigsMock(),
      ).toHaveBeenCalledWith(driver.get.root());
    });

    it('should keep Vite configs when framework is angular', async () => {
      driver.given.framework('angular');

      await driver.when.scaffoldTakenOver();

      expect(
        driver.get.removeDelegatedReactViteConfigsMock(),
      ).not.toHaveBeenCalled();
    });
  });

  describe('alignDelegatedProject', () => {
    it('should align delegated tsconfig when project is aligned', async () => {
      driver.given.framework('react');

      await driver.when.delegatedProjectAligned();

      expect(driver.get.alignDelegatedTsconfigMock()).toHaveBeenCalledWith({
        root: driver.get.root(),
        framework: 'react',
      });
    });

    it('should align Angular federation config when framework is angular', async () => {
      driver.given.framework('angular');

      await driver.when.delegatedProjectAligned();

      expect(
        driver.get.alignDelegatedAngularFederationConfigMock(),
      ).toHaveBeenCalledWith({
        workspaceRoot: driver.get.workspace().root,
        root: driver.get.root(),
      });
    });

    it('should skip Angular federation config when framework is react', async () => {
      driver.given.framework('react');

      await driver.when.delegatedProjectAligned();

      expect(
        driver.get.alignDelegatedAngularFederationConfigMock(),
      ).not.toHaveBeenCalled();
    });

    it('should ensure delegated Nx targets when workspace is nx', async () => {
      driver.given.workspaceKind('nx').given.framework('react');

      await driver.when.delegatedProjectAligned();

      expect(driver.get.ensureDelegatedNxTargetsMock()).toHaveBeenCalledWith({
        workspaceRoot: driver.get.workspace().root,
        root: driver.get.root(),
        name: driver.get.name(),
        type: driver.get.type(),
        framework: 'react',
        packageManager: driver.get.workspace().packageManager,
        devServerPort: driver.get.devServerPort(),
        frameworkVersion: driver.get.frameworkVersion(),
      });
    });

    it.each(NON_NX_KINDS)(
      'should skip delegated Nx targets when workspace is %s',
      async (kind) => {
        driver.given.workspaceKind(kind);

        await driver.when.delegatedProjectAligned();

        expect(
          driver.get.ensureDelegatedNxTargetsMock(),
        ).not.toHaveBeenCalled();
      },
    );

    it('should skip dependency merge when no package.json is generated', async () => {
      driver.given.files([
        { path: 'atlas.config.ts', contents: faker.lorem.sentence() },
      ]);

      await driver.when.delegatedProjectAligned();

      expect(driver.get.mergePackageDependenciesMock()).not.toHaveBeenCalled();
    });

    describe('when a package.json is generated', () => {
      const contents = JSON.stringify({ dependencies: {} });
      const manifestPath = faker.system.filePath();

      beforeEach(() => {
        driver.given
          .framework('react')
          .given.files([{ path: 'package.json', contents }])
          .given.dependencyManifestPath(manifestPath);
      });

      it('should merge generated dependencies into the resolved manifest', async () => {
        driver.given.dependenciesChanged(false);

        await driver.when.delegatedProjectAligned();

        expect(driver.get.mergePackageDependenciesMock()).toHaveBeenCalledWith(
          manifestPath,
          contents,
          'react',
        );
      });

      it('should log added dependencies when the manifest changed', async () => {
        driver.given.dependenciesChanged(true);

        await driver.when.delegatedProjectAligned();

        expect(driver.get.infoMock()).toHaveBeenCalledWith(
          expect.stringMatching(/^Added Atlas dependencies to /),
        );
      });

      it('should stay silent when the manifest did not change', async () => {
        driver.given.dependenciesChanged(false);

        await driver.when.delegatedProjectAligned();

        expect(driver.get.infoMock()).not.toHaveBeenCalled();
      });
    });
  });

  describe('alignFrameworkWorkspace', () => {
    it('should ensure Angular workspace federation config when framework is angular', async () => {
      driver.given.framework('angular');

      await driver.when.frameworkWorkspaceAligned();

      expect(
        driver.get.ensureAngularWorkspaceFederationConfigMock(),
      ).toHaveBeenCalledWith({
        root: driver.get.root(),
        projectName: driver.get.name(),
        type: driver.get.type(),
        devServerPort: driver.get.devServerPort(),
      });
    });

    it('should do nothing when framework is react', async () => {
      driver.given.framework('react');

      await driver.when.frameworkWorkspaceAligned();

      expect(
        driver.get.ensureAngularWorkspaceFederationConfigMock(),
      ).not.toHaveBeenCalled();
    });
  });

  describe('registerWorkspaceProject', () => {
    it('should write an Nx project when workspace is nx and Nx did not scaffold it', async () => {
      driver.given.workspaceKind('nx').given.workspaceScaffolded(false);

      await driver.when.workspaceProjectRegistered();

      expect(driver.get.writeNxProjectMock()).toHaveBeenCalledWith({
        workspaceRoot: driver.get.workspace().root,
        packageManager: driver.get.workspace().packageManager,
        root: driver.get.root(),
        name: driver.get.name(),
        type: driver.get.type(),
      });
    });

    it('should skip writing an Nx project when Nx scaffolded it', async () => {
      driver.given.workspaceKind('nx').given.workspaceScaffolded(true);

      await driver.when.workspaceProjectRegistered();

      expect(driver.get.writeNxProjectMock()).not.toHaveBeenCalled();
    });

    it('should ensure Turbo tasks when workspace is turbo', async () => {
      driver.given.workspaceKind('turbo');

      await driver.when.workspaceProjectRegistered();

      expect(driver.get.ensureTurboTasksMock()).toHaveBeenCalledWith(
        driver.get.workspace().root,
      );
    });

    it.each(NON_TURBO_KINDS)(
      'should skip Turbo tasks when workspace is %s',
      async (kind) => {
        driver.given.workspaceKind(kind);

        await driver.when.workspaceProjectRegistered();

        expect(driver.get.ensureTurboTasksMock()).not.toHaveBeenCalled();
      },
    );
  });
});
