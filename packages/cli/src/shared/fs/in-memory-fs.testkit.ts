import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import { fs, vol } from 'memfs';

export function mockFileSystem(): void {
  jest.unstable_mockModule('node:fs/promises', () => ({
    ...fs.promises,
    default: fs.promises,
  }));
}

export function resetFileSystem(): void {
  vol.reset();
  vol.mkdirSync(tmpdir(), { recursive: true });
}

export class InMemoryDirectory {
  root = '';

  async create(prefix: string): Promise<string> {
    this.root = join(tmpdir(), `${prefix}${faker.string.alphanumeric(6)}`);
    vol.mkdirSync(this.root, { recursive: true });

    return this.root;
  }

  async writeFile(relativePath: string, contents: string): Promise<void> {
    const path = join(this.root, relativePath);
    vol.mkdirSync(dirname(path), { recursive: true });
    vol.writeFileSync(path, contents);
  }

  async writeJson(relativePath: string, value: unknown): Promise<void> {
    await this.writeFile(relativePath, `${JSON.stringify(value)}\n`);
  }

  async mkdir(relativePath: string): Promise<void> {
    vol.mkdirSync(join(this.root, relativePath), { recursive: true });
  }

  path(relativePath: string): string {
    return join(this.root, relativePath);
  }
}
