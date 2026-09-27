/** @jest-environment jsdom */
import { aHostRuntimeConfig } from '@atlas/testkit';
import { preconnectArtifactRegistry } from './artifact-registry-preconnect.js';

const PAGE_URL = 'https://host.example/orders';

function preconnectLinks(): { href: string; crossOrigin: string | null }[] {
  return Array.from(
    document.head.querySelectorAll('link[rel="preconnect"]'),
    (link) => ({
      href: link.getAttribute('href') ?? '',
      crossOrigin: link.getAttribute('crossorigin'),
    }),
  );
}

describe('preconnectArtifactRegistry', () => {
  beforeEach(() => {
    document.head.replaceChildren();
  });

  it('should preconnect anonymously to a separate artifact registry origin', () => {
    preconnectArtifactRegistry({
      document,
      pageUrl: PAGE_URL,
      runtime: aHostRuntimeConfig({
        artifactRegistryUrl: 'https://assets.example/atlas',
        environmentRegistryUrl: 'https://deployments.example/atlas',
      }),
    });

    expect(preconnectLinks()).toStrictEqual([
      { href: 'https://assets.example', crossOrigin: 'anonymous' },
    ]);
  });

  it('should not preconnect when artifacts share the environment registry origin', () => {
    preconnectArtifactRegistry({
      document,
      pageUrl: PAGE_URL,
      runtime: aHostRuntimeConfig({
        artifactRegistryUrl: 'https://registry.example/artifacts',
        environmentRegistryUrl: 'https://registry.example/environments',
      }),
    });

    expect(preconnectLinks()).toStrictEqual([]);
  });

  it('should not preconnect when artifacts are served from the page origin', () => {
    preconnectArtifactRegistry({
      document,
      pageUrl: PAGE_URL,
      runtime: aHostRuntimeConfig({
        artifactRegistryUrl: 'https://host.example/atlas',
        environmentRegistryUrl: 'https://deployments.example/atlas',
      }),
    });

    expect(preconnectLinks()).toStrictEqual([]);
  });
});
