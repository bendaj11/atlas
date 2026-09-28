import { assertManifestDescriptor } from '@atlas/schema';
import {
  aManifestDescriptor,
  aRemoteEntryFile,
  aStylesheetFile,
} from './payload-files.js';

describe('aManifestDescriptor', () => {
  it('should build a schema-valid manifest descriptor when built with defaults', () => {
    expect(() => assertManifestDescriptor(aManifestDescriptor())).not.toThrow();
  });
});

describe('aRemoteEntryFile', () => {
  it('should build a payload file with the remote entry role when built with defaults', () => {
    expect(aRemoteEntryFile().role).toBe('remote-entry');
  });
});

describe('aStylesheetFile', () => {
  it('should build a payload file with the stylesheet role when built with defaults', () => {
    expect(aStylesheetFile().role).toBe('stylesheet');
  });

  it('should build a css payload path when built with defaults', () => {
    expect(aStylesheetFile().path.endsWith('.css')).toBe(true);
  });
});
