import { jest } from '@jest/globals';
import type { AtlasNavigation } from '../navigation-types/navigation-types.js';
import { goThroughHistory } from './go-through-history.js';

export class GoThroughHistoryDriver {
  private readonly back = jest.fn<AtlasNavigation['back']>();
  private readonly go = jest.fn<NonNullable<AtlasNavigation['go']>>();

  readonly when = {
    historyMovedWithGo: (delta: number): void => {
      goThroughHistory({ back: this.back, go: this.go }, delta);
    },
    historyMovedWithoutGo: (delta: number): void => {
      goThroughHistory({ back: this.back }, delta);
    },
  };

  readonly get = {
    backMock: (): jest.Mock<AtlasNavigation['back']> => this.back,
    goMock: (): jest.Mock<NonNullable<AtlasNavigation['go']>> => this.go,
  };
}
