export async function computeSha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest('SHA-256', new Uint8Array(bytes)),
  );
}

export function convertBytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function convertBytesToBase64(bytes: Uint8Array): string {
  let binary = '';

  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary);
}
