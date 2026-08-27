import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { faker } from '@faker-js/faker';

type CliResult = {
  code: number | null;
  stderr: string;
  stdout: string;
};

export class EntrypointDriver {
  private readonly projectName = faker.word.noun().toLowerCase();
  private readonly unknownCommand = faker.string.alpha({ length: 12 });
  private result?: CliResult;

  when = {
    run: async (
      scenario:
        | 'version'
        | 'root-help'
        | 'publish-help'
        | 'alias-help'
        | 'widget-help'
        | 'host-help'
        | 'app-help'
        | 'positional-help'
        | 'unknown-command'
        | 'unconfigured-widget',
    ): Promise<void> => {
      const argumentsByScenario = {
        'alias-help': ['help', 'g', 'host'],
        'app-help': ['g', 'app', '--help'],
        'publish-help': ['publish', '--help'],
        'host-help': ['g', 'host', '--help'],
        'positional-help': ['publish', this.projectName, '--help'],
        'root-help': ['--help'],
        'unconfigured-widget': ['g', 'widget', this.projectName],
        'unknown-command': [this.unknownCommand],
        version: ['--version'],
        'widget-help': ['g', 'widget', '--help'],
      } satisfies Record<typeof scenario, string[]>;

      this.result = await this.runCli(argumentsByScenario[scenario]);
    },
  };

  get = {
    appHelp: () => ({
      code: this.result?.code,
      hasHostFlag: /--host <host-id>/.test(this.result?.stdout ?? ''),
      hasHostIdFlag: /--host-id <host-id>\s+Stable host id/.test(
        this.result?.stdout ?? '',
      ),
    }),
    publishHelp: () => ({
      code: this.result?.code,
      hasArguments: /Arguments:/.test(this.result?.stdout ?? ''),
      hasEnvironment: /Environment:/.test(this.result?.stdout ?? ''),
      hasExamples: /Examples:/.test(this.result?.stdout ?? ''),
      hasRegistryOption: /--registry-url <url>/.test(this.result?.stdout ?? ''),
      hasUsage: /atlas publish <project> \[options\]/.test(
        this.result?.stdout ?? '',
      ),
    }),
    generationHelp: () => ({
      code: this.result?.code,
      hasAppOption: /--app-id <app-id>/.test(this.result?.stdout ?? ''),
      hasDirectoryOption: /--directory <path>\s+Target directory/.test(
        this.result?.stdout ?? '',
      ),
      hasFrameworkOption: /--framework <name>/.test(this.result?.stdout ?? ''),
      hasSkipInstallOption:
        /--skip-install\s+Generate files without installing dependencies/.test(
          this.result?.stdout ?? '',
        ),
      hasWidgetUsage: /atlas generate widget <name>/.test(
        this.result?.stdout ?? '',
      ),
    }),
    rootHelp: () => ({
      code: this.result?.code,
      hasCommandCatalog: /Commands:\n\s+generate, g\s+Generate a host/.test(
        this.result?.stdout ?? '',
      ),
      hasNoBuildCommand: !/^\s+build\s/m.test(this.result?.stdout ?? ''),
      hasNoInput: /--no-input\s+Disable interactive prompts/.test(
        this.result?.stdout ?? '',
      ),
      hasNoColor: /NO_COLOR\s+Disable ANSI color output/.test(
        this.result?.stdout ?? '',
      ),
    }),
    stderr: (): string => this.result?.stderr ?? '',
    version: (): CliResult | undefined => this.result,
    packageVersion: async (): Promise<string> => {
      const packageJson = new URL('../package.json', import.meta.url);
      const contents = await readFile(packageJson, 'utf8');

      return JSON.parse(contents).version as string;
    },
  };

  private runCli(arguments_: string[]): Promise<CliResult> {
    const cli = fileURLToPath(
      new URL('../dist/cli/entrypoint/entrypoint.js', import.meta.url),
    );

    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [cli, ...arguments_], {
        stdio: 'pipe',
      });
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk) => {
        stdout += chunk;
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
      });
      child.once('error', reject);
      child.once('exit', (code) => resolve({ code, stderr, stdout }));
    });
  }
}
