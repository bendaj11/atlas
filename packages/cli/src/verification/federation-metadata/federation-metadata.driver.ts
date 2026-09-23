import { parseFederationMetadata } from './federation-metadata.js';

export class FederationMetadataDriver {
  private source = '';

  readonly given = {
    json: (value: unknown) => {
      this.source = JSON.stringify(value);

      return this;
    },
  };

  readonly get = {
    metadata: () =>
      parseFederationMetadata(new TextEncoder().encode(this.source)),
  };
}
