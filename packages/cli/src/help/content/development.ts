import type { CommandHelp } from './types.js';

export const DEVELOPMENT_HELP: Readonly<Record<string, CommandHelp>> = {
  dev: {
    summary:
      'Run a host locally or against a page selected from package.json atlas.previews.',
    usage: 'atlas dev [project] [options]',
    arguments: [
      {
        label: 'project',
        description:
          'Atlas project name or directory; defaults to the current directory',
      },
    ],
    options: [
      {
        label: '--port <number>',
        description:
          'Host browser port or app framework port (defaults to next unused port from host 4200 or app 4201)',
      },
      {
        label: '--control-port <number>',
        description: 'Atlas override-server port (default: 4400)',
      },
      {
        label: '--bootstrap-port <number>',
        description:
          'Override local host bootstrap port (default: host --port)',
      },
      {
        label: '--host-client-port <number>',
        description: 'Internal host-client framework port (default: 4300)',
      },
      {
        label: '--registry-url <url>',
        description:
          'Published registry used by a local host for catalog and Columbus version choices',
      },
      {
        label: '--no-open',
        description: 'Do not open the resolved host URL automatically',
      },
      {
        label: '--prepare-only',
        description: 'Create the override without starting development servers',
      },
      { label: '-h, --help', description: 'Show help for this command' },
    ],
    environment: [
      {
        label: 'ATLAS_REGISTRY_URL',
        description:
          'Published registry used by a local host for catalog and Columbus version choices',
      },
    ],
    examples: ['atlas dev customer-host', 'atlas dev orders', 'atlas dev'],
  },
  bootstrap: {
    summary: 'Create reusable static host bootstrap files.',
    usage: 'atlas bootstrap <host> [options]',
    arguments: [
      { label: 'host', description: 'Host project name or directory' },
    ],
    options: [
      {
        label: '--out <path>',
        description: 'Output directory (default: <host>/dist/bootstrap)',
      },
      {
        label: '--template <path>',
        description:
          'Override atlas.bootstrap.html with another host-relative template',
      },
      {
        label: '--title <text>',
        description: 'Document title when no template file is present',
      },
      {
        label: '--loading-html <html>',
        description: 'Loading markup when no template file is present',
      },
      {
        label: '--skip-compile',
        description: 'Use already compiled atlas.config.ts',
      },
      { label: '-h, --help', description: 'Show help for this command' },
    ],
    examples: ['atlas bootstrap customer-host'],
  },
};
