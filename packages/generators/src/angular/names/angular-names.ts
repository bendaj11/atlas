export function convertNameToAngularRootSelector(name: string): string {
  return `atlas-${name.replace(/[^a-zA-Z0-9-]/g, '-')}-root`;
}

export function convertNameToFederationRemoteName(name: string): string {
  return `atlas_${name.replace(/[^a-zA-Z0-9_]/g, '_')}`;
}
