import { faker } from '@faker-js/faker';
import { aRegistryArtifact, aStaticRegistry } from './registry.js';

describe('aRegistryArtifact', () => {
  it('should hold no releases when built with defaults', () => {
    expect(aRegistryArtifact().releases).toEqual({});
  });

  it('should apply the overrides when overrides are given', () => {
    const packageName = faker.lorem.slug();

    expect(aRegistryArtifact({ packageName }).packageName).toBe(packageName);
  });
});

describe('aStaticRegistry', () => {
  it('should hold no apps when built with defaults', () => {
    expect(aStaticRegistry().apps).toEqual({});
  });

  it('should apply the overrides when overrides are given', () => {
    const updatedAt = faker.date.recent().toISOString();

    expect(aStaticRegistry({ updatedAt }).updatedAt).toBe(updatedAt);
  });
});
