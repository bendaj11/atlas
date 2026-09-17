import {
  computeSha256,
  convertBytesToBase64,
  convertBytesToHex,
} from './sha256.js';

export class Sha256Driver {
  private digest!: Uint8Array;

  readonly when = {
    hashed: async (bytes: Uint8Array): Promise<void> => {
      this.digest = await computeSha256(bytes);
    },
  };

  readonly get = {
    hex: (): string => convertBytesToHex(this.digest),
    base64: (): string => convertBytesToBase64(this.digest),
  };
}
