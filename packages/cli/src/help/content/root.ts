import type { HelpEntry } from './types.js';

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
