import { jest } from '@jest/globals';
import { fileURLToPath } from 'node:url';
import type {
  findAtlasHostTab as findAtlasHostTabType,
  loadArtifactVersionFromHostTab as loadArtifactVersionFromHostTabType,
  reloadHostTab as reloadHostTabType,
} from '../../utils/host-tabs/host-tabs';

export const findAtlasHostTabMock: jest.Mock<typeof findAtlasHostTabType> =
  jest.fn();
export const loadArtifactVersionFromHostTabMock: jest.Mock<
  typeof loadArtifactVersionFromHostTabType
> = jest.fn();
export const reloadHostTabMock: jest.Mock<typeof reloadHostTabType> = jest.fn();

jest.unstable_mockModule(
  fileURLToPath(
    new URL('../../utils/host-tabs/host-tabs', import.meta.url),
  ),
  () => ({
    findAtlasHostTab: findAtlasHostTabMock,
    loadArtifactVersionFromHostTab: loadArtifactVersionFromHostTabMock,
    reloadHostTab: reloadHostTabMock,
  }),
);
