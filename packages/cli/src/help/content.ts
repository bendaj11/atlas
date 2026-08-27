export interface HelpEntry {
  label: string;
  description: string;
}

export interface CommandHelp {
  summary: string;
  usage: string;
  arguments?: readonly HelpEntry[];
  options?: readonly HelpEntry[];
  advancedOptions?: readonly HelpEntry[];
  environment?: readonly HelpEntry[];
  examples: readonly string[];
}

export const ROOT_COMMANDS: readonly HelpEntry[] = [
  {
    label: 'generate, g',
    description: 'Generate a host, app, or exported widget',
  },
  {
    label: 'dev',
    description: 'Run a host, or run one app locally inside a host',
  },
  {
    label: 'bootstrap',
    description: 'Create deployable host bootstrap files',
  },
  {
    label: 'publish',
    description:
      'Publish existing build output as an immutable release or preview',
  },
  {
    label: 'deploy',
    description: 'Select one release for one logical environment',
  },
  {
    label: 'remove-preview',
    description: 'Remove one PR/MR preview selection',
  },
  {
    label: 'prune-previews',
    description: 'Reconcile previews from an authoritative state file',
  },
  {
    label: 'verify',
    description: 'Verify a deployed Atlas host and its assets',
  },
];

export const ROOT_EXAMPLES = [
  'atlas g host customer-host',
  'atlas g app orders',
  'atlas dev customer-host',
  'atlas dev orders',
  'atlas publish orders --version 1.4.0',
  'atlas deploy orders --to production --version rc',
  'atlas bootstrap customer-host',
  'atlas verify --host-url https://customer.example',
] as const;

export const COMMAND_HELP: Readonly<Record<string, CommandHelp>> = {
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
  'generate host': generationProjectHelp('host', 'host client'),
  'generate app': generationProjectHelp('app', 'app'),
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
  publish: {
    summary:
      'Publish existing build output as one immutable release or preview.',
    usage: 'atlas publish <project> [options]',
    arguments: [
      { label: 'project', description: 'Atlas project name or directory' },
    ],
    options: [
      {
        label: '--version <value>',
        description: 'Opaque immutable release version',
      },
      {
        label: '--pr <number>',
        description: 'PR preview number; alias of --mr',
      },
      {
        label: '--mr <number>',
        description: 'MR preview number; alias of --pr',
      },
      {
        label: '--git-sha <sha>',
        description: 'Override checked-out Git SHA for preview correctness',
      },
      {
        label: '--registry-config <path>',
        description: 'Optional atlas.registry.ts path',
      },
      ...storageOptions(),
      {
        label: '--expected-registry-revision <digest>',
        description: 'Require current registry revision',
      },
      {
        label: '--skip-compile',
        description: 'Diagnostic: use already compiled Atlas config',
      },
      {
        label: '--dry-run',
        description: 'Validate and print writes without changing storage',
      },
      { label: '-h, --help', description: 'Show help for this command' },
    ],
    environment: storageEnvironment(),
    examples: [
      'atlas publish orders --version 1.4.0',
      'atlas publish orders --pr 123',
      'atlas publish orders --mr 123',
    ],
  },
  deploy: {
    summary:
      'Deploy one immutable release to one logical environment without a checkout.',
    usage:
      'atlas deploy <artifact> --to <environment> --version <selector> [options]',
    arguments: [
      {
        label: 'artifact',
        description:
          'Project/package name, stable UUID, or unique display name',
      },
    ],
    options: [
      {
        label: '--to <environment>',
        description: 'Logical target deployment entry',
      },
      {
        label: '--version <selector>',
        description: 'Exact version, latest, or source environment',
      },
      {
        label: '--source-registry-url <url>',
        description:
          'Source artifact/environment registry; requires --target-registry-url',
      },
      {
        label: '--registry-url <url>',
        description: 'Single registry used for both source and target',
      },
      {
        label: '--target-registry-url <url>',
        description:
          'Target environment registry; requires --source-registry-url',
      },
      {
        label: '--registry-config <path>',
        description: 'Optional atlas.registry.ts path',
      },
      ...storageOptions(false),
      {
        label: '--expected-registry-revision <digest>',
        description: 'Require current target registry revision',
      },
      {
        label: '--dry-run',
        description: 'Resolve and validate without writes',
      },
      { label: '-h, --help', description: 'Show help for this command' },
    ],
    environment: storageEnvironment(true),
    examples: [
      'atlas deploy orders --to production --version 1.4.0',
      'atlas deploy orders --to production --version latest',
      'atlas deploy orders --to production --version rc',
      'atlas deploy orders --to production --version staging --source-registry-url https://main.example/atlas --target-registry-url https://prod.example/atlas',
    ],
  },
  'remove-preview': {
    summary:
      'Remove one artifact preview selection without workspace discovery.',
    usage: 'atlas remove-preview <artifact> (--pr <number> | --mr <number>)',
    options: [
      {
        label: '--pr <number>',
        description: 'PR preview number; alias of --mr',
      },
      {
        label: '--mr <number>',
        description: 'MR preview number; alias of --pr',
      },
      {
        label: '--registry-config <path>',
        description: 'Optional atlas.registry.ts path',
      },
      ...storageOptions(),
      {
        label: '--expected-registry-revision <digest>',
        description: 'Require current registry revision',
      },
      { label: '-h, --help', description: 'Show help for this command' },
    ],
    environment: storageEnvironment(),
    examples: ['atlas remove-preview orders --pr 123'],
  },
  'prune-previews': {
    summary:
      'Remove closed preview selections and expired immutable generations.',
    usage: 'atlas prune-previews --state-file <path> [options]',
    options: [
      {
        label: '--state-file <path>',
        description: 'Complete provider-neutral list of open preview numbers',
      },
      {
        label: '--registry-config <path>',
        description: 'Optional atlas.registry.ts path',
      },
      ...storageOptions(),
      {
        label: '--expected-registry-revision <digest>',
        description: 'Require current registry revision',
      },
      { label: '-h, --help', description: 'Show help for this command' },
    ],
    environment: storageEnvironment(),
    examples: ['atlas prune-previews --state-file open-previews.json'],
  },
  verify: {
    summary:
      'Verify a deployed Atlas host, active manifest, artifacts, and assets.',
    usage: 'atlas verify --host-url <url> [options]',
    options: [
      {
        label: '--host-url <url>',
        description: 'One deployed Atlas host page or base URL',
      },
      {
        label: '--host-urls <urls>',
        description: 'Comma-separated deployed Atlas host URLs',
      },
      { label: '-h, --help', description: 'Show help for this command' },
    ],
    environment: [
      {
        label: 'ATLAS_HOST_URLS',
        description: 'Space or comma-separated deployed Atlas host URLs',
      },
    ],
    examples: [
      'atlas verify --host-url https://customer.example',
      'ATLAS_HOST_URLS=https://customer.example,https://staging.customer.example atlas verify',
    ],
  },
};

function storageEnvironment(includeSource = false): HelpEntry[] {
  return [
    ...(includeSource
      ? [
          {
            label: 'ATLAS_SOURCE_REGISTRY_URL',
            description: 'Public source registry root',
          },
        ]
      : []),
    { label: 'ATLAS_REGISTRY_URL', description: 'Public target registry root' },
    {
      label: 'ATLAS_HOST_URL',
      description: 'Public host base URL used when deploying a host binding',
    },
    {
      label: 'ATLAS_STORAGE_API_URL',
      description: 'Private S3-compatible write API',
    },
    { label: 'ATLAS_S3_BUCKET', description: 'Target bucket' },
    { label: 'ATLAS_STORAGE_KEY_PREFIX', description: 'Target key prefix' },
    { label: 'ATLAS_S3_REGION', description: 'Target signing region' },
  ];
}

function storageOptions(includeRegistry = true): HelpEntry[] {
  return [
    ...(includeRegistry
      ? [
          {
            label: '--registry-url <url>',
            description: 'Public target registry root',
          },
        ]
      : []),
    {
      label: '--storage-api-url <url>',
      description: 'Private S3-compatible write API',
    },
    { label: '--bucket <name>', description: 'Target bucket' },
    { label: '--key-prefix <prefix>', description: 'Target key prefix' },
    { label: '--region <region>', description: 'Target signing region' },
  ];
}

function generationProjectHelp(
  type: 'host' | 'app',
  resource: string,
): CommandHelp {
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
