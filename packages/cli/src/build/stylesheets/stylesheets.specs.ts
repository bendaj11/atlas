import { faker } from '@faker-js/faker';
import { StylesheetsDriver } from './stylesheets.driver.js';

describe('stylesheets', () => {
  let driver: StylesheetsDriver;

  beforeEach(async () => {
    driver = new StylesheetsDriver();

    await driver.given.artifactRoot();
  });

  describe('discoverStylesheets', () => {
    describe('when channel is local', () => {
      beforeEach(() => {
        driver.given.channel('local');
      });

      it('should point at styles.css without integrity when framework is angular', async () => {
        const baseUrl = faker.internet.url({ appendSlash: false });
        driver.given.framework('angular');

        expect(await driver.get.stylesheets(baseUrl)).toStrictEqual([
          { href: `${baseUrl}/styles.css` },
        ]);
      });

      it('should return no stylesheets when framework is react', async () => {
        driver.given.framework('react');

        expect(
          await driver.get.stylesheets(faker.internet.url()),
        ).toStrictEqual([]);
      });
    });

    it('should keep index.html link order when framework is angular and index declares stylesheets', async () => {
      const baseUrl = faker.internet.url({ appendSlash: false });
      driver.given.framework('angular');
      await driver.given.file(
        'index.html',
        '<link rel="stylesheet" href="styles-b.css"><link rel="stylesheet" href="styles-a.css">',
      );
      await driver.given.file('styles-a.css', 'a');
      await driver.given.file('styles-b.css', 'b');

      expect(
        (await driver.get.stylesheets(baseUrl)).map(({ href }) => href),
      ).toStrictEqual([`${baseUrl}/styles-b.css`, `${baseUrl}/styles-a.css`]);
    });

    it('should list every css file with integrity when index declares none', async () => {
      const baseUrl = faker.internet.url({ appendSlash: false });
      driver.given.framework('react');
      await driver.given.file('assets/theme.css', 'body{}');
      await driver.given.file('main.js', '');

      expect(await driver.get.stylesheets(baseUrl)).toStrictEqual([
        {
          href: `${baseUrl}/assets/theme.css`,
          integrity: expect.stringMatching(/^sha256-[A-Za-z0-9+/]+=*$/),
        },
      ]);
    });
  });

  describe('stylesheetPathsFromIndex', () => {
    it('should ignore links that are not stylesheets when parsing', () => {
      expect(
        driver.get.pathsFromIndex(
          '<link rel="icon" href="favicon.ico"><link rel="stylesheet" href="a.css">',
        ),
      ).toStrictEqual(['a.css']);
    });

    it('should ignore hrefs with query or fragment when parsing', () => {
      expect(
        driver.get.pathsFromIndex(
          '<link rel="stylesheet" href="a.css?v=1"><link rel="stylesheet" href="b.css#x">',
        ),
      ).toStrictEqual([]);
    });

    it('should dedupe repeated hrefs when parsing', () => {
      expect(
        driver.get.pathsFromIndex(
          "<link rel='stylesheet' href='a.css'><link rel=stylesheet href=a.css>",
        ),
      ).toStrictEqual(['a.css']);
    });

    it('should accept rel lists containing stylesheet when parsing', () => {
      expect(
        driver.get.pathsFromIndex(
          '<link rel="preload stylesheet" href="a.css">',
        ),
      ).toStrictEqual(['a.css']);
    });
  });
});
