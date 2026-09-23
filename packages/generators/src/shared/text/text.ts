export function convertIdToTitle(id: string): string {
  return id
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function convertIdToPascalCase(id: string): string {
  return convertIdToTitle(id).replace(/\s+/g, '');
}

export function formatJsonDocument(document: unknown): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}
