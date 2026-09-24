import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { AngularProjectExpose } from '../../dist/federation-config.cjs';
import {
  exampleProjectRoot,
  missingFiles,
  runFederationFactoryScript,
  WORKSPACE_ROOT,
  type ExampleProject,
} from './federation-config.testkit.js';

interface AngularConfigResult {
  readonly exposes: Record<string, string>;
  readonly skip: string[];
  readonly shared: Record<string, Record<string, unknown>>;
}

export class AngularFederationConfigDriver {
  private projectRoot = '';
  private config: AngularConfigResult | undefined;

  readonly given = {
    exampleProject: (project: ExampleProject) => {
      this.projectRoot = exampleProjectRoot(project);

      return this;
    },
  };

  readonly when = {
    configCreated: async (expose: AngularProjectExpose) => {
      const options = { projectRoot: this.projectRoot, name: 'test', expose };
      this.config = await runFederationFactoryScript<AngularConfigResult>([
        `const config = factory.createAngularFederationConfig(${JSON.stringify(options)});`,
        'process.stdout.write(JSON.stringify({ exposes: config.exposes, skip: [...config.skip.strings], shared: config.shared }));',
      ]);
    },
  };

  readonly get = {
    exposes: () => this.config?.exposes ?? {},
    skip: () => this.config?.skip ?? [],
    shared: (packageName: string) => this.config?.shared[packageName],
    workspaceFile: (path: string) =>
      readFile(resolve(WORKSPACE_ROOT, path), 'utf8'),
    missingWorkspaceFiles: (paths: readonly string[]) =>
      missingFiles(WORKSPACE_ROOT, paths),
  };
}
