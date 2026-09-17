import { sha256, bytesToBase64, bytesToHex } from './sha256.js';

export class Sha256Driver {
  private digest!: Uint8Array;

  readonly when = {
    hashed: async (bytes: Uint8Array): Promise<void> => {
      this.digest = await sha256(bytes);
    },
  };

  readonly get = {
    hex: (): string => bytesToHex(this.digest),
    base64: (): string => bytesToBase64(this.digest),
  };
}
