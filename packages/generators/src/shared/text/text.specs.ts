import { faker } from '@faker-js/faker';
import { TextDriver } from './text.driver.js';

describe('title', () => {
  let driver: TextDriver;

  beforeEach(() => {
    driver = new TextDriver();
  });

  it.each([
    'orders-app',
    'orders_app',
    'orders app',
    'orders--app',
    ' orders  app ',
  ])(
    'should capitalize each word joined by a space when value is "%s"',
    (value) => {
      driver.when.titled(value);

      expect(driver.get.result()).toBe('Orders App');
    },
  );

  it('should keep the rest of each word when value has mixed case', () => {
    driver.when.titled('myOrders-appV2');

    expect(driver.get.result()).toBe('MyOrders AppV2');
  });
});

describe('pascal', () => {
  let driver: TextDriver;

  beforeEach(() => {
    driver = new TextDriver();
  });

  it('should join capitalized words without spaces when value is hyphenated', () => {
    driver.when.pascalCased('orders-app');

    expect(driver.get.result()).toBe('OrdersApp');
  });

  it('should capitalize when value is one word', () => {
    driver.when.pascalCased('orders');

    expect(driver.get.result()).toBe('Orders');
  });
});

describe('json', () => {
  let driver: TextDriver;

  beforeEach(() => {
    driver = new TextDriver();
  });

  it('should serialize with two-space indentation and a trailing newline when value is an object', () => {
    const name = faker.lorem.word();
    driver.when.serialized({ name, nested: { count: 1 } });

    expect(driver.get.result()).toBe(
      `{\n  "name": "${name}",\n  "nested": {\n    "count": 1\n  }\n}\n`,
    );
  });
});
