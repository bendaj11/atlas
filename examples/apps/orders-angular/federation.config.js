const {
  createAngularFederationConfig,
} = require('@atlas/sdk/federation-config');

module.exports = createAngularFederationConfig({
  projectRoot: __dirname,
  name: 'atlas_orders_angular',
  expose: 'app',
  // Add skip, exposes, shared, or other Native Federation options here.
  skip: [],
});
