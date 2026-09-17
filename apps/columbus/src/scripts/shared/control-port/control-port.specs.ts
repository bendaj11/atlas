import { faker } from '@faker-js/faker';
import {
  isControlPort,
  parseControlPort,
  rememberControlPort,
  rememberedControlPort,
} from './control-port';
import { ControlPortDriver } from './control-port.driver';

const VALID_PORTS = [1, 4400, 65535];
const INVALID_PORTS = [0, 65536, 1.5, -1, Number.NaN, '4400', undefined];
const INVALID_PORT_TEXTS = ['abc', '0', '70000', '1.5', ''];

describe('isControlPort', () => {
  it.each(VALID_PORTS)('should accept the port when it is %s', (port) => {
    expect(isControlPort(port)).toBe(true);
  });

  it.each(INVALID_PORTS)('should reject the port when it is %s', (port) => {
    expect(isControlPort(port)).toBe(false);
  });
});

describe('parseControlPort', () => {
  it('should return the port when the text is a valid port', () => {
    const port = faker.internet.port();

    expect(parseControlPort(String(port))).toBe(port);
  });

  it('should return nothing when the text is missing', () => {
    expect(parseControlPort(null)).toBeUndefined();
  });

  it.each(INVALID_PORT_TEXTS)(
    'should return nothing when the text is "%s"',
    (text) => {
      expect(parseControlPort(text)).toBeUndefined();
    },
  );
});

describe('rememberControlPort', () => {
  let driver: ControlPortDriver;

  beforeEach(() => {
    driver = new ControlPortDriver();
  });

  it('should store the port in session storage when remembered', () => {
    const port = faker.internet.port();

    rememberControlPort(port);

    expect(
      driver.get.sessionStorageItem('atlas.development-control-port'),
    ).toBe(String(port));
  });
});

describe('rememberedControlPort', () => {
  let driver: ControlPortDriver;

  beforeEach(() => {
    driver = new ControlPortDriver();
  });

  it('should return nothing when session storage has no port', () => {
    expect(rememberedControlPort()).toBeUndefined();
  });

  it('should return the stored port when session storage has a valid port', () => {
    const port = faker.internet.port();

    driver.given.sessionStorageItem(
      'atlas.development-control-port',
      String(port),
    );

    expect(rememberedControlPort()).toBe(port);
  });

  it('should return nothing when the stored port is invalid', () => {
    driver.given.sessionStorageItem(
      'atlas.development-control-port',
      faker.lorem.word(),
    );

    expect(rememberedControlPort()).toBeUndefined();
  });
});
