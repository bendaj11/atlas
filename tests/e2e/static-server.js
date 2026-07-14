import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const options = parseArguments(process.argv.slice(2));
const root = resolve(options.root);

createServer(async (request, response) => {
  try {
    const requestPath = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
    const requestedFile = safePath(root, requestPath);
    const fallback = options.spa && !extname(requestPath) ? join(root, "index.html") : undefined;
    const file = await resolveFile(requestedFile, fallback);
    if (!file) return send(response, 404, "Not found", "text/plain; charset=utf-8");
    response.statusCode = 200;
    response.setHeader("content-type", contentType(file));
    response.setHeader("access-control-allow-origin", "*");
    response.setHeader("cache-control", cacheControl(requestPath));
    createReadStream(file).pipe(response);
  } catch (error) {
    send(response, 500, error instanceof Error ? error.message : String(error), "text/plain; charset=utf-8");
  }
}).listen(options.port, "127.0.0.1", () => {
  console.info(`Serving ${root} at http://127.0.0.1:${options.port}`);
});

function parseArguments(values) {
  const flags = Object.fromEntries(values.map((value) => {
    const [name, content = "true"] = value.replace(/^--/, "").split("=");
    return [name, content];
  }));
  if (!flags.root || !flags.port) throw new Error("Usage: static-server --root=<directory> --port=<port> [--spa]");
  return { root: flags.root, port: Number(flags.port), spa: flags.spa === "true" };
}

function safePath(rootDirectory, requestPath) {
  const candidate = resolve(rootDirectory, `.${normalize(requestPath)}`);
  if (candidate !== rootDirectory && !candidate.startsWith(`${rootDirectory}${sep}`)) throw new Error("Path escapes the server root.");
  return candidate;
}

async function resolveFile(candidate, fallback) {
  try {
    const details = await stat(candidate);
    if (details.isFile()) return candidate;
    if (details.isDirectory()) return resolveFile(join(candidate, "index.html"), fallback);
  } catch {}
  if (fallback && candidate !== fallback) return resolveFile(fallback);
  return undefined;
}

function cacheControl(path) {
  if (path.endsWith("registry.json") || path.endsWith("/catalog.json") || path.endsWith("/index.json")) return "no-cache";
  return /^\/(?:hosts|apps)\/[^/]+\/[^/]+\/[^/]+\//.test(path) ? "public, max-age=31536000, immutable" : "no-cache";
}

function contentType(path) {
  return ({ ".css": "text/css", ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".map": "application/json" })[extname(path)] ?? "application/octet-stream";
}

function send(response, status, body, type) {
  response.statusCode = status;
  response.setHeader("content-type", type);
  response.setHeader("access-control-allow-origin", "*");
  response.end(body);
}
