import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export class TemporaryDirectory {
  root = '';

  async create(prefix: string): Promise<string> {
    this.root = await mkdtemp(join(tmpdir(), prefix));

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
