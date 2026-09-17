import { DEVELOPMENT_HELP } from './content/development.js';
import { GENERATION_HELP } from './content/generation.js';
import { PUBLICATION_HELP } from './content/publication.js';
import type { CommandHelp } from './content/types.js';
import { VERIFICATION_HELP } from './content/verification.js';

export const COMMAND_HELP: Readonly<Record<string, CommandHelp>> = {
  ...GENERATION_HELP,
  ...DEVELOPMENT_HELP,
  ...PUBLICATION_HELP,
  ...VERIFICATION_HELP,
};
