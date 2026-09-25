import {
  ATLAS_PREVIEW_LAUNCHER_MARKER,
  ATLAS_PREVIEW_LAUNCHER_PATH,
} from '@atlas/schema';

export function previewLauncherUrl({
  controlOrigin,
  previewUrl,
}: {
  controlOrigin: string;
  previewUrl: string;
}): string {
  const url = new URL(ATLAS_PREVIEW_LAUNCHER_PATH, controlOrigin);
  url.searchParams.set('previewUrl', previewUrl);

  return url.href;
}

export function previewLauncherPage(previewUrl: string): string {
  const target = JSON.stringify(previewUrl).replaceAll('<', '\\u003c');
  const marker = JSON.stringify(ATLAS_PREVIEW_LAUNCHER_MARKER);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Opening Atlas preview</title>
  </head>
  <body>
    <script>
      document.addEventListener('DOMContentLoaded', () => {
        if (!document.documentElement.hasAttribute(${marker}))
          location.replace(${target});
      });
    </script>
  </body>
</html>
`;
}
