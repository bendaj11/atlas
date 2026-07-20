export const ARTIFACTS_ROUTE = '/';
export const ARTIFACT_CONFIGURATION_ROUTE = '/artifacts/:artifactKey';

export function artifactConfigurationPath(artifactKey: string): string {
  return `/artifacts/${encodeURIComponent(artifactKey)}`;
}
