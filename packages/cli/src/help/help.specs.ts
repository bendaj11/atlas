import { HelpDriver } from './help.driver.js';

describe('help', () => {
  let driver: HelpDriver;

  beforeEach(() => {
    driver = new HelpDriver();
  });

  describe('requestedHelpTopic', () => {
    it('should return the root topic when no arguments are given', () => {
      driver.given.values([]);

      expect(driver.get.topic()).toStrictEqual([]);
    });

    it('should return undefined when no help flag is present', () => {
      driver.given.values(['publish', 'orders']);

      expect(driver.get.topic()).toBeUndefined();
    });

    it.each(['--help', '-h'])(
      'should return the command topic when %s follows a command',
      (flag) => {
        driver.given.values(['publish', flag]);

        expect(driver.get.topic()).toStrictEqual(['publish']);
      },
    );

    it('should resolve the alias when help is requested for g', () => {
      driver.given.values(['help', 'g']);

      expect(driver.get.topic()).toStrictEqual(['generate']);
    });

    it('should keep the generator type when help is requested for generate widget', () => {
      driver.given.values(['generate', 'widget', '--help']);

      expect(driver.get.topic()).toStrictEqual(['generate', 'widget']);
    });

    it('should drop a non-generator subcommand when help is requested for a command', () => {
      driver.given.values(['publish', 'orders', '--help']);

      expect(driver.get.topic()).toStrictEqual(['publish']);
    });
  });

  describe('formatHelp', () => {
    it('should list every command when the root topic is requested', () => {
      expect(driver.get.help([])).toMatch(
        /Usage:\n\s+atlas <command> \[options\]/,
      );
    });

    it('should describe usage and options when a command topic is requested', () => {
      expect(driver.get.help(['publish'])).toMatch(/atlas publish/);
    });

    it('should throw when the topic is unknown', () => {
      expect(() => driver.get.help(['frobnicate'])).toThrow(
        'Unknown help topic "frobnicate". Run atlas --help to list commands.',
      );
    });
  });
});
