import type { CommandHelp } from './types.js';

export const GENERATION_HELP: Readonly<Record<string, CommandHelp>> = {
  generate: {
    summary: 'Generate an Atlas project or exported widget.',
    usage: 'atlas generate <type> [name] [options]',
    arguments: [
      {
        label: 'type',
        description: 'Resource to generate: host, app, or widget',
      },
      { label: 'name', description: 'Resource name; prompted when omitted' },
    ],
    options: [
      { label: '-h, --help', description: 'Show help for this command' },
    ],
    examples: [
      'atlas g host customer-host',
      'atlas g app orders',
      'atlas g widget order-summary --app-id <app-id>',
    ],
  },
  'generate host': buildGenerationProjectHelp({
    type: 'host',
    resource: 'host client',
  }),
  'generate app': buildGenerationProjectHelp({ type: 'app', resource: 'app' }),
  'generate widget': {
    summary: 'Generate an exported widget inside an existing app.',
    usage: 'atlas generate widget <name> [--app-id <app-id>] [options]',
    arguments: [{ label: 'name', description: 'Widget name' }],
    options: [
      {
        label: '--app-id <app-id>',
        description:
          'Stable owning app ID; prompted from configured apps when omitted',
      },
      {
        label: '--force',
        description: 'Replace an existing widget with the same name',
      },
      { label: '-h, --help', description: 'Show help for this command' },
    ],
    examples: [
      'atlas g widget order-summary',
      'atlas g widget order-summary --app-id <app-id>',
    ],
  },
};

function buildGenerationProjectHelp({
  type,
  resource,
}: {
  type: 'host' | 'app';
  resource: string;
}): CommandHelp {
  return {
    summary: `Generate a framework-native Atlas ${resource}.`,
    usage: `atlas generate ${type} <name-or-path> [options]`,
    arguments: [
      {
        label: 'name-or-path',
        description: `Name or command-relative path of the ${resource}; prompted when omitted`,
      },
    ],
    options: [
      {
        label: '--framework <name>',
        description: 'Framework: angular or react; prompted when omitted',
      },
      ...(type === 'app'
        ? [
            {
              label: '--host-id <host-id>',
              description: 'Stable host id used for the generated route',
            },
          ]
        : []),
      ...(type === 'app'
        ? [
            {
              label: '--routing, --no-routing',
              description:
                'Create Atlas inner route files or a single-page app; prompted when omitted in interactive mode',
            },
          ]
        : []),
      {
        label: '--style <format>',
        description:
          'Angular stylesheet format: css, scss, sass, or less; prompted when omitted in interactive mode',
      },
      {
        label: '--port <number>',
        description: `Dev-server port; defaults to next unused port from ${type === 'host' ? 4200 : 4201}`,
      },
      {
        label: '--framework-version <range>',
        description:
          'Framework semver range for new packages; existing Nx packages keep their Angular/React version',
      },
      { label: '--directory <path>', description: 'Target directory' },
      {
        label: '--allow-unsupported-version',
        description: "Generate outside Atlas's tested version range",
      },
      {
        label: '--force',
        description: 'Write into an existing target directory',
      },
      {
        label: '--skip-install',
        description: 'Generate files without installing dependencies',
      },
      {
        label: '--skip-workspace-generator',
        description: 'Skip the native Nx project generator',
      },
      {
        label: '--yes',
        description: 'Approve required workspace plugin installation',
      },
      { label: '-h, --help', description: 'Show help for this command' },
    ],
    examples: [
      `atlas g ${type} ${type === 'host' ? 'customer-host' : 'orders'} --framework react`,
      `atlas g ${type} ${type === 'host' ? 'apps/admin-host' : 'products/billing'} --framework angular`,
    ],
  };
}
