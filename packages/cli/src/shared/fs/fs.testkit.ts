import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll } from '@jest/globals';

const createdRoots = new Set<string>();

afterAll(async () => {
  await Promise.all(
    [...createdRoots].map((root) => rm(root, { recursive: true, force: true })),
  );
  createdRoots.clear();
});

export class TemporaryDirectory {
  root = '';

  async create(prefix: string): Promise<string> {
    this.root = await mkdtemp(join(tmpdir(), prefix));
    createdRoots.add(this.root);

    return this.root;
  }

  async writeFile(relativePath: string, contents: string): Promise<void> {
    const path = join(this.root, relativePath);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, contents, 'utf8');
  }

  async writeJson(relativePath: string, value: unknown): Promise<void> {
    await this.writeFile(relativePath, `${JSON.stringify(value)}\n`);
  }

  async mkdir(relativePath: string): Promise<void> {
    await mkdir(join(this.root, relativePath), { recursive: true });
  }

  path(relativePath: string): string {
    return join(this.root, relativePath);
  }
}
