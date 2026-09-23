export function encodeTextAsBytes(text: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(text);

  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
}

export async function aSha256DigestOf(
  text: string,
): Promise<`sha256:${string}`> {
  const hash = new Uint8Array(
    await crypto.subtle.digest('SHA-256', encodeTextAsBytes(text)),
  );

  return `sha256:${[...hash].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}
