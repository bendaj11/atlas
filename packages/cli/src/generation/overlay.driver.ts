import type { AtlasGeneratedFile } from '@atlas/generators';
import { generatedOverlay } from './overlay.js';
import type { SupportedFramework } from '../shared/index.js';

export class OverlayDriver {
  private files: AtlasGeneratedFile[] = [];

  readonly given = {
    files: (paths: string[]): this => {
      this.files = paths.map((path) => ({ path, contents: '' }));

      return this;
    },
  };

  readonly get = {
    overlayPaths: (options: {
      workspaceScaffolded: boolean;
      type: 'host' | 'app';
      framework: SupportedFramework;
    }): string[] =>
      generatedOverlay(
        this.files,
        options.workspaceScaffolded,
        options.type,
        options.framework,
      ).map(({ path }) => path),
  };
}
