export function renderExportedWidgetsReadme(): string {
  return `# Exported widgets\n\nRun \`atlas g widget <name>\` to choose an app, or pass its stable config ID with \`--app-id=<app-id>\`. Atlas generates widget source plus \`atlas.config.ts\` with stable UUIDv4 identity. Consumers call \`sdk.getWidget(widgetId)\`; do not maintain widget lists in app config.\n`;
}
