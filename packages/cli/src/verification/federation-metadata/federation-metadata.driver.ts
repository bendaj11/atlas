import {
  parseFederationMetadata,
  type FederationMetadata,
} from './federation-metadata.js';

export class FederationMetadataDriver {
  private source = '';

  readonly given = {
    json: (value: unknown): this => {
      this.source = JSON.stringify(value);

      return this;
    },
  };

  readonly get = {
    metadata: (): FederationMetadata =>
      parseFederationMetadata(new TextEncoder().encode(this.source)),
  };
}
