import type {
  AtlasPublicationLease,
  AtlasPublicationStorage,
} from '../publication-storage/types.js';

export async function withPublicationLease<T>(
  storage: AtlasPublicationStorage,
  operation: (lease: AtlasPublicationLease) => Promise<T>,
): Promise<T> {
  const lease = await storage.acquireLock(`atlas:${process.pid}:${Date.now()}`);

  try {
    return await operation(lease);
  } finally {
    await lease.release();
  }
}

export async function verifyDeliveryWhileHeld(options: {
  storage: AtlasPublicationStorage;
  lease: AtlasPublicationLease;
  paths: readonly string[];
}): Promise<void> {
  const { storage, lease, paths } = options;
  if (!storage.verifyDelivery) return;
  await lease.assertHeld();
  await storage.verifyDelivery(paths);
  await lease.assertHeld();
}
