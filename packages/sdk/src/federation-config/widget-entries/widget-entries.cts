import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  angularWidgetEntry,
  EXPORTED_WIDGETS_DIRECTORY,
  reactWidgetEntry,
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
  return exportedWidgetNames(projectRoot).map((name) => ({
    name,
    entryPoint: writeWidgetEntry({
      projectRoot,
      name,
      extension: 'ts',
      contents: angularWidgetEntry(projectRoot, name),
    }),
  }));
}

export function createReactWidgetEntries(
  options: ReactWidgetEntriesOptions,
): GeneratedWidgetEntry[] {
  return exportedWidgetNames(options.projectRoot).map((name) => ({
    name,
    entryPoint: writeWidgetEntry({
      projectRoot: options.projectRoot,
      name,
      extension: 'tsx',
      contents: reactWidgetEntry(name, options.reactMajor),
    }),
  }));
}

function exportedWidgetNames(projectRoot: string): string[] {
  const widgetsRoot = join(projectRoot, EXPORTED_WIDGETS_DIRECTORY);

  if (!existsSync(widgetsRoot)) return [];

  return readdirSync(widgetsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function writeWidgetEntry(request: WriteWidgetEntryRequest): string {
  const { projectRoot, name, extension, contents } = request;
  const relativeEntryPoint = `${GENERATED_WIDGETS_DIRECTORY}/${name}.${extension}`;

  mkdirSync(join(projectRoot, GENERATED_WIDGETS_DIRECTORY), {
    recursive: true,
  });
  writeFileSync(join(projectRoot, relativeEntryPoint), contents);

  return relativeEntryPoint;
}
