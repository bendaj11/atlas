import { afterAll } from '@jest/globals';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const createdRoots = new Set<string>();

afterAll(() => {
  for (const root of createdRoots) {
    rmSync(root, { recursive: true, force: true });
  }

  createdRoots.clear();
});

export class WidgetEntryTemplatesDriver {
  private readonly projectRoot = mkdtempSync(
    join(tmpdir(), 'atlas-widget-entry-'),
  );

  constructor() {
    createdRoots.add(this.projectRoot);
  }

  given = {
    devDependencies: (devDependencies: Record<string, string>) => {
      writeFileSync(
        join(this.projectRoot, 'package.json'),
        JSON.stringify({ devDependencies }),
      );

      return this;
    },
    appEntry: (contents: string) => {
      mkdirSync(join(this.projectRoot, 'src'), { recursive: true });
      writeFileSync(join(this.projectRoot, 'src', 'entry.ts'), contents);

      return this;
    },
    widgetConfig: (name: string) => {
      const widgetDirectory = join(
        this.projectRoot,
        'src',
        'exported-widgets',
        name,
      );
      mkdirSync(widgetDirectory, { recursive: true });
      writeFileSync(join(widgetDirectory, 'widget.config.ts'), '');

      return this;
    },
  };

  get = {
    projectRoot: () => this.projectRoot,
  };
}
