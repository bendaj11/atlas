const BYTE_UNITS = ['B', 'KB', 'MB', 'GB'] as const;

export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }

  const rounded = unit === 0 ? String(value) : value.toFixed(1);

  return `${rounded} ${BYTE_UNITS[unit]}`;
}

export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) return `${Math.round(milliseconds)}ms`;

  const seconds = milliseconds / 1000;

  if (seconds < 60) return `${seconds.toFixed(1)}s`;

  const minutes = Math.floor(seconds / 60);

  return `${minutes}m ${Math.round(seconds % 60)}s`;
}

export function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
