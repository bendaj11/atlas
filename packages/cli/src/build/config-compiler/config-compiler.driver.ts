import { access, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { faker } from '@faker-js/faker';
import {
  createTestWorkspace,
  testTypeScriptConfig,
} from '../../test-utils/build.testkit.js';
import type {
  AtlasProject,
  AtlasWorkspace,
} from '../../workspace/service/workspace.js';
import { compileAtlasConfig } from './config-compiler.js';

type ProjectScenario =
  | 'project-tsconfig'
  | 'app-tsconfig'
  | 'missing-tsconfig'
  | 'invalid-tsconfig'
  | 'invalid-atlas-config';

export class ConfigCompilerDriver {
  private readonly projectName = faker.word.noun().toLowerCase();
  private root = '';
  private project?: AtlasProject;
  private workspace?: AtlasWorkspace;
  private emitted = false;

  given = {
    project: async (scenario: ProjectScenario): Promise<void> => {
      this.root = await mkdtemp(join(tmpdir(), 'atlas-config-compiler-'));
      const projectRoot =
        scenario === 'app-tsconfig'
          ? join(this.root, 'apps', this.projectName)
          : join(this.root, this.projectName);

      await mkdir(projectRoot, { recursive: true });
      await writeFile(
        join(projectRoot, 'package.json'),
        JSON.stringify({ name: this.projectName, type: 'module' }),
      );
      if (scenario !== 'missing-tsconfig') {
        await writeFile(
          join(projectRoot, 'tsconfig.json'),
          scenario === 'invalid-tsconfig'
            ? '{ compilerOptions: '
            : JSON.stringify(
                scenario === 'app-tsconfig'
                  ? { compilerOptions: { emitDeclarationOnly: true } }
                  : testTypeScriptConfig({ noEmit: true }),
              ),
        );
      }

      if (scenario === 'app-tsconfig') {
        await writeFile(
          join(projectRoot, 'tsconfig.app.json'),
          JSON.stringify(testTypeScriptConfig()),
        );
      }

      await writeFile(
        join(projectRoot, 'atlas.config.ts'),
        scenario === 'invalid-atlas-config'
          ? 'export default missingConfig;\n'
          : `export default { type: "host", id: "${faker.string.uuid()}", framework: "react" };\n`,
      );

      this.project = {
        id: this.projectName,
        outputPaths: [],
        packageName: this.projectName,
        root: projectRoot,
        version: faker.system.semver(),
      };
      this.workspace = createTestWorkspace({
        findProject: async () => this.project!,
        kind: scenario === 'app-tsconfig' ? 'nx' : 'standalone',
        root: this.root,
      });
    },
  };

  when = {
    compile: async (): Promise<void> => {
      if (!this.workspace || !this.project) {
        throw new Error('Compiler setup is required.');
      }

      await compileAtlasConfig(this.workspace, this.project);

      try {
        await access(join(this.project.root, '.atlas', 'atlas.config.js'));
        this.emitted = true;
      } catch {
        this.emitted = false;
      }
    },
  };

  get = {
    emittedConfig: (): boolean => this.emitted,
  };
}
