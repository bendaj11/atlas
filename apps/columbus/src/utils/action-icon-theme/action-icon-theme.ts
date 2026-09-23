import type { ColorScheme } from '../messages/messages';

const ACTION_ICON_PATHS: Record<
  ColorScheme,
  Readonly<Record<string, string>>
> = {
  dark: {
    16: 'icons/columbus-bright-16.png',
    32: 'icons/columbus-bright-32.png',
  },
  light: {
    16: 'icons/columbus-dark-16.png',
    32: 'icons/columbus-dark-32.png',
  },
};

export function actionIconPathsFor(
  colorScheme: ColorScheme,
): Readonly<Record<string, string>> {
  return ACTION_ICON_PATHS[colorScheme];
}
