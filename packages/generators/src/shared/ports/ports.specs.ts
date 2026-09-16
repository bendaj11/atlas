import { faker } from '@faker-js/faker';
import { PortsDriver } from './ports.driver.js';

describe('defaultDevServerPort', () => {
  let driver: PortsDriver;

  beforeEach(() => {
    driver = new PortsDriver();
  });

  it('should return 4200 when type is host', () => {
    driver.when.defaultPortResolved('host');

    expect(driver.get.port()).toBe(4200);
  });

  it('should return 4201 when type is app', () => {
    driver.when.defaultPortResolved('app');

    expect(driver.get.port()).toBe(4201);
  });
});

describe('hostClientPort', () => {
  let driver: PortsDriver;

  beforeEach(() => {
    driver = new PortsDriver();
  });

  it('should return 4300 when bootstrap port is any other port', () => {
    driver.when.hostClientPortResolved(
      faker.number.int({ min: 1024, max: 4299 }),
    );

    expect(driver.get.port()).toBe(4300);
  });

  it('should return 4200 when bootstrap port is 4300', () => {
    driver.when.hostClientPortResolved(4300);

    expect(driver.get.port()).toBe(4200);
  });
});
