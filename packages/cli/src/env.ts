import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function loadEnvFiles(root: string): Promise<void> {
  await loadEnvFile(join(root, ".env.local"));
  await loadEnvFile(join(root, ".env"));
}

async function loadEnvFile(path: string): Promise<void> {
  let source: string;
  try {
    source = await readFile(path, "utf8");
  } catch {
    return;
  }
  for (const line of source.split(/\r?\n/)) {
    const entry = parseEnvLine(line);
    if (!entry || process.env[entry.name] !== undefined) continue;
    process.env[entry.name] = entry.value;
  }
}

export async function saveWorkspaceLocalEnv(root: string, values: Readonly<Record<string, string>>): Promise<void> {
  const path = join(root, ".env.local");
  let source = "";
  try {
    source = await readFile(path, "utf8");
  } catch (error) {
    if (!isMissingFileError(error)) throw error;
  }
  const remaining = new Map(Object.entries(values));
  const lines = source.split(/\r?\n/).map((line) => {
    const entry = parseEnvLine(line);
    if (!entry || !remaining.has(entry.name)) return line;
    const value = remaining.get(entry.name)!;
    remaining.delete(entry.name);
    return `${entry.name}=${formatEnvValue(value)}`;
  });
  if (lines.at(-1) === "") lines.pop();
  for (const [name, value] of remaining) lines.push(`${name}=${formatEnvValue(value)}`);
  await writeFile(path, `${lines.join("\n")}\n`, "utf8");
}

function parseEnvLine(line: string): { name: string; value: string } | undefined {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return undefined;
  const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
  if (!match) return undefined;
  return { name: match[1]!, value: parseEnvValue(match[2]!.trim()) };
}

function parseEnvValue(value: string): string {
  if (value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1).replace(/\\n/g, "\n").replace(/\\"/g, '"');
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
  return value.replace(/\s+#.*$/, "");
}

function formatEnvValue(value: string): string {
  return /^[^\s#"']+$/.test(value) ? value : JSON.stringify(value);
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
