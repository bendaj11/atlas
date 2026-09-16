export function formatList(values: readonly string[]): string {
  if (values.length <= 1) return values.join('');
  if (values.length === 2) return `${values[0]} or ${values[1]}`;

  return `${values.slice(0, -1).join(', ')}, or ${values[values.length - 1]}`;
}
