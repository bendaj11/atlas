import { validateIntegrity } from './validate-integrity.js';

export class ValidateIntegrityDriver {
  private error: unknown;

  readonly when = {
    validated: async (bytes: Uint8Array, integrity: string) => {
      try {
        await validateIntegrity(bytes, integrity);
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    error: () => this.error,
  };
}
