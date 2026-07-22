import { copyFile, cp, mkdir } from 'node:fs/promises';

const distributionDirectory = new URL('../../../dist/', import.meta.url);

await mkdir(distributionDirectory, { recursive: true });
await copyFile(
  new URL('../../manifest.json', import.meta.url),
  new URL('manifest.json', distributionDirectory),
);
await cp(
  new URL('../../icons/', import.meta.url),
  new URL('icons/', distributionDirectory),
  { recursive: true },
);
