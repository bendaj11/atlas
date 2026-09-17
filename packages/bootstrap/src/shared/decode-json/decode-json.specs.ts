import { faker } from '@faker-js/faker';
import { decodeJson } from './decode-json.js';

describe('decodeJson', () => {
  it('should return the parsed value when the bytes hold UTF-8 JSON', () => {
    const value = { name: faker.person.fullName(), count: faker.number.int() };

    expect(decodeJson(new TextEncoder().encode(JSON.stringify(value)))).toEqual(
      value,
    );
  });
});
