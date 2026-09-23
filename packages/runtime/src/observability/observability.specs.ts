import { jest } from '@jest/globals';
import { emitRuntimeEvent } from './observability.js';
import type {
  AtlasRuntimeEvent,
  AtlasRuntimeObserver,
} from './observability.types.js';

const EVENT: AtlasRuntimeEvent = {
  type: 'host.start',
  timestamp: new Date().toISOString(),
};

describe('emitRuntimeEvent', () => {
  it('should pass the event to the observer when an observer is given', () => {
    const observer = jest.fn<AtlasRuntimeObserver>();

    emitRuntimeEvent(observer, EVENT);

    expect(observer).toHaveBeenCalledWith(EVENT);
  });

  it('should not throw when the observer throws', () => {
    const observer = () => {
      throw new Error('monitor unavailable');
    };

    expect(() => emitRuntimeEvent(observer, EVENT)).not.toThrow();
  });

  it('should not throw when no observer is given', () => {
    expect(() => emitRuntimeEvent(undefined, EVENT)).not.toThrow();
  });
});
