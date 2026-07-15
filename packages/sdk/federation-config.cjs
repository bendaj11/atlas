const { existsSync, readdirSync } = require("node:fs");
const { createRequire } = require("node:module");
const { join, relative } = require("node:path");

function sourcePath(projectRoot, path) {
  const pathFromWorkspace = relative(process.cwd(), join(projectRoot, "src", path)).replaceAll("\\", "/");
  return pathFromWorkspace.startsWith(".") ? pathFromWorkspace : `./${pathFromWorkspace}`;
}

function createAngularFederationConfig(options) {
  const requireFromProject = createRequire(join(options.projectRoot, "package.json"));
  const { withNativeFederation } = requireFromProject("@angular-architects/native-federation/config");
  const widgetsRoot = join(options.projectRoot, "src/exported-widgets");
  const widgetExposes = existsSync(widgetsRoot)
    ? Object.fromEntries(
        readdirSync(widgetsRoot, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => [
            `./widgets/${entry.name}`,
            sourcePath(options.projectRoot, `exported-widgets/${entry.name}/index.ts`)
          ])
      )
    : {};

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

module.exports = { createAngularFederationConfig };
