import type TypeScript from 'typescript';

export async function loadTypeScript(): Promise<typeof TypeScript> {
  const { default: typescript } = await import('typescript');

  return typescript;
}

export async function formatTypeScriptDiagnostics(
  diagnostics: readonly TypeScript.Diagnostic[],
  projectRoot: string,
): Promise<string> {
  const ts = await loadTypeScript();

  return ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => projectRoot,
    getNewLine: () => '\n',
  });
}
