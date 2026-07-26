export type ColorScheme = 'dark' | 'light';

export interface ActionThemeMessage {
  type: 'columbus.action-theme';
  colorScheme: ColorScheme;
}

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

export function actionThemeMessage(
  colorScheme: ColorScheme,
): ActionThemeMessage {
  return {
    type: 'columbus.action-theme',
    colorScheme,
  };
}

export function isActionThemeMessage(
  message: unknown,
): message is ActionThemeMessage {
  if (typeof message !== 'object' || message === null) return false;

  const value = message as Partial<ActionThemeMessage>;
  return (
    value.type === 'columbus.action-theme' &&
    (value.colorScheme === 'dark' || value.colorScheme === 'light')
  );
}
