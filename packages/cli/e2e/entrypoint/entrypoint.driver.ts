import { readFile } from 'node:fs/promises';
import { runCli, type CliProcessResult } from '../cli-process.testkit.js';

export class EntrypointDriver {
  private result!: CliProcessResult;

  readonly when = {
    run: async (args: string[]) => {
      this.result = await runCli({ args });
    },
  };

  readonly get = {
    result: () => this.result,
    stdout: () => this.result.stdout,
    stderr: () => this.result.stderr,
    packageVersion: async () => {
      const contents = await readFile(
        new URL('../../package.json', import.meta.url),
        'utf8',
      );

      return JSON.parse(contents).version as string;
    },
  };
}
