const { readdirSync, existsSync } = require("node:fs");
const { join } = require("node:path");
const { withNativeFederation } = require("@angular-architects/native-federation/config");

const componentsRoot = join(__dirname, "src/exported-components");
const componentExposes = existsSync(componentsRoot)
  ? Object.fromEntries(readdirSync(componentsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => [`./components/${entry.name}`, `./src/exported-components/${entry.name}/index.ts`]))
  : {};

module.exports = withNativeFederation({
  name: "atlas_dashboard_angular",
  exposes: { "./entry": "./src/entry.ts", ...componentExposes },
  shared: {},
  skip: ["rxjs/ajax", "rxjs/fetch", "rxjs/testing", "rxjs/webSocket"]
});
