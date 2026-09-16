export function testTypeScriptConfig(
  compilerOptions: Record<string, unknown> = {},
) {
  return {
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'bundler',
      strict: true,
      skipLibCheck: true,
      types: [],
      ...compilerOptions,
    },
  };
}
