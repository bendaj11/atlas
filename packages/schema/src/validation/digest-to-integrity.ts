export function convertDigestToIntegrity(digest: string): string {
  const bytes =
    digest
      .slice('sha256:'.length)
      .match(/.{2}/gu)
      ?.map((value) => String.fromCharCode(Number.parseInt(value, 16)))
      .join('') ?? '';

  return `sha256-${btoa(bytes)}`;
}
