import { faker } from '@faker-js/faker';
import { HostDataDriver } from './host-data.driver.js';
import { updateAtlasHostData } from './host-data.js';

interface ProjectHostData {
  readonly hostId: string;
  readonly name: string;
  readonly userId: string | null;
}

type ReadProjectHostData = () => ProjectHostData;

interface ProjectHostSdk {
  hostData: ProjectHostData;
}

interface ProjectHostSdkFacade {
  hostData: ReadProjectHostData;
}

describe('updateAtlasHostData', () => {
  let driver: HostDataDriver;

  beforeEach(() => {
    driver = new HostDataDriver();
  });

  it('should replace only the given fields when host data is updated', () => {
    const projectId = faker.string.uuid();
    const userId = faker.string.uuid();
    driver.given.hostData({ projectId, userId: null });

    driver.when.hostDataUpdated({ userId });

    expect(driver.get.hostData()).toMatchObject({ projectId, userId });
  });

  it('should throw ATLAS_HOST_DATA_NOT_WRITABLE when the sdk host data is not writable', () => {
    const sdk = Object.freeze({
      hostData: {
        hostId: faker.string.uuid(),
        name: faker.company.name(),
        userId: faker.string.uuid(),
      },
    });

    expect(() =>
      updateAtlasHostData(sdk, { userId: faker.string.uuid() }),
    ).toThrow(
      expect.objectContaining({ code: 'ATLAS_HOST_DATA_NOT_WRITABLE' }),
    );
  });

  it('should throw ATLAS_HOST_DATA_NOT_WRITABLE when the only host data is a function', () => {
    const hostData = {
      hostId: faker.string.uuid(),
      name: faker.company.name(),
      userId: faker.string.uuid(),
    };
    const sdk = { hostData: () => hostData };

    expect(() =>
      updateAtlasHostData(sdk, { userId: faker.string.uuid() }),
    ).toThrow(
      expect.objectContaining({ code: 'ATLAS_HOST_DATA_NOT_WRITABLE' }),
    );
  });

  describe('when a facade over the sdk holds host data as a function', () => {
    const hostId = faker.string.uuid();
    const name = faker.company.name();
    const userId = faker.string.uuid();
    const readHostData: ReadProjectHostData = () => ({
      hostId,
      name,
      userId: null,
    });
    let sdk: ProjectHostSdk;
    let facade: ProjectHostSdkFacade;

    beforeEach(() => {
      sdk = { hostData: { hostId, name, userId: null } };
      facade = Object.assign(Object.create(sdk), { hostData: readHostData });

      updateAtlasHostData(facade, { userId });
    });

    it('should write the updates to the sdk host data when updated through the facade', () => {
      expect(sdk.hostData).toStrictEqual({ hostId, name, userId });
    });

    it('should keep the facade host data function when updated through the facade', () => {
      expect(facade.hostData).toBe(readHostData);
    });
  });

  describe('when a listener is subscribed', () => {
    beforeEach(() => {
      driver.given.hostData({ projectId: faker.string.uuid(), userId: null });

      driver.when.subscribed();
    });

    it('should call the listener when host data is updated', () => {
      driver.when.hostDataUpdated({ userId: faker.string.uuid() });

      expect(driver.get.listenerMock()).toHaveBeenCalledTimes(1);
    });

    it('should not call the listener when host data is updated after unsubscribing', () => {
      driver.when.unsubscribed();
      driver.when.hostDataUpdated({ userId: faker.string.uuid() });

      expect(driver.get.listenerMock()).not.toHaveBeenCalled();
    });
  });
});
