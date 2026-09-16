import { faker } from '@faker-js/faker';
import { ValidatorsDriver } from './validators.driver.js';
import { asRecord, isNonEmptyString } from './validators.js';

const UNSAFE_PATHS = [
  '/absolute.js',
  'dir\\file.js',
  'a%2Fb.js',
  'entry.js?debug',
  'entry.js#hash',
  '../escape.js',
  './same.js',
  'dir//file.js',
  'tab\tfile.js',
];
const SAFE_IDENTIFIERS = ['orders', 'workspace.ui_v2', 'a-b', '1', 'a.b.c'];
const UNSAFE_IDENTIFIERS = [
  '../orders',
  'a/b',
  'a\\b',
  'a..b',
  '.a',
  'a b',
  '-a',
];
const IDENTIFIER_MESSAGE =
  'Expected app id to contain only letters, numbers, dots, dashes, and underscores, without traversal.';

describe('asRecord', () => {
  it.each([[{}], [{ a: 1 }]])(
    'should return %j when value is a plain object',
    (value) => {
      expect(asRecord(value)).toBe(value);
    },
  );

  it.each([[null], [[]], ['x'], [1], [undefined]])(
    'should return undefined when value is %j',
    (value) => {
      expect(asRecord(value)).toBeUndefined();
    },
  );
});

describe('isNonEmptyString', () => {
  it.each([
    ['a', true],
    ['  ', false],
    ['', false],
    [1, false],
    [undefined, false],
  ])('should return %s for %j when checked', (value, expected) => {
    expect(isNonEmptyString(value)).toBe(expected);
  });
});

describe('requiredString', () => {
  let driver: ValidatorsDriver;

  beforeEach(() => {
    driver = new ValidatorsDriver();
  });

  it('should return the value without issues when key holds a non-empty string', () => {
    const value = faker.lorem.word();
    driver.given
      .record({ name: value })
      .when.recordValidated('requiredString', { key: 'name' });

    expect(driver.get.result()).toBe(value);
  });

  it.each([[undefined], [''], ['  '], [1], [null]])(
    'should report a non-empty string issue at the key when value is %j',
    (value) => {
      driver.given
        .record({ name: value })
        .when.recordValidated('requiredString', { key: 'name' });

      expect(driver.get.issues()).toEqual([
        { path: 'name', message: 'Expected name to be a non-empty string.' },
      ]);
    },
  );

  it('should report a non-empty string issue when the record is undefined', () => {
    driver.given
      .record(undefined)
      .when.recordValidated('requiredString', { key: 'name' });

    expect(driver.get.issues()).toEqual([
      { path: 'name', message: 'Expected name to be a non-empty string.' },
    ]);
  });
});

describe('optionalString', () => {
  let driver: ValidatorsDriver;

  beforeEach(() => {
    driver = new ValidatorsDriver();
  });

  it('should report nothing when key is absent', () => {
    driver.given
      .record({})
      .when.recordValidated('optionalString', { key: 'title' });

    expect(driver.get.issues()).toEqual([]);
  });

  it('should report a non-empty string issue when key holds an empty string', () => {
    driver.given
      .record({ title: '' })
      .when.recordValidated('optionalString', { key: 'title' });

    expect(driver.get.issues()).toEqual([
      { path: 'title', message: 'Expected title to be a non-empty string.' },
    ]);
  });
});

describe('requiredLiteral', () => {
  let driver: ValidatorsDriver;

  beforeEach(() => {
    driver = new ValidatorsDriver();
  });

  it('should return true when key holds the expected literal', () => {
    driver.given
      .record({ kind: 'app' })
      .when.literalRequired({ key: 'kind', expected: 'app' });

    expect(driver.get.result()).toBe(true);
  });

  it('should report the expected literal when key holds another value', () => {
    driver.given
      .record({ kind: faker.lorem.word() })
      .when.literalRequired({ key: 'kind', expected: 'app' });

    expect(driver.get.issues()).toEqual([
      { path: 'kind', message: 'Expected kind to be "app".' },
    ]);
  });
});

describe('requiredOneOf', () => {
  let driver: ValidatorsDriver;

  beforeEach(() => {
    driver = new ValidatorsDriver();
  });

  it('should return the member when key holds an allowed member', () => {
    driver.given
      .record({ channel: 'pr' })
      .when.oneOfValidated('requiredOneOf', {
        key: 'channel',
        allowed: ['production', 'pr'],
      });

    expect(driver.get.result()).toBe('pr');
  });

  it('should list allowed members when key holds another value', () => {
    driver.given
      .record({ channel: faker.lorem.word() })
      .when.oneOfValidated('requiredOneOf', {
        key: 'channel',
        allowed: ['production', 'pr', 'local'],
      });

    expect(driver.get.issues()).toEqual([
      {
        path: 'channel',
        message: 'Expected channel to be production, pr, or local.',
      },
    ]);
  });

  it('should list allowed members when key holds a non-string', () => {
    driver.given.record({ channel: 1 }).when.oneOfValidated('requiredOneOf', {
      key: 'channel',
      allowed: ['production', 'pr'],
    });

    expect(driver.get.issues()).toEqual([
      { path: 'channel', message: 'Expected channel to be production or pr.' },
    ]);
  });
});

describe('optionalOneOf', () => {
  let driver: ValidatorsDriver;

  beforeEach(() => {
    driver = new ValidatorsDriver();
  });

  it('should report nothing when key is absent', () => {
    driver.given.record({}).when.oneOfValidated('optionalOneOf', {
      key: 'match',
      allowed: ['prefix', 'full'],
    });

    expect(driver.get.issues()).toEqual([]);
  });

  it('should list allowed members when key holds another value', () => {
    driver.given
      .record({ match: faker.lorem.word() })
      .when.oneOfValidated('optionalOneOf', {
        key: 'match',
        allowed: ['prefix', 'full'],
      });

    expect(driver.get.issues()).toEqual([
      { path: 'match', message: 'Expected match to be prefix or full.' },
    ]);
  });
});

describe('requiredIdentifier', () => {
  let driver: ValidatorsDriver;

  beforeEach(() => {
    driver = new ValidatorsDriver();
  });

  it.each(SAFE_IDENTIFIERS)(
    'should return "%s" when key holds a safe identifier',
    (value) => {
      driver.given
        .record({ id: value })
        .when.recordValidated('requiredIdentifier', {
          key: 'id',
          label: 'app id',
        });

      expect(driver.get.result()).toBe(value);
    },
  );

  it.each(UNSAFE_IDENTIFIERS)(
    'should report an identifier issue when key holds "%s"',
    (value) => {
      driver.given
        .record({ id: value })
        .when.recordValidated('requiredIdentifier', {
          key: 'id',
          label: 'app id',
        });

      expect(driver.get.issues()).toEqual([
        { path: 'id', message: IDENTIFIER_MESSAGE },
      ]);
    },
  );

  it('should report only the non-empty string issue when key is missing', () => {
    driver.given.record({}).when.recordValidated('requiredIdentifier', {
      key: 'id',
      label: 'app id',
    });

    expect(driver.get.issues()).toEqual([
      { path: 'id', message: 'Expected id to be a non-empty string.' },
    ]);
  });
});

describe('requiredUrlSafePathSegment', () => {
  let driver: ValidatorsDriver;

  beforeEach(() => {
    driver = new ValidatorsDriver();
  });

  it.each(['orders', 'Release_1.2~candidate-3', '1'])(
    'should return "%s" when key holds a URL-safe segment',
    (value) => {
      driver.given
        .record({ id: value })
        .when.recordValidated('requiredUrlSafePathSegment', {
          key: 'id',
          label: 'artifact id',
        });

      expect(driver.get.result()).toBe(value);
    },
  );

  it.each([
    '.1',
    '-1',
    '_1',
    '~1',
    '1/2',
    '1+build',
    '1%20build',
    'rélease',
    '../orders',
  ])('should report a URL-safe segment issue when key holds "%s"', (value) => {
    driver.given
      .record({ id: value })
      .when.recordValidated('requiredUrlSafePathSegment', {
        key: 'id',
        label: 'artifact id',
      });

    expect(driver.get.issues()).toEqual([
      {
        path: 'id',
        message: `Expected artifact id "${value}" to be a URL-safe path segment.`,
      },
    ]);
  });
});

describe('requiredSafeRelativePath', () => {
  let driver: ValidatorsDriver;

  beforeEach(() => {
    driver = new ValidatorsDriver();
  });

  it.each(['entry.js', 'assets/app.css', 'a.b/c-d_e.js'])(
    'should return "%s" when key holds a safe relative path',
    (value) => {
      driver.given
        .record({ path: value })
        .when.recordValidated('requiredSafeRelativePath', { key: 'path' });

      expect(driver.get.result()).toBe(value);
    },
  );

  it.each(UNSAFE_PATHS)(
    'should report a safe relative path issue when key holds %j',
    (value) => {
      driver.given
        .record({ path: value })
        .when.recordValidated('requiredSafeRelativePath', { key: 'path' });

      expect(driver.get.issues()).toEqual([
        {
          path: 'path',
          message: `Expected "${value}" to be a safe relative path.`,
        },
      ]);
    },
  );
});

describe('validateHttpUrl', () => {
  let driver: ValidatorsDriver;

  beforeEach(() => {
    driver = new ValidatorsDriver();
  });

  it.each(['https://cdn.example/entry.js', 'http://localhost:4400/entry.js'])(
    'should return true when value is %s',
    (value) => {
      driver.when.valueValidated('validateHttpUrl', { value, path: 'url' });

      expect(driver.get.result()).toBe(true);
    },
  );

  it.each([
    'file:///tmp/entry.js',
    'javascript:alert(1)',
    'entry.js',
    'not a url',
  ])(
    'should report an absolute HTTP(S) URL issue when value is %s',
    (value) => {
      driver.when.valueValidated('validateHttpUrl', { value, path: 'url' });

      expect(driver.get.issues()).toEqual([
        { path: 'url', message: 'Expected an absolute HTTP(S) URL.' },
      ]);
    },
  );
});

describe('validateSemanticVersion', () => {
  let driver: ValidatorsDriver;

  beforeEach(() => {
    driver = new ValidatorsDriver();
  });

  it.each(['1.2.3', '1.2.3-beta.1', '1.2.3+build.5', '0.0.0-rc.1+sha.abc'])(
    'should report nothing when value is %s',
    (value) => {
      driver.when.valueValidated('validateSemanticVersion', {
        value,
        path: 'version',
      });

      expect(driver.get.issues()).toEqual([]);
    },
  );

  it.each(['latest', '1.2', 'v1.2.3', '1.2.3.4'])(
    'should report a semantic version issue when value is %s',
    (value) => {
      driver.when.valueValidated('validateSemanticVersion', {
        value,
        path: 'version',
      });

      expect(driver.get.issues()).toEqual([
        {
          path: 'version',
          message: 'Expected a semantic version such as 1.2.3.',
        },
      ]);
    },
  );
});

describe('validateSemanticVersionRange', () => {
  let driver: ValidatorsDriver;

  beforeEach(() => {
    driver = new ValidatorsDriver();
  });

  it.each([
    '^1.2.3',
    '~1.2',
    '>=1.0.0 <2.0.0',
    '1.x',
    '*',
    '1.2.3 - 2.0.0',
    '^1 || ^2',
  ])('should report nothing when value is %s', (value) => {
    driver.when.valueValidated('validateSemanticVersionRange', {
      value,
      path: 'range',
    });

    expect(driver.get.issues()).toEqual([]);
  });

  it.each(['next release', 'not-a-range', '>=1 <2 ||'])(
    'should report a semantic version range issue when value is %s',
    (value) => {
      driver.when.valueValidated('validateSemanticVersionRange', {
        value,
        path: 'range',
      });

      expect(driver.get.issues()).toEqual([
        {
          path: 'range',
          message: 'Expected a semantic version range such as ^1.2.3.',
        },
      ]);
    },
  );
});

describe('validateSha256Integrity', () => {
  let driver: ValidatorsDriver;

  beforeEach(() => {
    driver = new ValidatorsDriver();
  });

  it('should return true when value is a SHA-256 SRI string', () => {
    driver.when.valueValidated('validateSha256Integrity', {
      value: `sha256-${'A'.repeat(43)}=`,
      path: 'integrity',
    });

    expect(driver.get.result()).toBe(true);
  });

  it.each(['md5-invalid', 'sha256-short=', 42, undefined])(
    'should report an SRI issue when value is %j',
    (value) => {
      driver.when.valueValidated('validateSha256Integrity', {
        value,
        path: 'integrity',
      });

      expect(driver.get.issues()).toEqual([
        {
          path: 'integrity',
          message: 'Expected SHA-256 integrity in SRI format.',
        },
      ]);
    },
  );
});

describe('validateOptionalSha256Integrity', () => {
  let driver: ValidatorsDriver;

  beforeEach(() => {
    driver = new ValidatorsDriver();
  });

  it('should report nothing when value is undefined', () => {
    driver.when.valueValidated('validateOptionalSha256Integrity', {
      value: undefined,
      path: 'integrity',
    });

    expect(driver.get.issues()).toEqual([]);
  });

  it('should report an SRI issue when value is malformed', () => {
    driver.when.valueValidated('validateOptionalSha256Integrity', {
      value: 'sha256-invalid',
      path: 'integrity',
    });

    expect(driver.get.issues()).toEqual([
      {
        path: 'integrity',
        message: 'Expected SHA-256 integrity in SRI format.',
      },
    ]);
  });
});

describe('validateSha256Digest', () => {
  let driver: ValidatorsDriver;

  beforeEach(() => {
    driver = new ValidatorsDriver();
  });

  it('should return true when value is a lowercase sha256 digest', () => {
    driver.when.valueValidated('validateSha256Digest', {
      value: `sha256:${'a'.repeat(64)}`,
      path: 'digest',
    });

    expect(driver.get.result()).toBe(true);
  });

  it.each([
    `sha256:${'A'.repeat(64)}`,
    'sha256:abc',
    `sha1:${'a'.repeat(64)}`,
    undefined,
  ])('should report a digest issue when value is %j', (value) => {
    driver.when.valueValidated('validateSha256Digest', {
      value,
      path: 'digest',
    });

    expect(driver.get.issues()).toEqual([
      {
        path: 'digest',
        message: 'Expected a lowercase SHA-256 digest such as sha256:<64 hex>.',
      },
    ]);
  });
});

describe('validateMetadata', () => {
  let driver: ValidatorsDriver;

  beforeEach(() => {
    driver = new ValidatorsDriver();
  });

  it('should report nothing when value is undefined', () => {
    driver.when.valueValidated('validateMetadata', {
      value: undefined,
      path: 'metadata',
    });

    expect(driver.get.issues()).toEqual([]);
  });

  it('should report nothing when every entry is a string, finite number or boolean', () => {
    driver.when.valueValidated('validateMetadata', {
      value: {
        a: faker.lorem.word(),
        b: faker.number.int(),
        c: faker.datatype.boolean(),
      },
      path: 'metadata',
    });

    expect(driver.get.issues()).toEqual([]);
  });

  it('should report an object issue when value is not an object', () => {
    driver.when.valueValidated('validateMetadata', {
      value: faker.lorem.word(),
      path: 'metadata',
    });

    expect(driver.get.issues()).toEqual([
      { path: 'metadata', message: 'Expected metadata to be an object.' },
    ]);
  });

  it.each([[null], [{ nested: true }], [Number.NaN], [[]]])(
    'should report the entry when its value is %j',
    (entry) => {
      driver.when.valueValidated('validateMetadata', {
        value: { bad: entry },
        path: 'metadata',
      });

      expect(driver.get.issues()).toEqual([
        {
          path: 'metadata.bad',
          message: 'Expected a string, number, or boolean metadata value.',
        },
      ]);
    },
  );
});

describe('validateOptionalText', () => {
  let driver: ValidatorsDriver;

  beforeEach(() => {
    driver = new ValidatorsDriver();
  });

  it('should report nothing when value is undefined', () => {
    driver.when.valueValidated('validateOptionalText', {
      value: undefined,
      path: 'gitSha',
      maximumLength: 10,
    });

    expect(driver.get.issues()).toEqual([]);
  });

  it('should report nothing when value fits the maximum length', () => {
    driver.when.valueValidated('validateOptionalText', {
      value: 'a'.repeat(10),
      path: 'gitSha',
      maximumLength: 10,
    });

    expect(driver.get.issues()).toEqual([]);
  });

  it.each(['', '  ', 'a'.repeat(11), 5])(
    'should report a length issue when value is %j',
    (value) => {
      driver.when.valueValidated('validateOptionalText', {
        value,
        path: 'gitSha',
        maximumLength: 10,
      });

      expect(driver.get.issues()).toEqual([
        {
          path: 'gitSha',
          message: 'Expected a non-empty string no longer than 10 characters.',
        },
      ]);
    },
  );
});

describe('validateInteger', () => {
  let driver: ValidatorsDriver;

  beforeEach(() => {
    driver = new ValidatorsDriver();
  });

  it('should return true when value is an integer at or above the minimum', () => {
    driver.when.valueValidated('validateInteger', {
      value: 1,
      path: 'size',
      label: 'size',
      minimum: 1,
    });

    expect(driver.get.result()).toBe(true);
  });

  it.each([0, -1, 1.5, '1', Number.NaN, undefined])(
    'should report an integer issue when value is %j and minimum is 1',
    (value) => {
      driver.when.valueValidated('validateInteger', {
        value,
        path: 'size',
        label: 'size',
        minimum: 1,
      });

      expect(driver.get.issues()).toEqual([
        {
          path: 'size',
          message: 'Expected size to be an integer of at least 1.',
        },
      ]);
    },
  );
});

describe('validateUniqueValue', () => {
  let driver: ValidatorsDriver;

  beforeEach(() => {
    driver = new ValidatorsDriver();
  });

  it('should return true when the value was not seen before', () => {
    driver.when.valueValidated('validateUniqueValue', {
      value: faker.lorem.word(),
      path: '0',
      label: 'host id',
      seen: new Set(),
    });

    expect(driver.get.result()).toBe(true);
  });

  it('should report a duplicate when the value was seen before', () => {
    const value = faker.lorem.word();
    driver.when.valueValidated('validateUniqueValue', {
      value,
      path: '1',
      label: 'host id',
      seen: new Set([value]),
    });

    expect(driver.get.issues()).toEqual([
      { path: '1', message: `Duplicate host id "${value}".` },
    ]);
  });
});
