import {
  validateEnvironmentDeployment,
  validateHostDeploymentManifest,
} from '@atlas/schema';
import {
  aHostDeploymentManifest,
  anEnvironmentDeployment,
} from './deployments.js';

describe('aHostDeploymentManifest', () => {
  it('should build a schema-valid host deployment manifest when built with defaults', () => {
    expect(validateHostDeploymentManifest(aHostDeploymentManifest())).toEqual(
      [],
    );
  });
});

describe('anEnvironmentDeployment', () => {
  it('should build a schema-valid environment deployment when built with defaults', () => {
    expect(validateEnvironmentDeployment(anEnvironmentDeployment())).toEqual(
      [],
    );
  });
});
