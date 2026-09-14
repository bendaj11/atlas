export const DEFAULT_CONTROL_PORT = 4_400;
export const CONTROL_PORT_PARAMETER = 'atlas-dev-port';
const CONTROL_PORT_KEY = 'atlas.development-control-port';

export function isControlPort(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 65_535
  );
}

export function parseControlPort(value: string | null): number | undefined {
  if (value === null || value.trim() === '') return undefined;
  const port = Number(value);

  return isControlPort(port) ? port : undefined;
}

export function rememberControlPort(port: number): void {
  sessionStorage.setItem(CONTROL_PORT_KEY, String(port));
}

export function rememberedControlPort(): number | undefined {
  return parseControlPort(sessionStorage.getItem(CONTROL_PORT_KEY));
}
