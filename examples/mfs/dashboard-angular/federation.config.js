const { readdirSync, existsSync } = require("node:fs");
const { join } = require("node:path");
const { withNativeFederation } = require("@angular-architects/native-federation/config");

const widgetsRoot = join(__dirname, "src/exported-widgets");
const widgetExposes = existsSync(widgetsRoot)
  ? Object.fromEntries(readdirSync(widgetsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => [`./widgets/${entry.name}`, `./src/exported-widgets/${entry.name}/index.ts`]))
  : {};

module.exports = withNativeFederation({
  name: "atlas_dashboard_angular",
  exposes: { "./entry": "./src/entry.ts", ...widgetExposes },
  shared: {},
  skip: ["rxjs/ajax", "rxjs/fetch", "rxjs/testing", "rxjs/webSocket"]
});
