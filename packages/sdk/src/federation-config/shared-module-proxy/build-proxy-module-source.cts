import type { ProxySourceOptions } from './shared-module-proxy.types.cjs';

/** ESM source that re-exports everything from `entryPoint`, naming CommonJS exports explicitly. */
export function buildProxyModuleSource(options: ProxySourceOptions): string {
  const entry = JSON.stringify(options.entryPoint);
  const imports = options.namedExports.map(
    (name, index) =>
      `import { ${name} as sharedExport${index} } from ${entry};`,
  );
  const exports = options.namedExports.map(
    (name, index) => `sharedExport${index} as ${name}`,
  );

  return [
    ...imports,
    `export * from ${entry};`,
    exports.length > 0 ? `export { ${exports.join(', ')} };` : '',
    options.hasDefaultExport ? `export { default } from ${entry};` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
