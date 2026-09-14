import { aSession } from '../../../types/app.testkit';
import { SessionContextDriver } from './SessionContext.driver';

describe('SessionProvider', () => {
  let driver: SessionContextDriver;

  beforeEach(() => {
    driver = new SessionContextDriver();
  });

  it('should have no session when rendered', () => {
    driver.when.rendered();

    expect(driver.get.session()).toBeUndefined();
  });

  it('should expose the session when one is set', () => {
    const session = aSession();

    driver.when.rendered().when.sessionSet(session);

    expect(driver.get.session()).toBe(session);
  });

  it('should throw when useSession is used outside the provider', () => {
    driver.when.renderedWithoutProvider();

    expect(driver.get.renderError()).toEqual(
      new Error('useSession must be used within SessionProvider.'),
    );
  });
});
