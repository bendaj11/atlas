import { readFile } from 'node:fs/promises';
import { runCli, type CliProcessResult } from '../cli-process.testkit.js';

export class EntrypointDriver {
  private result!: CliProcessResult;

  readonly when = {
    run: async (args: string[]): Promise<void> => {
      this.result = await runCli({ args });
    },
  };

  readonly get = {
    result: (): CliProcessResult => this.result,
    stdout: (): string => this.result.stdout,
    stderr: (): string => this.result.stderr,
    packageVersion: async (): Promise<string> => {
      const contents = await readFile(
        new URL('../../package.json', import.meta.url),
        'utf8',
      );

      return JSON.parse(contents).version as string;
    },
  };
}
