export function title(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function pascal(value: string): string {
  return title(value).replace(/\s+/g, '');
}

export function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
