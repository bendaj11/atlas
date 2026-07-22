import { beforeEach, describe, expect, it } from '@jest/globals';
import { HostContextCompilerDriver } from './HostContext.compiler.driver.js';

describe('HostContext React compilation', () => {
  let driver: HostContextCompilerDriver;

  beforeEach(() => {
    driver = new HostContextCompilerDriver();
  });

  it('should compile provider when React Compiler processes source', async () => {
    await driver.when.compiled();

    expect(driver.get.compiledFunctions()).toContain('HostProvider');
  });
});
