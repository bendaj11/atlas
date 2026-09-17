import type { CommandHelp, HelpEntry } from './types.js';

export const PUBLICATION_HELP: Readonly<Record<string, CommandHelp>> = {
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
      ...buildStorageOptionsHelp(),
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
    environment: buildStorageEnvironmentHelp(),
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
      ...buildStorageOptionsHelp({ includeRegistry: false }),
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
    environment: buildStorageEnvironmentHelp({ includeSource: true }),
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
      ...buildStorageOptionsHelp(),
      {
        label: '--expected-registry-revision <digest>',
        description: 'Require current registry revision',
      },
      { label: '-h, --help', description: 'Show help for this command' },
    ],
    environment: buildStorageEnvironmentHelp(),
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
      ...buildStorageOptionsHelp(),
      {
        label: '--expected-registry-revision <digest>',
        description: 'Require current registry revision',
      },
      { label: '-h, --help', description: 'Show help for this command' },
    ],
    environment: buildStorageEnvironmentHelp(),
    examples: ['atlas prune-previews --state-file open-previews.json'],
  },
};

function buildStorageEnvironmentHelp({
  includeSource = false,
}: {
  includeSource?: boolean;
} = {}): HelpEntry[] {
  return [
    ...(includeSource
      ? [
          {
            label: 'ATLAS_SOURCE_REGISTRY_URL',
            description: 'Public source registry root',
          },
          {
            label: 'ATLAS_TARGET_REGISTRY_URL',
            description: 'Public target root for separate-registry deployment',
          },
        ]
      : []),
    { label: 'ATLAS_REGISTRY_URL', description: 'Public target registry root' },
    {
      label: 'ATLAS_HOST_URL',
      description: 'Public host base URL used when deploying a host binding',
    },
    {
      label: 'ATLAS_STORAGE',
      description: 'Storage provider: s3 or artifactory (bucket implies s3)',
    },
    {
      label: 'ATLAS_STORAGE_API_URL',
      description: 'Private S3-compatible endpoint or Artifactory API root',
    },
    { label: 'ATLAS_S3_BUCKET', description: 'Target bucket' },
    { label: 'ATLAS_STORAGE_KEY_PREFIX', description: 'Target key prefix' },
    { label: 'ATLAS_S3_REGION', description: 'Target signing region' },
    {
      label: 'ATLAS_ARTIFACTORY_REPOSITORY',
      description: 'Artifactory local Generic repository',
    },
    {
      label: 'ATLAS_ARTIFACTORY_ACCESS_TOKEN',
      description: 'Private Artifactory token (environment only)',
    },
    {
      label: 'ATLAS_ARTIFACTORY_LOCK_RESOURCE',
      description: 'Required shared external writer lock name',
    },
    {
      label: 'ATLAS_PUBLICATION_LOCK',
      description: 'Held lock marker supplied by the Jenkins lock block',
    },
    {
      label: 'ATLAS_ARTIFACTORY_REQUEST_TIMEOUT_MS',
      description: 'Request timeout (default: 60000)',
    },
    {
      label: 'ATLAS_ARTIFACTORY_MAX_BUFFERED_BYTES',
      description: 'Per-object buffer limit (default: 268435456)',
    },
  ];
}

function buildStorageOptionsHelp({
  includeRegistry = true,
}: {
  includeRegistry?: boolean;
} = {}): HelpEntry[] {
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
      label: '--storage <s3|artifactory>',
      description: 'Storage provider; overrides ATLAS_STORAGE',
    },
    {
      label: '--storage-api-url <url>',
      description: 'Private S3-compatible endpoint or Artifactory API root',
    },
    { label: '--bucket <name>', description: 'Target bucket' },
    { label: '--key-prefix <prefix>', description: 'Target key prefix' },
    { label: '--region <region>', description: 'Target signing region' },
    {
      label: '--repository <name>',
      description: 'Artifactory local Generic repository',
    },
    {
      label: '--lock-resource <name>',
      description: 'Artifactory shared external writer lock name',
    },
  ];
}
