import { aColumbusState } from '../../types/columbus-state.testkit';
import { HostDriver } from './useHost.driver';

describe('useHost', () => {
  let driver: HostDriver;

  beforeEach(() => {
    driver = new HostDriver();
  });

  it('should expose the columbusState host data when a columbusState exists', () => {
    const columbusState = aColumbusState();

    driver.given.columbusState(columbusState).when.rendered();

    expect(driver.get.hostData()).toBe(columbusState.hostData);
  });

  it('should expose no host data when columbusState is missing', () => {
    driver.given.columbusState(undefined).when.rendered();

    expect(driver.get.hostData()).toBeUndefined();
  });

  it('should derive status from the query state when rendered', () => {
    driver.given.error(new Error('Boom')).given.fetching(true).when.rendered();

    expect(driver.get.hostStatusRequest()).toEqual({
      isError: true,
      isFetching: true,
    });
  });

  it('should expose the derived status when rendered', () => {
    driver.given.hostStatus('ERROR').when.rendered();

    expect(driver.get.status()).toBe('ERROR');
  });

  it('should expose the error message when the query failed', () => {
    driver.given.error(new Error('No Atlas tab.')).when.rendered();

    expect(driver.get.message()).toBe('No Atlas tab.');
  });

  it('should expose an empty message when the query succeeded', () => {
    driver.given.error(undefined).when.rendered();

    expect(driver.get.message()).toBe('');
  });

  it('should refetch the columbusState when host is loaded', async () => {
    driver.when.rendered();

    await driver.when.hostLoaded();

    expect(driver.get.refetchCount()).toBe(1);
  });
});
