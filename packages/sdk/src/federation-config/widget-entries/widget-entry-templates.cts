import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const EXPORTED_WIDGETS_DIRECTORY = 'src/exported-widgets';

const REACT_17_ROOT_ADAPTER = `import type { ReactNode } from "react";
import { render, unmountComponentAtNode } from "react-dom";

function createRoot(container: Element) {
  return {
    render(element: ReactNode) { render(element, container); },
    unmount() { unmountComponentAtNode(container); }
  };
}`;

const REACT_18_ROOT_ADAPTER = `import { createRoot } from "react-dom/client";`;

/** Entry source for an Angular widget; passes `widget.config.ts` to `createExportedWidget` when present. */
export function buildAngularWidgetEntrySource(
  projectRoot: string,
  name: string,
): string {
  const hasConfig = existsSync(
    join(projectRoot, EXPORTED_WIDGETS_DIRECTORY, name, 'widget.config.ts'),
  );
  const configImport = hasConfig
    ? `import { widgetConfig } from ${buildWidgetSourceSpecifier(name, 'widget.config')};`
    : '';
  const configArgument = hasConfig ? ', widgetConfig' : '';

  return `import "zone.js";
import { createExportedWidget } from "@atlas/sdk/angular";
import Widget from ${buildWidgetSourceSpecifier(name, 'index')};
${configImport}

export default createExportedWidget(Widget${configArgument});
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

function buildWidgetSourceSpecifier(name: string, file: string): string {
  return JSON.stringify(`../../${EXPORTED_WIDGETS_DIRECTORY}/${name}/${file}`);
}
