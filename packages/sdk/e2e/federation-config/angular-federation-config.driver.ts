import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { AngularProjectExpose } from '../../federation-config.cjs';
import {
  exampleProjectRoot,
  missingFiles,
  runFactoryScript,
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
    exampleProject: (project: ExampleProject): this => {
      this.projectRoot = exampleProjectRoot(project);

      return this;
    },
  };

  readonly when = {
    configCreated: async (expose: AngularProjectExpose): Promise<void> => {
      const options = { projectRoot: this.projectRoot, name: 'test', expose };
      this.config = await runFactoryScript<AngularConfigResult>([
        `const config = factory.createAngularFederationConfig(${JSON.stringify(options)});`,
        'process.stdout.write(JSON.stringify({ exposes: config.exposes, skip: [...config.skip.strings], shared: config.shared }));',
      ]);
    },
  };

  readonly get = {
    exposes: (): Record<string, string> => this.config?.exposes ?? {},
    skip: (): string[] => this.config?.skip ?? [],
    shared: (packageName: string): Record<string, unknown> | undefined =>
      this.config?.shared[packageName],
    workspaceFile: (path: string): Promise<string> =>
      readFile(resolve(WORKSPACE_ROOT, path), 'utf8'),
    missingWorkspaceFiles: (paths: readonly string[]): Promise<string[]> =>
      missingFiles(WORKSPACE_ROOT, paths),
  };
}
