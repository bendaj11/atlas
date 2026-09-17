import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import {
  initSync as initializeCommonJsLexer,
  parse as parseCommonJs,
} from 'cjs-module-lexer';
import { federationConfigError } from '../federation-config-error/federation-config-error.cjs';

const IDENTIFIER_PATTERN = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
const RESERVED_EXPORT_NAMES = new Set(['default', '__esModule']);

let lexerReady = false;

/**
 * Lists the named exports of a CommonJS entry, following `module.exports = require(...)` re-exports.
 * The entry itself must lex; unreadable re-export targets are skipped.
 */
export function commonJsNamedExports(entryPoint: string): readonly string[] {
  initializeLexerOnce();

  const resolvedEntry = resolve(entryPoint);
  const parsed = parseCommonJsEntry(resolvedEntry);

  const names = new Set<string>(parsed.exports);
  const visited = new Set<string>([resolvedEntry]);
  collectReexportedNames(resolvedEntry, parsed.reexports, names, visited);

  return [...names]
    .filter(
      (name) =>
        !RESERVED_EXPORT_NAMES.has(name) && IDENTIFIER_PATTERN.test(name),
    )
    .sort();
}

function parseCommonJsEntry(
  entryPoint: string,
): ReturnType<typeof parseCommonJs> {
  try {
    return parseCommonJs(readFileSync(entryPoint, 'utf8'));
  } catch (cause) {
    throw federationConfigError(
      `Atlas could not read the CommonJS exports of shared dependency entry "${entryPoint}".`,
      {
        suggestedActions:
          'Verify the package installs correctly and its entry is valid CommonJS, or skip the package in the Atlas federation config to bundle it instead.',
        code: 'ATLAS_SHARED_COMMONJS_EXPORTS_UNREADABLE',
        cause,
      },
    );
  }
}

function collectReexportedNames(
  entryPoint: string,
  specifiers: readonly string[],
  names: Set<string>,
  visited: Set<string>,
): void {
  const requireFromEntry = createRequire(entryPoint);

  for (const specifier of specifiers) {
    const parsed = parseReexportedModule(requireFromEntry, specifier, visited);

    if (!parsed) continue;

    for (const name of parsed.exports) names.add(name);
    collectReexportedNames(parsed.entryPoint, parsed.reexports, names, visited);
  }
}

function parseReexportedModule(
  requireFromEntry: NodeJS.Require,
  specifier: string,
  visited: Set<string>,
): { entryPoint: string; exports: string[]; reexports: string[] } | undefined {
  try {
    const entryPoint = requireFromEntry.resolve(specifier);

    if (visited.has(entryPoint)) return undefined;
    visited.add(entryPoint);

    const parsed = parseCommonJs(readFileSync(entryPoint, 'utf8'));

    return { entryPoint, exports: parsed.exports, reexports: parsed.reexports };
  } catch {
    return undefined;
  }
}

function initializeLexerOnce(): void {
  if (lexerReady) return;

  initializeCommonJsLexer();
  lexerReady = true;
}
