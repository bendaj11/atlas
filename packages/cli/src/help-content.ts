export interface HelpEntry {
  label: string;
  description: string;
}

export interface CommandHelp {
  summary: string;
  usage: string;
  arguments?: readonly HelpEntry[];
  options?: readonly HelpEntry[];
  advancedOptions?: readonly HelpEntry[];
  environment?: readonly HelpEntry[];
  examples: readonly string[];
}

export const ROOT_COMMANDS: readonly HelpEntry[] = [
  { label: "generate, g", description: "Generate a host, app, or exported widget" },
  { label: "dev", description: "Run a host, or run one app locally inside a host" },
  { label: "build", description: "Build a host or app for deployment" },
  { label: "build-bootstrap", description: "Build static host bootstrap files" },
  { label: "publish", description: "Build and publish one host client or app safely" },
  { label: "rollback", description: "Select and publish a previous host or app version" },
  { label: "verify", description: "Verify a deployed Atlas host and its assets" }
];

export const ROOT_EXAMPLES = [
  "atlas g host customer-host",
  "atlas g app orders",
  "atlas dev customer-host",
  "atlas dev orders",
  "atlas publish orders",
  "atlas build-bootstrap customer-host",
  "atlas verify --runtime-url https://customer.example/atlas.runtime.json"
] as const;

export const COMMAND_HELP: Readonly<Record<string, CommandHelp>> = {
  generate: {
    summary: "Generate an Atlas project or exported widget.",
    usage: "atlas generate <type> [name] [options]",
    arguments: [
      { label: "type", description: "Resource to generate: host, app, or widget" },
      { label: "name", description: "Resource name; prompted when omitted" }
    ],
    options: [{ label: "-h, --help", description: "Show help for this command" }],
    examples: ["atlas g host customer-host", "atlas g app orders", "atlas g widget order-summary --app orders"]
  },
  "generate host": generationProjectHelp("host", "host client"),
  "generate app": generationProjectHelp("app", "app"),
  "generate widget": {
    summary: "Generate an exported widget inside an existing app.",
    usage: "atlas generate widget <name> --app <project> [options]",
    arguments: [{ label: "name", description: "Widget name" }],
    options: [
      { label: "--app <project>", description: "Owning app name or directory" },
      { label: "--force", description: "Replace an existing widget with the same name" },
      { label: "-h, --help", description: "Show help for this command" }
    ],
    examples: ["atlas g widget order-summary --app orders"]
  },
  dev: {
    summary: "Run a host, or run one app locally inside an Atlas host.",
    usage: "atlas dev [project] [options]",
    arguments: [{ label: "project", description: "Atlas project name or directory; defaults to the current directory" }],
    options: [
      { label: "--host <host-id>", description: "Host receiving the local override" },
      { label: "--host-url <url>", description: "Host page opened with the override activated" },
      { label: "--port <number>", description: "Host browser port or app framework port (host: 4200, app: 4201)" },
      { label: "--control-port <number>", description: "Atlas override-server port (default: 4400)" },
      { label: "--bootstrap-port <number>", description: "Override local host bootstrap port (default: host --port)" },
      { label: "--host-client-port <number>", description: "Internal host-client framework port (default: 4300)" },
      { label: "--no-open", description: "Do not open the resolved host URL automatically" },
      { label: "--prepare-only", description: "Create the override without starting development servers" },
      { label: "-h, --help", description: "Show help for this command" }
    ],
    environment: [
      { label: "ATLAS_HOST_ID", description: "Default host id when an app supports multiple hosts" },
      { label: "ATLAS_HOST_URL", description: "Host base URL or full page URL opened with the override activated" }
    ],
    examples: [
      "atlas dev customer-host",
      "atlas dev orders",
      "atlas dev",
      "ATLAS_HOST_URL=http://localhost:4200 atlas dev orders",
      "atlas dev orders --host 0a17281f-287b-4d89-a8ca-0ab0e577c506 --host-url https://customer.example/orders"
    ]
  },
  build: {
    summary: "Build a host client or app and write its immutable manifest.",
    usage: "atlas build <project> [options]",
    arguments: [{ label: "project", description: "Atlas project name or directory; prompted when omitted" }],
    options: [
      { label: "--registry-base-url <url>", description: "Public base URL of the static registry" },
      { label: "--include-source-maps", description: "Include source maps in artifact identity" },
      { label: "--channel <channel>", description: "Override inferred production, pr, or local channel" },
      { label: "-h, --help", description: "Show help for this command" }
    ],
    advancedOptions: [
      { label: "--entry <path>", description: "Override the generated remote entry path" },
      { label: "--version <version>", description: "Override package version for diagnostics" },
      { label: "--build-id <id>", description: "Override content build ID for diagnostics" },
      { label: "--pr-number <number>", description: "Override CI pull request detection" },
      { label: "--from-build-output", description: "Use output produced by workspace runner" },
      { label: "--skip-compile", description: "Alias for --from-build-output" }
    ],
    environment: [
      { label: "ATLAS_CREATED_AT", description: "Build creation timestamp" },
      { label: "ATLAS_REGISTRY_BASE_URL", description: "Default static-registry base URL" }
    ],
    examples: [
      "atlas build orders --registry-base-url https://cdn.example.com/atlas"
    ]
  },
  "build-bootstrap": {
    summary: "Build static Atlas bootstrap files for Nginx or equivalent hosting.",
    usage: "atlas build-bootstrap <host> [options]",
    arguments: [{ label: "host", description: "Host project name or directory" }],
    options: [
      { label: "--registry-base-url <url>", description: "Public base URL of static registry" },
      { label: "--out <path>", description: "Output directory (default: <host>/dist/bootstrap)" },
      { label: "--template <path>", description: "Override atlas.bootstrap.html with another host-relative template" },
      { label: "--title <text>", description: "Document title when no template file is present" },
      { label: "--loading-html <html>", description: "Loading markup when no template file is present" },
      { label: "--asset-origins <urls>", description: "Comma-separated approved asset origins" },
      { label: "--external-registry-urls <urls>", description: "Comma-separated external registry base URLs" },
      { label: "--skip-compile", description: "Use already compiled atlas.config.ts" },
      { label: "-h, --help", description: "Show help for this command" }
    ],
    environment: [{ label: "ATLAS_REGISTRY_BASE_URL", description: "Default static-registry base URL" }],
    examples: [
      "atlas build-bootstrap customer-host --registry-base-url https://cdn.example.com/atlas",
      "atlas build-bootstrap customer-host --template atlas.bootstrap.html"
    ]
  },
  publish: {
    summary: "Build and publish one Atlas project under a storage lease.",
    usage: "atlas publish <project> [options]",
    arguments: [{ label: "project", description: "Atlas project name or directory" }],
    options: [
      { label: "--runtime-url <url>", description: "Verify after activation and restore mutable files on failure" },
      { label: "--runtime-urls <urls>", description: "Comma-separated deployed hosts to verify" },
      { label: "--from-build-output", description: "Reuse build output from Nx, Turbo, or workspace scripts" },
      { label: "--publish-config <path>", description: "Optional custom storage or invalidation config" },
      { label: "--dry-run", description: "Validate and print publication order without writes" },
      { label: "-h, --help", description: "Show help for this command" }
    ],
    environment: [
      { label: "ATLAS_STORAGE", description: "Storage provider; s3" },
      { label: "ATLAS_S3_BUCKET", description: "S3-compatible bucket" },
      { label: "ATLAS_S3_ENDPOINT", description: "S3-compatible API endpoint; omit for AWS S3" },
      { label: "ATLAS_S3_PREFIX", description: "Optional object key prefix" },
      { label: "ATLAS_S3_REGION", description: "Storage signing region" },
      { label: "ATLAS_S3_FORCE_PATH_STYLE", description: "Enable path-style access for providers such as MinIO" },
      { label: "ATLAS_REGISTRY_BASE_URL", description: "Public URL serving published objects" },
      { label: "AWS_ACCESS_KEY_ID", description: "Standard SDK credential; short-lived identity is preferred" },
      { label: "ATLAS_RUNTIME_URLS", description: "Deployed runtime URLs verified after publication" }
    ],
    examples: ["atlas publish orders", "atlas publish orders --from-build-output", "atlas publish orders --dry-run"]
  },
  rollback: {
    summary: "Select and publish a previously released host-client or app build.",
    usage: "atlas rollback <artifact-id> --version <version> [options]",
    arguments: [{ label: "artifact-id", description: "Stable host or app ID from atlas.config.ts; prompted when omitted" }],
    options: [
      { label: "--version <version>", description: "Production version to restore; prompted when omitted" },
      { label: "--build-id <id>", description: "Specific build of the selected version" },
      { label: "--expected-registry-revision <hash>", description: "Reject conflicting registry updates" },
      { label: "--runtime-url <url>", description: "Verify rollback and restore the prior selection on failure" },
      { label: "--runtime-urls <urls>", description: "Comma-separated deployed hosts to verify" },
      { label: "--publish-config <path>", description: "Optional custom storage or invalidation config" },
      { label: "-h, --help", description: "Show help for this command" }
    ],
    environment: [
      { label: "ATLAS_STORAGE", description: "Storage provider; s3" },
      { label: "ATLAS_S3_BUCKET", description: "S3-compatible bucket" },
      { label: "ATLAS_RUNTIME_URLS", description: "Deployments verified after rollback" }
    ],
    examples: [
      "atlas rollback 2bea9c13-4899-4f93-9211-cd8c55e9c529 --version 1.3.2",
      "atlas rollback 2bea9c13-4899-4f93-9211-cd8c55e9c529 --version 1.3.2 --build-id a81f29c204e1"
    ]
  },
  verify: {
    summary: "Verify a deployed Atlas host, catalog, manifests, and assets.",
    usage: "atlas verify [--runtime-url <url>] [options]",
    options: [
      { label: "--runtime-url <url>", description: "One deployed atlas.runtime.json URL" },
      { label: "--runtime-urls <urls>", description: "Comma-separated deployed runtime URLs" },
      { label: "--host-origin <url>", description: "Expected host origin used for policy checks" },
      { label: "-h, --help", description: "Show help for this command" }
    ],
    environment: [{ label: "ATLAS_RUNTIME_URLS", description: "Space or comma-separated deployed runtime URLs" }],
    examples: [
      "atlas verify --runtime-url https://customer.example/atlas.runtime.json",
      "ATLAS_RUNTIME_URLS=https://customer.example/atlas.runtime.json atlas verify"
    ]
  }
};

function generationProjectHelp(type: "host" | "app", resource: string): CommandHelp {
  return {
    summary: `Generate a framework-native Atlas ${resource}.`,
    usage: `atlas generate ${type} <name-or-path> [options]`,
    arguments: [{ label: "name-or-path", description: `Name or command-relative path of the ${resource}; prompted when omitted` }],
    options: [
      { label: "--framework <name>", description: "Framework: angular or react; prompted when omitted" },
      ...(type === "app" ? [{ label: "--host-id <host-id>", description: "Stable host id used for the generated route" }] : []),
      ...(type === "app" ? [{ label: "--routing, --no-routing", description: "Create Atlas inner route files or a single-page app; prompted when omitted in interactive mode" }] : []),
      { label: "--port <number>", description: `Dev-server port; prompted when omitted in interactive mode (default: ${type === "host" ? 4200 : 4201})` },
      { label: "--framework-version <range>", description: "Framework semver range for new packages; existing Nx packages keep their Angular/React version" },
      { label: "--directory <path>", description: "Target directory" },
      { label: "--allow-unsupported-version", description: "Generate outside Atlas's tested version range" },
      { label: "--force", description: "Write into an existing target directory" },
      { label: "--skip-install", description: "Generate files without installing dependencies" },
      { label: "--skip-workspace-generator", description: "Skip the native Nx project generator" },
      { label: "--yes", description: "Approve required workspace plugin installation" },
      { label: "-h, --help", description: "Show help for this command" }
    ],
    examples: [
      `atlas g ${type} ${type === "host" ? "customer-host" : "orders"} --framework react`,
      `atlas g ${type} ${type === "host" ? "apps/admin-host" : "products/billing"} --framework angular`
    ]
  };
}
