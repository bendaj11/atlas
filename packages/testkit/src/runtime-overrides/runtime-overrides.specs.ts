import { faker } from '@faker-js/faker';
import { anOverrideDocument } from './runtime-overrides.js';

describe('anOverrideDocument', () => {
  it('should hold no overrides when built with defaults', () => {
    expect(anOverrideDocument().overrides).toEqual([]);
  });

  it('should apply the overrides when overrides are given', () => {
    const hostId = faker.string.uuid();

    expect(anOverrideDocument({ hostId }).hostId).toBe(hostId);
  });
});
