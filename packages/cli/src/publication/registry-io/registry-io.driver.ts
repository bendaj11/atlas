import { jest } from '@jest/globals';
import type { AtlasStaticRegistry } from '@atlas/schema';
import type { AtlasPublicationLease } from '../publication-storage/types.js';
import { InMemoryPublicationStorage } from '../publication-storage/publication-storage.testkit.js';
import type { AtlasRegistryConfig } from '../registry-config/types.js';
import {
  assertExpectedRegistryRevision,
  resolvePublicRegistryRoot,
  readRegistry,
  readRegistryState,
  verifyPublicRegistry,
  writeRegistry,
} from './registry-io.js';
import { CliArguments } from '../../shared/index.js';

export class RegistryIoDriver {
  private readonly storage = new InMemoryPublicationStorage();
  private readonly lease: AtlasPublicationLease = {
    assertHeld: jest.fn<AtlasPublicationLease['assertHeld']>(),
    release: jest.fn<AtlasPublicationLease['release']>(),
  };
  private flags: string[] = [];
  private config: AtlasRegistryConfig | undefined;
  private readonly fetchResource = jest.fn<typeof fetch>();
  private readonly verifyRegistry =
    jest.fn<NonNullable<AtlasRegistryConfig['verifyRegistry']>>();
  private inspectDrift = false;

  readonly given = {
    storedRegistry: (registry: AtlasStaticRegistry | string) => {
      this.storage.seed(
        'registry.json',
        typeof registry === 'string' ? registry : JSON.stringify(registry),
      );

      return this;
    },
    registryChangingDuringRead: () => {
      this.inspectDrift = true;

      return this;
    },
    flags: (flags: string[]) => {
      this.flags = flags;

      return this;
    },
    registryVerifier: () => {
      this.config = { verifyRegistry: this.verifyRegistry };

      return this;
    },
    publicResponse: (response: Response) => {
      this.fetchResource.mockResolvedValue(response);

      return this;
    },
  };

  readonly when = {
    written: (registry: AtlasStaticRegistry, versionToken?: string) =>
      writeRegistry({
        storage: this.storage,
        lease: this.lease,
        registry,
        versionToken,
      }),
    publicRegistryVerified: (expected: AtlasStaticRegistry) =>
      verifyPublicRegistry({
        args: this.args(),
        config: this.config,
        expected,
        fetchResource: this.fetchResource,
      }),
  };

  readonly get = {
    verifyRegistryMock: () => this.verifyRegistry,
    registry: () => readRegistry(this.storage),
    state: () => {
      if (!this.inspectDrift) return readRegistryState(this.storage);
      const inspect = this.storage.inspect.bind(this.storage);
      let calls = 0;
      this.storage.inspect = async (path) => {
        calls += 1;

        return calls === 1
          ? {
              cacheControl: 'no-cache',
              contentType: 'application/json',
              versionToken: 'old',
            }
          : inspect(path);
      };

      return readRegistryState(this.storage);
    },
    storedText: () =>
      new TextDecoder().decode(
        this.storage.objects.get('registry.json')!.bytes,
      ),
    storedVersionToken: () =>
      this.storage.objects.get('registry.json')?.metadata.versionToken,
    expectedRevisionAssertion:
      (current: AtlasStaticRegistry | undefined) => () =>
        assertExpectedRegistryRevision(this.args(), current),
    publicRegistryRoot: () => resolvePublicRegistryRoot(this.args()),
    fetchMock: () => this.fetchResource,
  };

  private args(): CliArguments {
    return new CliArguments(['publish', 'x', ...this.flags]);
  }
}
