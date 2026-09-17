import { sha256, toBase64, toHex } from './sha256.js';

export class Sha256Driver {
  private digest!: Uint8Array;

  readonly when = {
    hashed: async (bytes: Uint8Array): Promise<void> => {
      this.digest = await sha256(bytes);
    },
  };

  readonly get = {
    hex: (): string => toHex(this.digest),
    base64: (): string => toBase64(this.digest),
  };
}
