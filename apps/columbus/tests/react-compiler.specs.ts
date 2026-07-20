import { expect, test } from '@jest/globals';
import { transformSync } from '@babel/core';
import compilerPlugin, {
  type LoggerEvent,
} from 'babel-plugin-react-compiler';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

test('React Compiler compiles the popup host provider', async () => {
  const filename = join(
    process.cwd(),
    'apps/columbus/src/context/PopupHostContext.tsx',
  );
  const source = await readFile(filename, 'utf8');
  const events: LoggerEvent[] = [];

  transformSync(source, {
    babelrc: false,
    configFile: false,
    filename,
    plugins: [
      [
        compilerPlugin,
        {
          target: '19',
          panicThreshold: 'none',
          logger: {
            logEvent: (_source: string | null, event: LoggerEvent) => {
              events.push(event);
            },
          },
        },
      ],
      ['@babel/plugin-syntax-typescript', { isTSX: true }],
      '@babel/plugin-syntax-jsx',
    ],
  });

  const compiledFunctions = events.flatMap((event) =>
    event.kind === 'CompileSuccess' ? [event.fnName] : [],
  );
  expect(compiledFunctions).toContain('PopupHostProvider');
});
