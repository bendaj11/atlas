import { FederationMetadataDriver } from './federation-metadata.driver.js';

const SHARED = {
  packageName: 'react',
  outFileName: 'react.js',
  version: '19.0.0',
  requiredVersion: '^19.0.0',
  singleton: true,
  strictVersion: false,
};

describe('parseFederationMetadata', () => {
  let driver: FederationMetadataDriver;

  beforeEach(() => {
    driver = new FederationMetadataDriver();
  });

  it('should reduce exposes and shared to keys and files when metadata is valid', () => {
    driver.given.json({
      exposes: [{ key: './entry', outFileName: 'entry.js', extra: 1 }],
      shared: [SHARED],
    });

    expect(driver.get.metadata()).toStrictEqual({
      exposes: [{ key: './entry', outFileName: 'entry.js' }],
      shared: [{ packageName: 'react', outFileName: 'react.js' }],
    });
  });

  it('should throw when exposes is not an array', () => {
    driver.given.json({ exposes: {}, shared: [] });

    expect(() => driver.get.metadata()).toThrow('Expected an exposes array.');
  });

  it('should throw when shared is not an array', () => {
    driver.given.json({ exposes: [], shared: null });

    expect(() => driver.get.metadata()).toThrow('Expected a shared array.');
  });

  it('should throw when an expose lacks outFileName', () => {
    driver.given.json({ exposes: [{ key: './entry' }], shared: [] });

    expect(() => driver.get.metadata()).toThrow(
      'Every expose requires key and outFileName.',
    );
  });

  it('should throw when a shared dependency lacks singleton', () => {
    driver.given.json({
      exposes: [],
      shared: [{ ...SHARED, singleton: 'yes' }],
    });

    expect(() => driver.get.metadata()).toThrow(
      /Every shared dependency requires/,
    );
  });
});
