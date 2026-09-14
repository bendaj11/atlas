import { ControlPortDriver } from './control-port.driver';

const VALID_PORTS = [1, 4400, 65535];
const INVALID_PORTS = [0, 65536, 1.5, -1, Number.NaN, '4400', undefined];
const INVALID_PORT_TEXTS = ['abc', '0', '70000', '1.5', ''];

describe('isControlPort', () => {
  let driver: ControlPortDriver;

  beforeEach(() => {
    driver = new ControlPortDriver();
  });

  it.each(VALID_PORTS)('should accept the port when it is %s', (port) => {
    driver.when.validated(port);

    expect(driver.get.result()).toBe(true);
  });

  it.each(INVALID_PORTS)('should reject the port when it is %s', (port) => {
    driver.when.validated(port);

    expect(driver.get.result()).toBe(false);
  });
});

describe('parseControlPort', () => {
  let driver: ControlPortDriver;

  beforeEach(() => {
    driver = new ControlPortDriver();
  });

  it('should return the port when the text is a valid port', () => {
    driver.when.parsed('4512');

    expect(driver.get.result()).toBe(4512);
  });

  it('should return nothing when the text is missing', () => {
    driver.when.parsed(null);

    expect(driver.get.result()).toBeUndefined();
  });

  it.each(INVALID_PORT_TEXTS)(
    'should return nothing when the text is "%s"',
    (text) => {
      driver.when.parsed(text);

      expect(driver.get.result()).toBeUndefined();
    },
  );
});

describe('rememberControlPort', () => {
  let driver: ControlPortDriver;

  beforeEach(() => {
    driver = new ControlPortDriver();
  });

  it('should store the port in session storage when remembered', () => {
    driver.when.remembered(4512);

    expect(
      driver.get.sessionStorageItem('atlas.development-control-port'),
    ).toBe('4512');
  });
});

describe('rememberedControlPort', () => {
  let driver: ControlPortDriver;

  beforeEach(() => {
    driver = new ControlPortDriver();
  });

  it('should return the stored port when session storage has one', () => {
    driver.given
      .sessionStorageItem('atlas.development-control-port', '4512')
      .when.rememberedRead();

    expect(driver.get.result()).toBe(4512);
  });

  it('should return nothing when session storage has no port', () => {
    driver.when.rememberedRead();

    expect(driver.get.result()).toBeUndefined();
  });

  it('should return nothing when the stored port is invalid', () => {
    driver.given
      .sessionStorageItem('atlas.development-control-port', 'abc')
      .when.rememberedRead();

    expect(driver.get.result()).toBeUndefined();
  });
});
