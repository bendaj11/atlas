import { jest } from '@jest/globals';
import type { AtlasStaticRegistry } from '@atlas/schema';
import { CliArguments } from '../../cli/arguments.js';
import type { AtlasPublicationLease } from '../publication-storage/publication-storage.js';
import { InMemoryPublicationStorage } from '../publication-storage/publication-storage.testkit.js';
import type { AtlasRegistryConfig } from '../registry-config.js';
import {
  assertExpectedRegistryRevision,
  publicRegistryRoot,
  readRegistry,
  readRegistryState,
  verifyPublicRegistry,
  writeRegistry,
  type RegistryState,
} from './registry-io.js';

export class RegistryIoDriver {
  private readonly storage = new InMemoryPublicationStorage();
  private readonly lease: AtlasPublicationLease = {
    assertHeld: jest.fn<AtlasPublicationLease['assertHeld']>(),
    release: jest.fn<AtlasPublicationLease['release']>(),
  };
  private flags: string[] = [];
  private config: AtlasRegistryConfig | undefined;
  private readonly fetchResource = jest.fn<typeof fetch>();
  private inspectDrift = false;

  readonly given = {
    storedRegistry: (registry: AtlasStaticRegistry | string): this => {
      this.storage.seed(
        'registry.json',
        typeof registry === 'string' ? registry : JSON.stringify(registry),
      );

      return this;
    },
    registryChangingDuringRead: (): this => {
      this.inspectDrift = true;

      return this;
    },
    flags: (flags: string[]): this => {
      this.flags = flags;

      return this;
    },
    config: (config: AtlasRegistryConfig | undefined): this => {
      this.config = config;

      return this;
    },
    publicResponse: (response: Response): this => {
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
    registry: () => readRegistry(this.storage),
    state: (): Promise<RegistryState> => {
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
    storedText: (): string =>
      new TextDecoder().decode(
        this.storage.objects.get('registry.json')!.bytes,
      ),
    storedVersionToken: (): string | undefined =>
      this.storage.objects.get('registry.json')?.metadata.versionToken,
    expectedRevisionAssertion:
      (current: AtlasStaticRegistry | undefined) => () =>
        assertExpectedRegistryRevision(this.args(), current),
    publicRegistryRoot: (): string => publicRegistryRoot(this.args()),
    fetchMock: () => this.fetchResource,
  };

  private args(): CliArguments {
    return new CliArguments(['publish', 'x', ...this.flags]);
  }
}
