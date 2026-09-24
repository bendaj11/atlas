import { aReactVersionProfile } from '../../testkit/version-profiles.testkit.js';
import { ReactHostGeneratorDriver } from './react-host-generator.driver.js';

describe('renderReactHostBootstrap', () => {
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

    it('should import createRoot from the react dom client when generated', () => {
      expect(driver.get.contents()).toContain(
        'import { createRoot } from "react-dom/client";',
      );
    });

    it('should pass createRoot as the react dom renderer when generated', () => {
      expect(driver.get.contents()).toContain('  reactDom: { createRoot },');
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

    it('should pass legacy render and unmount as the react dom renderer when generated', () => {
      expect(driver.get.contents()).toContain(
        '  reactDom: { render, unmountComponentAtNode },',
      );
    });
  });

  describe('when generated', () => {
    beforeEach(() => {
      driver.when.bootstrapGenerated();
    });

    it('should export mount defined from the atlas config and host layout when generated', () => {
      expect(driver.get.contents())
        .toContain(`export const mount = defineReactHost<CustomerHostSdk>({
  config: atlasConfig,
  layout: HostLayout,`);
    });

    it('should pass the host providers and custom sdk options hook when generated', () => {
      expect(driver.get.contents()).toContain(`  providers: HostProviders,
  useSdkOptions: useCustomHostSdkOptions
});`);
    });
  });
});

describe('renderReactHostLayout', () => {
  let driver: ReactHostGeneratorDriver;

  beforeEach(() => {
    driver = new ReactHostGeneratorDriver();
  });

  it('should render the atlas host layout with status, header slot, navigation and route outlet when generated', () => {
    driver.when.layoutGenerated();

    expect(driver.get.contents())
      .toContain(`    <AtlasHostLayout layoutId="default">
      <AtlasHostStatus />
      <header>
        <strong>Atlas</strong>
        <AtlasSlot slotId="header" />
      </header>
      <AtlasNavigation aria-label="Application" />
      <AtlasRouteOutlet />
    </AtlasHostLayout>`);
  });
});

describe('renderReactHostSdkConfig', () => {
  let driver: ReactHostGeneratorDriver;

  beforeEach(() => {
    driver = new ReactHostGeneratorDriver();
  });

  it('should export host providers wrapping children in strict mode when generated', () => {
    driver.when.sdkConfigGenerated();

    expect(driver.get.contents())
      .toContain(`export function HostProviders({ children }: { children?: ReactNode }) {
  return <StrictMode>{children}</StrictMode>;
}`);
  });

  it('should export an empty custom host sdk options hook when generated', () => {
    driver.when.sdkConfigGenerated();

    expect(driver.get.contents())
      .toContain(`export function useCustomHostSdkOptions(): HostSdkOptions<CustomerHostSdk> {
  return {};
}`);
  });
});

describe('renderReactHostMain', () => {
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
