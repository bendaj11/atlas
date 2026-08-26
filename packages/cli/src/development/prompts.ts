import type { DevPrompts } from './types.js';

export const nonInteractivePrompter: DevPrompts = {
  interactive: false,
  async select() {
    throw new Error('Preview must be selected in interactive mode.');
  },
};
