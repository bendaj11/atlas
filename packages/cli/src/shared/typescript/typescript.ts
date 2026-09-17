import ts from 'typescript';

export function formatTypeScriptDiagnostics(
  diagnostics: readonly ts.Diagnostic[],
  projectRoot: string,
): string {
  return ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => projectRoot,
    getNewLine: () => '\n',
  });
}
