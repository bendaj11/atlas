import { validateAtlasManifest } from '@atlas/schema';
import { anAppManifest } from '../artifact-manifests/artifact-manifests.js';
import { aSha256Integrity, aStylesheet } from './stylesheets.js';

describe('aSha256Integrity', () => {
  it('should build a base64 SHA-256 subresource integrity when generated', () => {
    expect(aSha256Integrity()).toMatch(/^sha256-[A-Za-z0-9]{43}=$/);
  });
});

describe('aStylesheet', () => {
  it('should build a schema-valid stylesheet when attached to an app manifest', () => {
    const manifest = anAppManifest({ styles: [aStylesheet()] });

    expect(validateAtlasManifest(manifest)).toEqual([]);
  });
});
