import { faker } from '@faker-js/faker';
import { aHostConfig, anAppConfig } from './project-config.js';

describe('anAppConfig', () => {
  it('should build an app config when built with defaults', () => {
    expect(anAppConfig().type).toBe('app');
  });

  it('should apply the overrides when overrides are given', () => {
    const name = faker.commerce.productName();

    expect(anAppConfig({ name }).name).toBe(name);
  });
});

describe('aHostConfig', () => {
  it('should build a host config when built with defaults', () => {
    expect(aHostConfig().type).toBe('host');
  });

  it('should apply the overrides when overrides are given', () => {
    const name = faker.commerce.productName();

    expect(aHostConfig({ name }).name).toBe(name);
  });
});
