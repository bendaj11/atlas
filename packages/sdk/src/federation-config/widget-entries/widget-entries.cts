import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildAngularWidgetEntrySource,
  EXPORTED_WIDGETS_DIRECTORY,
  buildReactWidgetEntrySource,
} from './widget-entry-templates.cjs';

export interface GeneratedWidgetEntry {
  readonly name: string;
  /** Entry file path relative to the project root. */
  readonly entryPoint: string;
}

export interface ReactWidgetEntriesOptions {
  readonly projectRoot: string;
  readonly reactMajor?: number;
}

interface WriteWidgetEntryRequest {
  readonly projectRoot: string;
  readonly name: string;
  readonly extension: 'ts' | 'tsx';
  readonly contents: string;
}

const GENERATED_WIDGETS_DIRECTORY = '.atlas/widgets';

/** Writes one generated entry per `src/exported-widgets/<name>/` directory. */
export function createAngularWidgetEntries(
  projectRoot: string,
): GeneratedWidgetEntry[] {
  return listExportedWidgetNames(projectRoot).map((name) => ({
    name,
    entryPoint: writeGeneratedWidgetEntry({
      projectRoot,
      name,
      extension: 'ts',
      contents: buildAngularWidgetEntrySource(projectRoot, name),
    }),
  }));
}

export function createReactWidgetEntries(
  options: ReactWidgetEntriesOptions,
): GeneratedWidgetEntry[] {
  return listExportedWidgetNames(options.projectRoot).map((name) => ({
    name,
    entryPoint: writeGeneratedWidgetEntry({
      projectRoot: options.projectRoot,
      name,
      extension: 'tsx',
      contents: buildReactWidgetEntrySource(name, options.reactMajor),
    }),
  }));
}

function listExportedWidgetNames(projectRoot: string): string[] {
  const widgetsRoot = join(projectRoot, EXPORTED_WIDGETS_DIRECTORY);

  if (!existsSync(widgetsRoot)) return [];

  return readdirSync(widgetsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function writeGeneratedWidgetEntry(request: WriteWidgetEntryRequest): string {
  const { projectRoot, name, extension, contents } = request;
  const relativeEntryPoint = `${GENERATED_WIDGETS_DIRECTORY}/${name}.${extension}`;

  mkdirSync(join(projectRoot, GENERATED_WIDGETS_DIRECTORY), {
    recursive: true,
  });
  writeFileSync(join(projectRoot, relativeEntryPoint), contents);

  return relativeEntryPoint;
}
