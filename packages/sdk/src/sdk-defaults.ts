export function noop(): void {
  return undefined;
}

export async function emptyModalProvider(): Promise<undefined> {
  return undefined;
}

export function missingPopupProvider(): never {
  throw new Error("This Atlas host has not configured a popup provider.");
}

export function missingConfigValue(): undefined {
  return undefined;
}
