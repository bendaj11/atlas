import { jest } from '@jest/globals';
import type {
  GoBack,
  GoThroughHistory,
} from '../navigation-types/navigation-types.js';
import { goThroughHistory } from './go-through-history.js';

export class GoThroughHistoryDriver {
  private readonly back = jest.fn<GoBack>();
  private readonly go = jest.fn<GoThroughHistory>();

  readonly when = {
    historyMovedWithGo: (delta: number) => {
      goThroughHistory({ back: this.back, go: this.go }, delta);
    },
    historyMovedWithoutGo: (delta: number) => {
      goThroughHistory({ back: this.back }, delta);
    },
  };

  readonly get = {
    backMock: () => this.back,
    goMock: () => this.go,
  };
}
