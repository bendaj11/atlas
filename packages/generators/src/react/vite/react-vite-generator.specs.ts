import { faker } from '@faker-js/faker';
import { anAtlasId } from '../../testkit/generator-options.testkit.js';
import { ReactViteGeneratorDriver } from './react-vite-generator.driver.js';

describe('renderReactViteConfig', () => {
  let driver: ReactViteGeneratorDriver;

  beforeEach(() => {
    driver = new ReactViteGeneratorDriver();
  });

  it('should merge the host factory config on port 4200 when type is host and dev server port is omitted', () => {
    const name = anAtlasId();
    driver.given
      .name(name)
      .given.type('host')
      .given.devServerPort(undefined)
      .when.generated();

    expect(driver.get.contents())
      .toBe(`import { createReactHostViteConfig } from "@atlas/sdk/federation-config";
import { defineConfig, mergeConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(mergeConfig(
  createReactHostViteConfig({
    projectRoot: __dirname,
    projectName: "${name}",
    // Add app-local workspace packages here so Vite bundles and serves them locally.
    skip: []
  }),
  {
    base: "./",
    plugins: [react({})],
    server: { port: 4200, cors: true }
  }
));
`);
  });

  it('should merge the app factory config with the react major on port 4201 when type is app and dev server port is omitted', () => {
    const name = anAtlasId();
    const reactMajor = faker.number.int({ min: 17, max: 19 });
    driver.given
      .name(name)
      .given.type('app')
      .given.reactMajor(reactMajor)
      .given.devServerPort(undefined)
      .when.generated();

    expect(driver.get.contents())
      .toBe(`import { createReactAppViteConfig } from "@atlas/sdk/federation-config";
import { defineConfig, mergeConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(mergeConfig(
  createReactAppViteConfig({
    projectRoot: __dirname,
    projectName: "${name}",
    reactMajor: ${reactMajor},
    // Add app-local workspace packages here so Vite bundles and serves them locally.
    skip: []
  }),
  {
    base: "./",
    plugins: [react({})],
    server: { port: 4201, cors: true }
  }
));
`);
  });

  it('should serve on the dev server port when dev server port is given', () => {
    const devServerPort = faker.internet.port();
    driver.given.devServerPort(devServerPort).when.generated();

    expect(driver.get.contents()).toContain(
      `server: { port: ${devServerPort}, cors: true }`,
    );
  });
});
