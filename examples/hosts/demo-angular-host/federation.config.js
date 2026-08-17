const {
  createAngularFederationConfig,
} = require('@atlas/sdk/federation-config');

module.exports = createAngularFederationConfig({
  projectRoot: __dirname,
  name: 'atlas_demo_angular_host',
  expose: 'host',
  // Add skip, exposes, shared, or other Native Federation options here.
  skip: [],
});
