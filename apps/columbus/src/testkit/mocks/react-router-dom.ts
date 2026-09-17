import { jest } from '@jest/globals';
import { faker } from '@faker-js/faker';
import type {
  Location,
  Navigate as NavigateType,
  NavigateOptions,
  To,
  useLocation as useLocationType,
} from 'react-router-dom';

const reactRouterDom = await import('react-router-dom');

export const useLocationMock: jest.Mock<typeof useLocationType> = jest.fn();
export const useNavigateMock: jest.Mock<
  () => (to: To, options?: NavigateOptions) => void
> = jest.fn();
export const NavigateMock: jest.Mock<typeof NavigateType> = jest.fn(() => null);

export const aLocation = (overrides: Partial<Location> = {}): Location => ({
  pathname: `/${faker.lorem.slug()}`,
  search: '',
  hash: '',
  state: null,
  key: faker.string.alphanumeric(8),
  ...overrides,
});

jest.unstable_mockModule('react-router-dom', () => ({
  ...reactRouterDom,
  useLocation: useLocationMock,
  useNavigate: useNavigateMock,
  Navigate: NavigateMock,
}));
