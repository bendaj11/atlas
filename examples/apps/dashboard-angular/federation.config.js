const { createAngularFederationConfig } = require("@atlas/sdk/federation-config");

module.exports = createAngularFederationConfig({
  projectRoot: __dirname,
  name: "atlas_dashboard_angular",
  expose: "app"
});
