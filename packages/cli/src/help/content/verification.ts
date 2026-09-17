import type { CommandHelp } from './types.js';

export const VERIFICATION_HELP: Readonly<Record<string, CommandHelp>> = {
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
