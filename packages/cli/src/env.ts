import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function loadWorkspaceEnv(root: string): Promise<void> {
  let source: string;
  try {
    source = await readFile(join(root, ".env"), "utf8");
  } catch {
    return;
  }
  for (const line of source.split(/\r?\n/)) {
    const entry = parseEnvLine(line);
    if (!entry || process.env[entry.name] !== undefined) continue;
    process.env[entry.name] = entry.value;
  }
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
