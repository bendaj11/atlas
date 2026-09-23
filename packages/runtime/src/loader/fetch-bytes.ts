import { AtlasResourceHttpError } from './loader.errors.js';

export type FetchBytes = (
  url: string,
  signal?: AbortSignal,
) => Promise<ArrayBuffer>;

export async function fetchBytesFromNetwork(
  url: string,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  const response = await fetch(url, signal ? { signal } : undefined);

  if (!response.ok) {
    throw new AtlasResourceHttpError({
      url,
      status: response.status,
      statusText: response.statusText,
    });
  }

  return response.arrayBuffer();
}
