import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CliArguments } from '../cli/arguments.js';
import {
  loadAtlasPublishConfig,
  type AtlasPublishConfig,
} from './publish-config.js';

export class PublishConfigDriver {
  private projectRoot?: string;
  private result?: AtlasPublishConfig;
  private error?: unknown;

  readonly given = {
    isolatedProject: async (): Promise<void> => {
      this.projectRoot = await mkdtemp(join(tmpdir(), 'atlas-publish-test-'));
    },
    configUsingNodeTypesAndLocalImport: async (): Promise<void> => {
      const dependencyRoot = join(
        this.requiredProjectRoot(),
        'node_modules',
        'publish-runtime',
      );
      await mkdir(dependencyRoot, { recursive: true });
      await writeFile(
        join(dependencyRoot, 'package.json'),
        JSON.stringify({
          name: 'publish-runtime',
          type: 'module',
          exports: { types: './index.d.ts', default: './index.js' },
        }),
      );
      await writeFile(
        join(dependencyRoot, 'index.d.ts'),
        `export declare const runtimePrefix: string;\n`,
      );
      await writeFile(
        join(dependencyRoot, 'index.js'),
        `export const runtimePrefix = 'node';\n`,
      );
      await writeFile(
        join(this.requiredProjectRoot(), 'publish-helper.ts'),
        [
          `import { runtimePrefix } from 'publish-runtime';`,
          `const runtimeValue: number = 'semantic errors belong to project typecheck';`,
          'export const runtimeUrl = `${runtimePrefix}:${process.version}`;',
          '',
        ].join('\n'),
      );
      await writeFile(
        join(this.requiredProjectRoot(), 'atlas.publish.ts'),
        [
          `import { runtimeUrl } from './publish-helper.js';`,
          `export default { runtimeUrls: [runtimeUrl] };`,
          '',
        ].join('\n'),
      );
    },
    malformedConfig: async (): Promise<void> => {
      await writeFile(
        join(this.requiredProjectRoot(), 'atlas.publish.ts'),
        `export default { runtimeUrls: [;\n`,
      );
    },
  };

  readonly when = {
    loadDefault: async (): Promise<void> => {
      this.result = await loadAtlasPublishConfig(
        new CliArguments([]),
        this.requiredProjectRoot(),
      );
    },
    loadExplicitMissing: async (): Promise<void> => {
      try {
        this.result = await loadAtlasPublishConfig(
          new CliArguments(['--publish-config=missing.publish.ts']),
          this.requiredProjectRoot(),
        );
      } catch (error) {
        this.error = error;
      }
    },
    loadDefaultFailure: async (): Promise<void> => {
      try {
        this.result = await loadAtlasPublishConfig(
          new CliArguments([]),
          this.requiredProjectRoot(),
        );
      } catch (error) {
        this.error = error;
      }
    },
    cleanup: async (): Promise<void> => {
      if (this.projectRoot)
        await rm(this.projectRoot, { recursive: true, force: true });
    },
  };

  readonly get = {
    result: (): AtlasPublishConfig | undefined => this.result,
    errorCode: (): string | undefined =>
      typeof this.error === 'object' &&
      this.error !== null &&
      'code' in this.error &&
      typeof this.error.code === 'string'
        ? this.error.code
        : undefined,
    errorMessage: (): string | undefined =>
      this.error instanceof Error ? this.error.message : undefined,
  };

  private requiredProjectRoot(): string {
    if (!this.projectRoot) throw new Error('Isolated project is not ready.');
    return this.projectRoot;
  }
}
