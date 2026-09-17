export type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function optionalRecord(value: unknown): UnknownRecord | undefined {
  return isRecord(value) ? value : undefined;
}

export function recordOrEmpty(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
