import { faker } from '@faker-js/faker';
import { ArgumentsDriver } from './arguments.driver.js';

describe('CliArguments', () => {
  let driver: ArgumentsDriver;

  beforeEach(() => {
    driver = new ArgumentsDriver();
  });

  describe('positional accessors', () => {
    it('should expose command, subcommand, and name when three positionals are given', () => {
      driver.given.values(['generate', 'app', 'orders']);

      expect(driver.get.arguments()).toMatchObject({
        command: 'generate',
        subcommand: 'app',
        name: 'orders',
      });
    });
  });

  describe('flag', () => {
    it('should read the value after a spaced flag when given', () => {
      const value = faker.lorem.word();
      driver.given.values(['publish', '--version', value]);

      expect(driver.get.arguments().flag('version')).toBe(value);
    });

    it('should read the value after an equals sign when given', () => {
      const value = faker.lorem.word();
      driver.given.values(['publish', `--version=${value}`]);

      expect(driver.get.arguments().flag('version')).toBe(value);
    });

    it('should return true when the flag is the last argument', () => {
      driver.given.values(['publish', '--dry-run']);

      expect(driver.get.arguments().flag('dry-run')).toBe('true');
    });

    it('should return undefined when the flag is absent', () => {
      driver.given.values(['publish']);

      expect(driver.get.arguments().flag('version')).toBeUndefined();
    });
  });

  describe('routing', () => {
    it('should return false when --no-routing is given', () => {
      driver.given.values(['generate', '--no-routing', '--routing=true']);

      expect(driver.get.arguments().routing()).toBe(false);
    });

    it.each([
      [[], true],
      [['--routing'], true],
      [['--routing=true'], true],
      [['--routing=false'], false],
    ])('should return %p routing when values are %p', (values, expected) => {
      driver.given.values(['generate', ...values]);

      expect(driver.get.arguments().routing()).toBe(expected);
    });

    it('should throw when --routing has another value', () => {
      driver.given.values(['generate', '--routing=maybe']);

      expect(() => driver.get.arguments().routing()).toThrow(
        '--routing must be true or false.',
      );
    });
  });

  describe('stylesheetFormat', () => {
    it.each(['css', 'scss', 'sass', 'less'])(
      'should return %s when --style is %s',
      (format) => {
        driver.given.values(['generate', `--style=${format}`]);

        expect(driver.get.arguments().stylesheetFormat()).toBe(format);
      },
    );

    it('should default to css when --style is absent', () => {
      driver.given.values(['generate']);

      expect(driver.get.arguments().stylesheetFormat()).toBe('css');
    });

    it('should throw when --style is unsupported', () => {
      driver.given.values(['generate', '--style=stylus']);

      expect(() => driver.get.arguments().stylesheetFormat()).toThrow(
        'Unsupported stylesheet format "stylus". Use css, scss, sass, or less.',
      );
    });
  });

  describe('framework', () => {
    it.each(['react', 'angular'])(
      'should return %s when --framework is %s',
      (framework) => {
        driver.given.values(['generate', `--framework=${framework}`]);

        expect(driver.get.arguments().framework()).toBe(framework);
      },
    );

    it('should default to react when --framework is absent', () => {
      driver.given.values(['generate']);

      expect(driver.get.arguments().framework()).toBe('react');
    });

    it('should throw when --framework is unsupported', () => {
      driver.given.values(['generate', '--framework=vue']);

      expect(() => driver.get.arguments().framework()).toThrow(
        'Unsupported framework "vue". Use angular or react.',
      );
    });
  });

  describe('channel', () => {
    it.each(['production', 'pr', 'local'])(
      'should return %s when --channel is %s',
      (channel) => {
        driver.given.values(['build', `--channel=${channel}`]);

        expect(driver.get.arguments().channel('production')).toBe(channel);
      },
    );

    it('should use the fallback when --channel is absent', () => {
      driver.given.values(['build']);

      expect(driver.get.arguments().channel('local')).toBe('local');
    });

    it('should throw when --channel is unsupported', () => {
      driver.given.values(['build', '--channel=beta']);

      expect(() => driver.get.arguments().channel('production')).toThrow(
        'Unsupported channel "beta".',
      );
    });
  });

  describe('port', () => {
    it('should parse the flag when it is a valid port', () => {
      const port = faker.internet.port();
      driver.given.values(['dev', `--port=${port}`]);

      expect(driver.get.arguments().port('port', 1)).toBe(port);
    });

    it('should use the fallback when the flag is absent', () => {
      driver.given.values(['dev']);

      expect(driver.get.arguments().port('port', 4200)).toBe(4200);
    });

    it.each(['0', '65536', 'abc', '12.5'])(
      'should throw when the flag is %s',
      (value) => {
        driver.given.values(['dev', `--port=${value}`]);

        expect(() => driver.get.arguments().port('port', 1)).toThrow(
          '--port must be an integer between 1 and 65535.',
        );
      },
    );
  });
});
