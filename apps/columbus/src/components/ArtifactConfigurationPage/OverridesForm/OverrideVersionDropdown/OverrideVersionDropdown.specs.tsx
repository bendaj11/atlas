import { describe, expect, it } from '@jest/globals';
import type { Manifest } from '../../../../types/app.js';
import { isDeployedProductionVersion } from './OverrideVersionDropdown.js';

const deployedManifest: Manifest = {
  schemaVersion: '1',
  kind: 'app',
  id: 'orders',
  name: 'Orders',
  version: '1.0.0',
  buildId: 'canonical',
  channel: 'production',
  framework: 'react',
  remoteEntryUrl: 'https://cdn.example/orders/remoteEntry.json',
};

describe('deployed production version', () => {
  it('should identify deployed release when version matches deployment', () => {
    expect(
      isDeployedProductionVersion(deployedManifest, deployedManifest),
    ).toBe(true);
  });

  it('should reject newer release when it differs from deployment', () => {
    const newerManifest = { ...deployedManifest, version: '2.0.0' };

    expect(isDeployedProductionVersion(newerManifest, deployedManifest)).toBe(
      false,
    );
  });
});
