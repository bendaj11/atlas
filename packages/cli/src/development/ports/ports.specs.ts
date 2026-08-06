import { beforeEach, describe, expect, it } from '@jest/globals';
import { DevelopmentPortsDriver } from './ports.driver.js';

describe('resolveHostDevPorts', () => {
  let driver: DevelopmentPortsDriver;

  beforeEach(() => {
    driver = new DevelopmentPortsDriver();
  });

  it('should keep configured port browser-facing when options are absent', () => {
    driver.given.configuration('default');

    driver.when.resolve();

    expect(driver.get.ports()).toStrictEqual({
      bootstrapPort: 4200,
      clientPort: 4300,
    });
  });

  it('should use custom browser port when port is explicit', () => {
    driver.given.configuration('custom-browser');

    driver.when.resolve();

    expect(driver.get.ports()).toStrictEqual({
      bootstrapPort: driver.get.customPort(),
      clientPort: 4300,
    });
  });

  it('should split ports when bootstrap port is explicit', () => {
    driver.given.configuration('explicit-bootstrap');

    driver.when.resolve();

    expect(driver.get.ports()).toStrictEqual({
      bootstrapPort: driver.get.bootstrapPort(),
      clientPort: driver.get.customPort(),
    });
  });

  it('should reuse client port when deployed host URL is configured', () => {
    driver.given.configuration('deployed');

    driver.when.resolve();

    expect(driver.get.ports()).toStrictEqual({
      bootstrapPort: driver.get.customPort(),
      clientPort: driver.get.customPort(),
    });
  });

  it('should reject ports when local servers share one port', () => {
    driver.given.configuration('conflict');

    expect(driver.when.resolve).toThrow(/must differ/);
  });

  it('should keep generated port browser-facing when options are absent', () => {
    driver.given.configuration('generated');

    driver.when.resolve();

    expect(driver.get.ports()).toStrictEqual({
      bootstrapPort: driver.get.generatedPort(),
      clientPort: 4300,
    });
  });
});
