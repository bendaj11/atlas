import { faker } from '@faker-js/faker';
import { DevelopmentPortsDriver } from './ports.driver.js';

describe('resolveHostDevPorts', () => {
  let driver: DevelopmentPortsDriver;

  beforeEach(() => {
    driver = new DevelopmentPortsDriver();
  });

  it('should serve bootstrap on the configured port and the client on 4300 when no flags are given', () => {
    const configuredPort = faker.number.int({ min: 4500, max: 4999 });
    driver.given.configuredPort(configuredPort);

    expect(driver.get.ports()).toStrictEqual({
      bootstrapPort: configuredPort,
      clientPort: 4300,
    });
  });

  it('should move the client to 4200 when the configured port is 4300', () => {
    driver.given.configuredPort(4300);

    expect(driver.get.ports()).toStrictEqual({
      bootstrapPort: 4300,
      clientPort: 4200,
    });
  });

  it('should split bootstrap and client when --bootstrap-port is given', () => {
    const configuredPort = faker.number.int({ min: 4500, max: 4999 });
    const bootstrapPort = faker.number.int({ min: 5000, max: 5499 });
    driver.given
      .configuredPort(configuredPort)
      .given.flags([`--bootstrap-port=${bootstrapPort}`]);

    expect(driver.get.ports()).toStrictEqual({
      bootstrapPort,
      clientPort: configuredPort,
    });
  });

  it('should honor --host-client-port when given', () => {
    const clientPort = faker.number.int({ min: 5000, max: 5499 });
    driver.given.flags([`--host-client-port=${clientPort}`]);

    expect(driver.get.ports().clientPort).toBe(clientPort);
  });

  it('should reuse the configured port for the client when the preview is deployed', () => {
    const configuredPort = faker.number.int({ min: 4500, max: 4999 });
    driver.given.configuredPort(configuredPort).given.previewKind('deployed');

    expect(driver.get.ports()).toStrictEqual({
      bootstrapPort: configuredPort,
      clientPort: configuredPort,
    });
  });

  it('should throw when a local preview would share one port', () => {
    const port = faker.number.int({ min: 4500, max: 4999 });
    driver.given
      .configuredPort(port)
      .given.flags([`--host-client-port=${port}`]);

    expect(() => driver.get.ports()).toThrow(/must differ/);
  });
});
