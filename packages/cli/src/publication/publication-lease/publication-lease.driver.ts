import { jest } from '@jest/globals';
import type {
  AtlasPublicationLease,
  AtlasPublicationStorage,
} from '../publication-storage/publication-storage.js';
import {
  verifyDeliveryWhileHeld,
  withPublicationLease,
} from './publication-lease.js';

export class PublicationLeaseDriver {
  private readonly lease: AtlasPublicationLease = {
    assertHeld: jest.fn<AtlasPublicationLease['assertHeld']>(),
    release: jest.fn<AtlasPublicationLease['release']>(),
  };
  private readonly acquireLock = jest
    .fn<AtlasPublicationStorage['acquireLock']>()
    .mockResolvedValue(this.lease);
  private verifyDelivery?: jest.Mock<
    NonNullable<AtlasPublicationStorage['verifyDelivery']>
  >;
  private readonly events: string[] = [];

  readonly given = {
    verifyDelivery: (enabled: boolean): this => {
      this.verifyDelivery = enabled
        ? jest
            .fn<NonNullable<AtlasPublicationStorage['verifyDelivery']>>()
            .mockImplementation(async () => {
              this.events.push('verify');
            })
        : undefined;
      (this.lease.assertHeld as jest.Mock).mockImplementation(async () => {
        this.events.push('assertHeld');
      });

      return this;
    },
  };

  readonly when = {
    operationRun: async <T>(operation: () => Promise<T>): Promise<T> =>
      withPublicationLease(this.storage(), operation),
    deliveryVerified: (paths: readonly string[]): Promise<void> =>
      verifyDeliveryWhileHeld({
        storage: this.storage(),
        lease: this.lease,
        paths,
      }),
  };

  readonly get = {
    acquireLockMock: () => this.acquireLock,
    releaseMock: () => this.lease.release as jest.Mock,
    verifyDeliveryMock: () => this.verifyDelivery,
    events: (): readonly string[] => this.events,
  };

  private storage(): AtlasPublicationStorage {
    return {
      acquireLock: this.acquireLock,
      ...(this.verifyDelivery ? { verifyDelivery: this.verifyDelivery } : {}),
    } as unknown as AtlasPublicationStorage;
  }
}
