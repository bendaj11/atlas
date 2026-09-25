import { faker } from '@faker-js/faker';
import { previewLauncherPage, previewLauncherUrl } from './preview-launcher.js';

describe('previewLauncherUrl', () => {
  it('should address the launcher path of the control origin with the preview when built', () => {
    const previewUrl = faker.internet.url();

    expect(
      previewLauncherUrl({ controlOrigin: 'http://localhost:4400', previewUrl }),
    ).toBe(
      `http://localhost:4400/atlas.open?previewUrl=${encodeURIComponent(previewUrl)}`,
    );
  });
});

describe('previewLauncherPage', () => {
  it('should redirect to the preview url when rendered', () => {
    const previewUrl = faker.internet.url();

    expect(previewLauncherPage(previewUrl)).toContain(
      `location.replace(${JSON.stringify(previewUrl)})`,
    );
  });

  it('should escape markup in the preview url when rendered', () => {
    expect(
      previewLauncherPage(`${faker.internet.url()}?q=</script>`),
    ).not.toContain('</script>"');
  });

  it('should skip the redirect when the page carries the launcher marker', () => {
    expect(previewLauncherPage(faker.internet.url())).toContain(
      `hasAttribute("data-atlas-preview-launcher")`,
    );
  });
});
