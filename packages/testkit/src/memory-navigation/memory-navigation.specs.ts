import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import { createMemoryNavigation } from './memory-navigation.js';

describe('createMemoryNavigation', () => {
  it('should split the initial path into location parts when a full url is given', () => {
    const pathname = `/${faker.lorem.slug()}`;
    const search = `?${faker.lorem.word()}=${faker.lorem.word()}`;
    const hash = `#${faker.lorem.word()}`;

    const navigation = createMemoryNavigation(`${pathname}${search}${hash}`);

    expect(navigation.getCurrentLocation()).toEqual({ pathname, search, hash });
  });

  it('should start at the root when no initial path is given', () => {
    expect(createMemoryNavigation().getCurrentLocation().pathname).toBe('/');
  });

  it('should move to the path when navigated', () => {
    const pathname = `/${faker.lorem.slug()}`;
    const navigation = createMemoryNavigation();

    navigation.navigate(pathname);

    expect(navigation.getCurrentLocation().pathname).toBe(pathname);
  });

  it('should move to the path when replaced', () => {
    const pathname = `/${faker.lorem.slug()}`;
    const navigation = createMemoryNavigation();

    navigation.replace(pathname);

    expect(navigation.getCurrentLocation().pathname).toBe(pathname);
  });

  it('should notify a subscriber with the current location when it subscribes', () => {
    const pathname = `/${faker.lorem.slug()}`;
    const listener = jest.fn();
    const navigation = createMemoryNavigation(pathname);

    navigation.subscribe(listener);

    expect(listener).toHaveBeenCalledWith({ pathname, search: '', hash: '' });
  });

  it('should notify subscribers with the new location when navigated', () => {
    const pathname = `/${faker.lorem.slug()}`;
    const listener = jest.fn();
    const navigation = createMemoryNavigation();
    navigation.subscribe(listener);

    navigation.navigate(pathname);

    expect(listener).toHaveBeenLastCalledWith({
      pathname,
      search: '',
      hash: '',
    });
  });

  it('should stop notifying a subscriber when it unsubscribes', () => {
    const listener = jest.fn();
    const navigation = createMemoryNavigation();
    const unsubscribe = navigation.subscribe(listener);
    unsubscribe();

    navigation.navigate(`/${faker.lorem.slug()}`);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('should return the path unchanged when a href is created', () => {
    const path = `/${faker.lorem.slug()}`;

    expect(createMemoryNavigation().createHref(path)).toBe(path);
  });
});
