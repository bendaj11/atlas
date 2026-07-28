import type { DevPrompts } from './types.js';

export const nonInteractivePrompter: DevPrompts = {
  interactive: false,
  async input() {
    throw new Error('Host URL must be provided in non-interactive mode.');
  },
  async select() {
    throw new Error('Host must be provided in non-interactive mode.');
  },
};
