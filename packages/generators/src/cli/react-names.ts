export function reactRemoteName(name: string): string {
  return `atlas_${name.replace(/[^a-zA-Z0-9_]/g, "_")}`;
}
