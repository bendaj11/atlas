import type { Plugin } from 'vite';
import { convertToPosixPath } from '../project-paths/project-paths.cjs';
import { resolveProjectSourceRoot } from './source-root.cjs';

const SOURCE_FILE_PATTERN = /\.[cm]?[jt]sx?$/;

/** Forces a full page reload instead of HMR for React sources: federated module identity must stay stable. */
export function createReactSourceReloadPlugin(projectRoot: string): Plugin {
  const sourceRoot = resolveProjectSourceRoot(projectRoot);

  return {
    name: 'atlas-react-source-reload',
    apply: 'serve',

    handleHotUpdate({ file, server }) {
      const sourceFile = convertToPosixPath(file);
      const isSource =
        sourceFile.startsWith(sourceRoot) &&
        SOURCE_FILE_PATTERN.test(sourceFile);

      if (!isSource) return;

      server.ws.send({ type: 'full-reload', path: '*' });

      return [];
    },
  };
}
