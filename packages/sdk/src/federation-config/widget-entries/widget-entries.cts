import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface WidgetEntry {
  readonly name: string;
  /** Entry file path relative to the project root. */
  readonly entryPoint: string;
}

export interface ReactWidgetEntriesOptions {
  readonly projectRoot: string;
  readonly reactMajor?: number;
}

const EXPORTED_WIDGETS_DIRECTORY = 'src/exported-widgets';
const GENERATED_WIDGETS_DIRECTORY = '.atlas/widgets';

export function createAngularWidgetEntries(projectRoot: string): WidgetEntry[] {
  return widgetNames(projectRoot).map((name) => ({
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
): WidgetEntry[] {
  return widgetNames(options.projectRoot).map((name) => ({
    name,
    entryPoint: writeWidgetEntry({
      projectRoot: options.projectRoot,
      name,
      extension: 'tsx',
      contents: reactWidgetEntry(name, options.reactMajor),
    }),
  }));
}

function widgetNames(projectRoot: string): string[] {
  const widgetsRoot = join(projectRoot, EXPORTED_WIDGETS_DIRECTORY);
  if (!existsSync(widgetsRoot)) return [];

  return readdirSync(widgetsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function writeWidgetEntry(options: {
  readonly projectRoot: string;
  readonly name: string;
  readonly extension: 'ts' | 'tsx';
  readonly contents: string;
}): string {
  mkdirSync(join(options.projectRoot, GENERATED_WIDGETS_DIRECTORY), {
    recursive: true,
  });
  const relativeEntryPoint = `${GENERATED_WIDGETS_DIRECTORY}/${options.name}.${options.extension}`;
  writeFileSync(
    join(options.projectRoot, relativeEntryPoint),
    options.contents,
  );

  return relativeEntryPoint;
}

function widgetSourceSpecifier(name: string, file: string): string {
  return JSON.stringify(`../../${EXPORTED_WIDGETS_DIRECTORY}/${name}/${file}`);
}

function angularWidgetEntry(projectRoot: string, name: string): string {
  const hasConfig = existsSync(
    join(projectRoot, EXPORTED_WIDGETS_DIRECTORY, name, 'widget.config.ts'),
  );
  const configImport = hasConfig
    ? `import { widgetConfig } from ${widgetSourceSpecifier(name, 'widget.config')};`
    : '';
  const configArgument = hasConfig ? ', widgetConfig' : '';

  return `import "zone.js";
import { createExportedWidget } from "@atlas/sdk/angular";
import Widget from ${widgetSourceSpecifier(name, 'index')};
${configImport}

export default createExportedWidget(Widget${configArgument});
`;
}

function reactWidgetEntry(
  name: string,
  reactMajor: number | undefined,
): string {
  const rootAdapter =
    reactMajor === 17
      ? `import type { ReactNode } from "react";
import { render, unmountComponentAtNode } from "react-dom";

function createRoot(container: Element) {
  return {
    render(element: ReactNode) { render(element, container); },
    unmount() { unmountComponentAtNode(container); }
  };
}`
      : `import { createRoot } from "react-dom/client";`;

  return `import { createElement, type ComponentProps } from "react";
${rootAdapter}
import { defineExportedWidget } from "@atlas/sdk/react";
import Widget from ${widgetSourceSpecifier(name, 'index')};

export default defineExportedWidget({
  createRoot,
  createElement: ({ props }) => createElement(Widget, props as ComponentProps<typeof Widget>)
});
`;
}
