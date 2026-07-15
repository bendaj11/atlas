import { afterEach, expect, jest, test } from "@jest/globals";
import { S3PublicationStorage } from "../dist/publication-storage.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test.each([
  ["registry.json", "application/json; charset=utf-8"],
  ["remoteEntry.json", "application/json; charset=utf-8"],
  ["entry.js", "text/javascript; charset=utf-8"],
  ["styles.css", "text/css; charset=utf-8"],
  ["font.woff2", "font/woff2"],
  ["asset.unknown", "application/octet-stream"]
])("S3 publication assigns %s its MIME type", async (path, expectedContentType) => {
  const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }));
  globalThis.fetch = fetchMock;
  const storage = new S3PublicationStorage({
    endpoint: "https://storage.example.com",
    bucket: "atlas",
    prefix: "production",
    region: "us-east-1",
    accessKeyId: "access-key",
    secretAccessKey: "secret-key"
  });

  await storage.create(path, new Uint8Array(), "public, max-age=31536000, immutable");

  const requestHeaders = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
  expect(requestHeaders.get("content-type")).toBe(expectedContentType);
});
