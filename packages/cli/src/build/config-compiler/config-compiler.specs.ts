import { faker } from '@faker-js/faker';
import { ConfigCompilerDriver } from './config-compiler.driver.js';
import { testTypeScriptConfig } from './config-compiler.testkit.js';

const HOST_CONFIG = `export default { type: "host", id: "${faker.string.uuid()}", framework: "react" };\n`;

describe('compileAtlasConfig', () => {
  let driver: ConfigCompilerDriver;

  beforeEach(async () => {
    driver = new ConfigCompilerDriver();

    await driver.given.project();
    await driver.given.projectFile('atlas.config.ts', HOST_CONFIG);
  });

  it('should emit the config when tsconfig.json disables output', async () => {
    await driver.given.projectFile(
      'tsconfig.json',
      JSON.stringify(testTypeScriptConfig({ noEmit: true })),
    );

    await driver.when.compiled();

    expect(await driver.get.emitted()).toBe(true);
  });

  it('should prefer tsconfig.app.json when both configs exist', async () => {
    await driver.given.projectFile(
      'tsconfig.json',
      JSON.stringify({ compilerOptions: { emitDeclarationOnly: true } }),
    );
    await driver.given.projectFile(
      'tsconfig.app.json',
      JSON.stringify(testTypeScriptConfig()),
    );

    await driver.when.compiled();

    expect(await driver.get.emitted()).toBe(true);
  });

  it('should reject when the project has no TypeScript config', async () => {
    await expect(driver.when.compiled()).rejects.toThrow(
      'Could not find tsconfig.app.json or tsconfig.json',
    );
  });

  it('should reject when tsconfig.json is not valid JSON', async () => {
    await driver.given.projectFile('tsconfig.json', '{ compilerOptions: ');

    await expect(driver.when.compiled()).rejects.toThrow();
  });

  it('should reject with the diagnostic when atlas.config.ts has type errors', async () => {
    await driver.given.projectFile(
      'tsconfig.json',
      JSON.stringify(testTypeScriptConfig()),
    );
    await driver.given.projectFile(
      'atlas.config.ts',
      'export default missingConfig;\n',
    );

    await expect(driver.when.compiled()).rejects.toThrow(/missingConfig/);
  });

  it('should emit into .atlas when an nx workspace tsconfig sets another outDir', async () => {
    driver.given.workspaceKind('nx');
    await driver.given.projectFile(
      'tsconfig.json',
      JSON.stringify(testTypeScriptConfig({ outDir: 'elsewhere' })),
    );

    await driver.when.compiled();

    expect(await driver.get.emitted()).toBe(true);
  });
});
