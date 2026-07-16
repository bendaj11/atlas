import { expect, test } from "@jest/globals";
import { publicationContentType } from "../dist/publication-metadata.js";

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
