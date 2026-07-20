const { existsSync, mkdirSync, readdirSync, writeFileSync } = require("node:fs");
const { createRequire } = require("node:module");
const { join, relative } = require("node:path");

function sourcePath(projectRoot, path) {
  const pathFromWorkspace = relative(process.cwd(), join(projectRoot, "src", path)).replaceAll("\\", "/");
  return pathFromWorkspace.startsWith(".") ? pathFromWorkspace : `./${pathFromWorkspace}`;
}

function projectPath(projectRoot, path) {
  const pathFromWorkspace = relative(process.cwd(), join(projectRoot, path)).replaceAll("\\", "/");
  return pathFromWorkspace.startsWith(".") ? pathFromWorkspace : `./${pathFromWorkspace}`;
}

function widgetNames(projectRoot) {
  const widgetsRoot = join(projectRoot, "src/exported-widgets");
  return existsSync(widgetsRoot)
    ? readdirSync(widgetsRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
    : [];
}

function writeWidgetEntry(projectRoot, name, extension, contents) {
  const generatedDirectory = join(projectRoot, ".atlas/widgets");
  mkdirSync(generatedDirectory, { recursive: true });
  const relativeEntryPoint = `.atlas/widgets/${name}.${extension}`;
  writeFileSync(join(projectRoot, relativeEntryPoint), contents);
  return relativeEntryPoint;
}

function createAngularWidgetEntries(projectRoot) {
  return widgetNames(projectRoot).map((name) => ({
    name,
    entryPoint: writeWidgetEntry(projectRoot, name, "ts", `import "zone.js";
import { createExportedWidget } from "@atlas/sdk/angular";
import Widget from ${JSON.stringify(`../../src/exported-widgets/${name}/index`)};

export default createExportedWidget(Widget);
`)
  }));
}

function createReactWidgetEntries(options) {
  return widgetNames(options.projectRoot).map((name) => ({
    name,
    entryPoint: writeWidgetEntry(options.projectRoot, name, "tsx", reactWidgetEntry(name, options.reactMajor))
  }));
}

function reactWidgetEntry(name, reactMajor) {
  const rootAdapter = reactMajor === 17
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
import Widget from ${JSON.stringify(`../../src/exported-widgets/${name}/index`)};

export default defineExportedWidget({
  createRoot,
  createElement: ({ props }) => createElement(Widget, props as ComponentProps<typeof Widget>)
});
`;
}

function createAngularFederationConfig(options) {
  const requireFromProject = createRequire(join(options.projectRoot, "package.json"));
  const { withNativeFederation } = requireFromProject("@angular-architects/native-federation/config");
  const widgetExposes = Object.fromEntries(
    createAngularWidgetEntries(options.projectRoot).map((entry) => [
      `./widgets/${entry.name}`,
      projectPath(options.projectRoot, entry.entryPoint)
    ])
  );

  return withNativeFederation({
    name: options.name,
    exposes: options.expose === "host"
      ? { "./host": sourcePath(options.projectRoot, "host.ts") }
      : options.expose === "app"
        ? { "./entry": sourcePath(options.projectRoot, "entry.ts"), ...widgetExposes }
        : {},
    shared: {},
    skip: ["rxjs/ajax", "rxjs/fetch", "rxjs/testing", "rxjs/webSocket"]
  });
}

module.exports = { createAngularFederationConfig, createReactWidgetEntries };
