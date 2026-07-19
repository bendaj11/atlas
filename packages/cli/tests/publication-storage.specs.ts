import { expect, test } from "@jest/globals";
import { publicationContentType } from "../dist/publication-metadata.js";
import { createPublicationStorage } from "../dist/publication-storage.js";

test.each([
  ["registry.json", "application/json; charset=utf-8"],
  ["remoteEntry.json", "application/json; charset=utf-8"],
  ["entry.js", "text/javascript; charset=utf-8"],
  ["styles.css", "text/css; charset=utf-8"],
  ["font.woff2", "font/woff2"],
  ["asset.unknown", "application/octet-stream"]
])("S3 publication assigns %s its MIME type", (path, expectedContentType) => {
  expect(publicationContentType(path)).toBe(expectedContentType);
});

test("explicit storage credentials must be configured as a pair", async () => {
  const previousStorage = process.env.ATLAS_STORAGE;
  const previousBucket = process.env.ATLAS_S3_BUCKET;
  const previousAccessKeyId = process.env.ATLAS_STORAGE_ACCESS_KEY_ID;
  const previousSecretAccessKey = process.env.ATLAS_STORAGE_SECRET_ACCESS_KEY;
  process.env.ATLAS_STORAGE = "s3";
  process.env.ATLAS_S3_BUCKET = "atlas";
  process.env.ATLAS_STORAGE_ACCESS_KEY_ID = "access-key";
  delete process.env.ATLAS_STORAGE_SECRET_ACCESS_KEY;

  try {
    await expect(createPublicationStorage()).rejects.toThrow(
      "ATLAS_STORAGE_ACCESS_KEY_ID and ATLAS_STORAGE_SECRET_ACCESS_KEY must be set together."
    );
  } finally {
    setEnvironmentVariable("ATLAS_STORAGE", previousStorage);
    setEnvironmentVariable("ATLAS_S3_BUCKET", previousBucket);
    setEnvironmentVariable("ATLAS_STORAGE_ACCESS_KEY_ID", previousAccessKeyId);
    setEnvironmentVariable("ATLAS_STORAGE_SECRET_ACCESS_KEY", previousSecretAccessKey);
  }
});

function setEnvironmentVariable(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
