import { faker } from '@faker-js/faker';

declare module '@faker-js/faker' {
  interface Faker {
    custom: {
      channel(): 'production' | 'pr' | 'local';
      publishedChannel(): 'production' | 'pr';
      framework(): 'angular' | 'react' | 'vue';
      schemaVersion(): '1';
    };
  }
}

faker.custom = {
  channel: () =>
    faker.helpers.arrayElement(['production', 'pr', 'local'] as const),
  publishedChannel: () =>
    faker.helpers.arrayElement(['production', 'pr'] as const),
  framework: () =>
    faker.helpers.arrayElement(['angular', 'react', 'vue'] as const),
  schemaVersion: () => faker.helpers.arrayElement(['1'] as const),
};

export { faker };
