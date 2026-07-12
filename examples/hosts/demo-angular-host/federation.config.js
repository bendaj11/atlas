const { createAngularFederationConfig } = require("@atlas/sdk/federation-config");

module.exports = createAngularFederationConfig({
  projectRoot: __dirname,
  name: "atlas_demo_angular_host",
  exposeApp: false
});
