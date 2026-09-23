import { actionIconPathsFor } from './action-icon-theme';

describe('actionIconPathsFor', () => {
  it('should use bright icons when the color scheme is dark', () => {
    expect(actionIconPathsFor('dark')).toStrictEqual({
      16: 'icons/columbus-bright-16.png',
      32: 'icons/columbus-bright-32.png',
    });
  });

  it('should use dark icons when the color scheme is light', () => {
    expect(actionIconPathsFor('light')).toStrictEqual({
      16: 'icons/columbus-dark-16.png',
      32: 'icons/columbus-dark-32.png',
    });
  });
});
