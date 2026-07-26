import { describe, expect, it } from '@jest/globals';
import {
  actionIconPathsFor,
  actionThemeMessage,
  isActionThemeMessage,
} from './action-icon-theme.js';

describe('action icon theme', () => {
  it('uses bright icon paths for dark mode', () => {
    expect(actionIconPathsFor('dark')).toStrictEqual({
      16: 'icons/columbus-bright-16.png',
      32: 'icons/columbus-bright-32.png',
    });
  });

  it('uses dark icon paths for light mode', () => {
    expect(actionIconPathsFor('light')).toStrictEqual({
      16: 'icons/columbus-dark-16.png',
      32: 'icons/columbus-dark-32.png',
    });
  });

  it('creates a valid action theme message', () => {
    expect(isActionThemeMessage(actionThemeMessage('dark'))).toBe(true);
  });

  it('rejects an unsupported color scheme', () => {
    expect(
      isActionThemeMessage({
        type: 'columbus.action-theme',
        colorScheme: 'sepia',
      }),
    ).toBe(false);
  });

  it('rejects unrelated extension messages', () => {
    expect(
      isActionThemeMessage({
        type: 'atlas.override-count',
        overrideCount: 1,
      }),
    ).toBe(false);
  });
});
