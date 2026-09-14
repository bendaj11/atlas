import { AtlasBootstrapSignatureDriver } from './atlas-bootstrap-signature.driver';

const HOST_ROOT = '<div id="atlas-host-root"></div>';
const LOADER_SCRIPT =
  '<script type="module" src="/atlas.loader.js?v=build"></script>';

describe('hasAtlasBootstrapSignature', () => {
  let driver: AtlasBootstrapSignatureDriver;

  beforeEach(() => {
    driver = new AtlasBootstrapSignatureDriver();
  });

  it('should detect the signature when the host root and loader script exist', () => {
    driver.given.pageBody(HOST_ROOT + LOADER_SCRIPT).when.signatureChecked();

    expect(driver.get.hasSignature()).toBe(true);
  });

  it('should miss the signature when the host root is absent', () => {
    driver.given.pageBody(LOADER_SCRIPT).when.signatureChecked();

    expect(driver.get.hasSignature()).toBe(false);
  });

  it('should miss the signature when the loader script is absent', () => {
    driver.given.pageBody(HOST_ROOT).when.signatureChecked();

    expect(driver.get.hasSignature()).toBe(false);
  });

  it('should miss the signature when the script is not the Atlas loader', () => {
    driver.given
      .pageBody(HOST_ROOT + '<script src="/other.js"></script>')
      .when.signatureChecked();

    expect(driver.get.hasSignature()).toBe(false);
  });
});
