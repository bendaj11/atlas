import { aReactVersionProfile } from '../../testkit/version-profiles.testkit.js';
import { ReactHostGeneratorDriver } from './react-host-generator.driver.js';

describe('reactHostBootstrap', () => {
  let driver: ReactHostGeneratorDriver;

  beforeEach(() => {
    driver = new ReactHostGeneratorDriver();
  });

  describe('when major is 18 or above', () => {
    beforeEach(() => {
      driver.given
        .profile(aReactVersionProfile({ major: 18 }))
        .when.bootstrapGenerated();
    });

    it('should import flushSync and createRoot when generated', () => {
      expect(driver.get.contents()).toContain(
        'import { flushSync } from "react-dom";\nimport { createRoot } from "react-dom/client";',
      );
    });

    it('should render through a flushed root and unmount it when generated', () => {
      expect(driver.get.contents()).toContain(
        '  const root = createRoot(container);\n  flushSync(() => root.render(element));\n  return { unmount: () => root.unmount() };',
      );
    });
  });

  describe('when major is 17 or below', () => {
    beforeEach(() => {
      driver.given
        .profile(aReactVersionProfile({ major: 17 }))
        .when.bootstrapGenerated();
    });

    it('should import legacy render and unmount when generated', () => {
      expect(driver.get.contents()).toContain(
        'import { render, unmountComponentAtNode } from "react-dom";',
      );
    });

    it('should render through legacy render and unmount the container when generated', () => {
      expect(driver.get.contents()).toContain(
        '  render(element, container);\n  return { unmount: () => unmountComponentAtNode(container) };',
      );
    });
  });

  describe('when generated', () => {
    beforeEach(() => {
      driver.when.bootstrapGenerated();
    });

    it('should export mount bound to the host mount function when generated', () => {
      expect(driver.get.contents()).toContain(
        'export const mount: AtlasHostClientEntry["mount"] = mountHost;',
      );
    });

    it('should merge custom host sdk options into the provider options when generated', () => {
      expect(driver.get.contents())
        .toContain(`          hostData: { hostId: atlasConfig.id, name: atlasConfig.name, ...hostData },
          ...sdkOptions,
          runtimeConfig: request.runtimeConfig,
          ...(request.catalog ? { catalog: request.catalog } : {})`);
    });
  });
});

describe('reactHostSdkConfig', () => {
  let driver: ReactHostGeneratorDriver;

  beforeEach(() => {
    driver = new ReactHostGeneratorDriver();
  });

  it('should export an empty custom host sdk options hook when generated', () => {
    driver.when.sdkConfigGenerated();

    expect(driver.get.contents())
      .toContain(`export function useCustomHostSdkOptions(): HostSdkOptions<CustomerHostSdk> {
  return {};
}`);
  });
});

describe('reactHostMain', () => {
  let driver: ReactHostGeneratorDriver;

  beforeEach(() => {
    driver = new ReactHostGeneratorDriver();
  });

  it('should write the atlas dev placeholder into the root element when generated', () => {
    driver.when.mainGenerated();

    expect(driver.get.contents())
      .toBe(`const root = document.getElementById("root");
if (!root) throw new Error("React root is missing.");

root.textContent = "Start this Atlas host with atlas dev.";
`);
  });
});
