import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const EXPORTED_WIDGETS_DIRECTORY = 'src/exported-widgets';

const APP_ENTRY_PATH = 'src/entry.ts';

const ZONE_IMPORT_PATTERN = /^\s*import\s+["']zone\.js["']/m;

const REACT_17_ROOT_ADAPTER = `import type { ReactNode } from "react";
import { render, unmountComponentAtNode } from "react-dom";

function createRoot(container: Element) {
  return {
    render(element: ReactNode) { render(element, container); },
    unmount() { unmountComponentAtNode(container); }
  };
}`;

const REACT_18_ROOT_ADAPTER = `import { createRoot } from "react-dom/client";`;

export interface AngularWidgetEntrySourceOptions {
  readonly projectRoot: string;
  readonly name: string;
}

/** Entry source for an Angular widget; passes `widget.config.ts` to `createExportedWidget` when present and bootstraps zoneless when the App entry (`src/entry.ts`) exists and does not import zone.js. */
export function buildAngularWidgetEntrySource(
  options: AngularWidgetEntrySourceOptions,
): string {
  const { projectRoot, name } = options;
  const hasConfig = existsSync(
    join(projectRoot, EXPORTED_WIDGETS_DIRECTORY, name, 'widget.config.ts'),
  );
  const configImport = hasConfig
    ? `import { widgetConfig } from ${buildWidgetSourceSpecifier(name, 'widget.config')};\n`
    : '';

  if (usesZone(projectRoot)) {
    const configArgument = hasConfig ? ', widgetConfig' : '';

    return `import "zone.js";
import { createExportedWidget } from "@atlas/sdk/angular";
import Widget from ${buildWidgetSourceSpecifier(name, 'index')};
${configImport}
export default createExportedWidget(Widget${configArgument});
`;
  }

  const configArgument = hasConfig
    ? '{ ...widgetConfig, providers: [provideZonelessChangeDetection(), ...widgetConfig.providers] }'
    : '{ providers: [provideZonelessChangeDetection()] }';

  return `import { provideZonelessChangeDetection } from "@angular/core";
import { createExportedWidget } from "@atlas/sdk/angular";
import Widget from ${buildWidgetSourceSpecifier(name, 'index')};
${configImport}
export default createExportedWidget(Widget, ${configArgument});
`;
}

/** Entry source for a React widget; React 17 uses the legacy `react-dom` root API. */
export function buildReactWidgetEntrySource(
  name: string,
  reactMajor: number | undefined,
): string {
  const rootAdapter =
    reactMajor === 17 ? REACT_17_ROOT_ADAPTER : REACT_18_ROOT_ADAPTER;

  return `import { createElement, type ComponentProps } from "react";
${rootAdapter}
import { defineExportedWidget } from "@atlas/sdk/react";
import Widget from ${buildWidgetSourceSpecifier(name, 'index')};

export default defineExportedWidget({
  createRoot,
  createElement: ({ props }) => createElement(Widget, props as ComponentProps<typeof Widget>)
});
`;
}

function usesZone(projectRoot: string): boolean {
  const entryPath = join(projectRoot, APP_ENTRY_PATH);

  if (!existsSync(entryPath)) {
    return true;
  }

  return ZONE_IMPORT_PATTERN.test(readFileSync(entryPath, 'utf8'));
}

function buildWidgetSourceSpecifier(name: string, file: string): string {
  return JSON.stringify(`../../${EXPORTED_WIDGETS_DIRECTORY}/${name}/${file}`);
}
