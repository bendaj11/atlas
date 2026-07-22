import { transformSync } from '@babel/core';
import compilerPlugin, { type LoggerEvent } from 'babel-plugin-react-compiler';
import { readFile } from 'node:fs/promises';

export class HostContextCompilerDriver {
  private compiledFunctions: (string | null)[] = [];

  readonly when = {
    compiled: async (): Promise<this> => {
      const filename = new URL('./HostContext.tsx', import.meta.url).pathname;
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
      this.compiledFunctions = events.flatMap((event) =>
        event.kind === 'CompileSuccess' ? [event.fnName] : [],
      );
      return this;
    },
  };

  readonly get = {
    compiledFunctions: (): (string | null)[] => this.compiledFunctions,
  };
}
