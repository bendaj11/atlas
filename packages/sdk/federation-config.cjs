const { existsSync, readdirSync } = require("node:fs");
const { createRequire } = require("node:module");
const { join } = require("node:path");

function sourcePath(path) {
  return `./src/${path}`;
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
            sourcePath(`exported-widgets/${entry.name}/index.ts`)
          ])
      )
    : {};

  return withNativeFederation({
    name: options.name,
    exposes: options.expose === "host"
      ? { "./host": sourcePath("host.ts") }
      : options.expose === "app"
        ? { "./entry": sourcePath("entry.ts"), ...widgetExposes }
        : {},
    shared: {},
    skip: ["rxjs/ajax", "rxjs/fetch", "rxjs/testing", "rxjs/webSocket"]
  });
}

module.exports = { createAngularFederationConfig };
