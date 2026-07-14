import { copyFile, cp, mkdir } from "node:fs/promises";

await mkdir(new URL("../dist/", import.meta.url), { recursive: true });
for (const file of ["manifest.json"]) {
  await copyFile(new URL(`../src/${file}`, import.meta.url), new URL(`../dist/${file}`, import.meta.url));
}
await cp(new URL("../src/icons/", import.meta.url), new URL("../dist/icons/", import.meta.url), { recursive: true });
