export function describeManifest(manifest: {
  kind: string;
  id: string;
}): string {
  return `${manifest.kind} manifest "${manifest.id}"`;
}
