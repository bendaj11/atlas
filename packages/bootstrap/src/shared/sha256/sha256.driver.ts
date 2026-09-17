import {
  computeSha256,
  convertBytesToBase64,
  convertBytesToHex,
} from './sha256.js';

export class Sha256Driver {
  private digest!: Uint8Array;

  readonly when = {
    hashed: async (bytes: Uint8Array) => {
      this.digest = await computeSha256(bytes);
    },
  };

  readonly get = {
    hex: () => convertBytesToHex(this.digest),
    base64: () => convertBytesToBase64(this.digest),
  };
}
