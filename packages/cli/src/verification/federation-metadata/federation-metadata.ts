import { asRecord, nonEmptyString } from '../../shared/records/records.js';

export interface FederationMetadata {
  exposes: Array<{ key: string; outFileName: string }>;
  shared: Array<{ packageName: string; outFileName: string }>;
}

export function parseFederationMetadata(bytes: Uint8Array): FederationMetadata {
  const value = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  const record = asRecord(value);
  if (!Array.isArray(record?.exposes))
    throw new Error('Expected an exposes array.');
  if (!Array.isArray(record.shared))
    throw new Error('Expected a shared array.');
  const exposes = record.exposes.map((candidate) => {
    const expose = asRecord(candidate);
    if (!nonEmptyString(expose?.key) || !nonEmptyString(expose.outFileName)) {
      throw new Error('Every expose requires key and outFileName.');
    }

    return { key: expose.key, outFileName: expose.outFileName };
  });
  const shared = record.shared.map((candidate) => {
    const dependency = asRecord(candidate);
    if (
      !nonEmptyString(dependency?.packageName) ||
      !nonEmptyString(dependency.outFileName) ||
      !nonEmptyString(dependency.version) ||
      !nonEmptyString(dependency.requiredVersion) ||
      typeof dependency.singleton !== 'boolean' ||
      typeof dependency.strictVersion !== 'boolean'
    ) {
      throw new Error(
        'Every shared dependency requires packageName, outFileName, version, requiredVersion, singleton, and strictVersion.',
      );
    }

    return {
      packageName: dependency.packageName,
      outFileName: dependency.outFileName,
    };
  });

  return { exposes, shared };
}
