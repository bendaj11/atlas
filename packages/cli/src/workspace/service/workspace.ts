import { join, relative, resolve } from 'node:path';
import {
  createFormatGeneratedCommand,
  createInstallCommand,
  createNxGenerationCommand,
  createNxPluginInstallCommand,
  createTaskCommand,
  installationRoot,
  nxProjectPlugin,
  packageIsInstalled,
} from '../commands/commands.js';
import {
  detectGenerationBases,
  detectPackageManager,
  detectWorkspaceKind,
  findWorkspaceRoot,
} from '../detection/detection.js';
import { findAtlasProject, listAtlasProjects } from '../discovery/discovery.js';
import type { AtlasWorkspace } from '../types.js';
import { runProcess, spawnProcess } from '../../shared/index.js';

export async function detectWorkspace(
  start = process.cwd(),
): Promise<AtlasWorkspace> {
  const currentDirectory = resolve(start);
  const root = await findWorkspaceRoot(currentDirectory);
  const kind = await detectWorkspaceKind(root);
  const manager = await detectPackageManager(root);
  const generationBases = await detectGenerationBases({
    root,
    start: currentDirectory,
  });

  return {
    kind,
    root,
    packageManager: manager,
    findProject: (name) =>
      findAtlasProject({ workspaceRoot: root, name, currentDirectory }),
    listProjects: () => listAtlasProjects(root),
    run: (project, task, args) =>
      runProcess(
        createTaskCommand({ kind, manager, root, project, task, args }),
      ),
    spawn: (project, task, args) =>
      spawnProcess(
        createTaskCommand({ kind, manager, root, project, task, args }),
      ),
    formatGenerated: async (projectRoot) => {
      const command = await createFormatGeneratedCommand({
        kind,
        manager,
        workspaceRoot: root,
        projectRoot,
      });

      if (!command) return false;
      await runProcess(command);

      return true;
    },
    installDependencies: async (projectRoot) =>
      runProcess(
        createInstallCommand({
          manager,
          projectRoot: await installationRoot({
            kind,
            workspaceRoot: root,
            projectRoot,
          }),
        }),
      ),
    missingScaffoldDependency: async (projectType) => {
      if (kind !== 'nx') return undefined;
      const plugin = nxProjectPlugin(projectType);

      return (await packageIsInstalled(root, plugin)) ? undefined : plugin;
    },
    installScaffoldDependency: async (projectType) => {
      if (kind !== 'nx') return;
      await runProcess(
        createNxPluginInstallCommand({ manager, root, projectType }),
      );
    },
    scaffoldProject: async (options) => {
      if (kind !== 'nx') return false;
      const directory = relative(root, options.projectRoot);

      if (!directory || directory === '..' || directory.startsWith('../')) {
        throw new Error(
          'Nx projects must be generated inside the workspace root.',
        );
      }

      try {
        await runProcess(
          createNxGenerationCommand({
            manager,
            root,
            generation: {
              framework: options.framework,
              type: options.type,
              directory,
              devServerPort: options.devServerPort,
              interactive: options.interactive,
              routing: options.routing,
              stylesheetFormat: options.stylesheetFormat,
            },
          }),
        );
      } catch (error) {
        throw new Error(
          `Nx could not scaffold "${options.name}". Install ${nxProjectPlugin(options.framework)} in the workspace and try again.`,
          { cause: error },
        );
      }

      return true;
    },
    generationRoot: (type, name) => join(root, generationBases[type], name),
  };
}
