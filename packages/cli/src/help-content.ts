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
  { label: "remove-pr", description: "Remove this workspace's builds for a closed or merged PR" },
  { label: "prune-prs", description: "Reconcile stored PR builds against live Git state" },
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
    examples: ["atlas g host customer-host", "atlas g app orders", "atlas g widget order-summary --app-id <app-id>"]
  },
  "generate host": generationProjectHelp("host", "host client"),
  "generate app": generationProjectHelp("app", "app"),
  "generate widget": {
    summary: "Generate an exported widget inside an existing app.",
    usage: "atlas generate widget <name> [--app-id <app-id>] [options]",
    arguments: [{ label: "name", description: "Widget name" }],
    options: [
      { label: "--app-id <app-id>", description: "Stable owning app ID; prompted from configured apps when omitted" },
      { label: "--force", description: "Replace an existing widget with the same name" },
      { label: "-h, --help", description: "Show help for this command" }
    ],
    examples: ["atlas g widget order-summary", "atlas g widget order-summary --app-id <app-id>"]
  },
  dev: {
    summary: "Run a host, or run one app locally inside an Atlas host.",
    usage: "atlas dev [project] [options]",
    arguments: [{ label: "project", description: "Atlas project name or directory; defaults to the current directory" }],
    options: [
      { label: "--host-url <url>", description: "Host page where the local app should run" },
      { label: "--port <number>", description: "Host browser port or app framework port (host: 4200, app: 4201)" },
      { label: "--control-port <number>", description: "Atlas override-server port (default: 4400)" },
      { label: "--bootstrap-port <number>", description: "Override local host bootstrap port (default: host --port)" },
      { label: "--host-client-port <number>", description: "Internal host-client framework port (default: 4300)" },
      { label: "--no-open", description: "Do not open the resolved host URL automatically" },
      { label: "--prepare-only", description: "Create the override without starting development servers" },
      { label: "-h, --help", description: "Show help for this command" }
    ],
    environment: [
      { label: "ATLAS_HOST_URL", description: "Host base URL or full page URL where the local app should run" }
    ],
    examples: [
      "atlas dev customer-host",
      "atlas dev orders",
      "atlas dev",
      "ATLAS_HOST_URL=http://localhost:4200 atlas dev orders",
      "atlas dev orders --host-url https://customer.example/orders"
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
      { label: "--git-sha <sha>", description: "Actual source commit SHA" },
      { label: "--git-branch <name>", description: "Source branch displayed by Columbus" },
      { label: "--git-commit-title <text>", description: "Commit title displayed by Columbus" },
      { label: "--from-build-output", description: "Use output produced by workspace runner" },
      { label: "--skip-compile", description: "Alias for --from-build-output" }
    ],
    environment: [
      { label: "ATLAS_CREATED_AT", description: "Build creation timestamp" },
      { label: "ATLAS_REGISTRY_URL", description: "Default public registry URL" }
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
    environment: [{ label: "ATLAS_REGISTRY_URL", description: "Default public registry URL" }],
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
      { label: "--require-publication", description: "Fail instead of skipping an ordinary branch build" },
      { label: "-h, --help", description: "Show help for this command" }
    ],
    environment: [
      { label: "ATLAS_STORAGE", description: "Storage provider; s3" },
      { label: "ATLAS_S3_BUCKET", description: "S3-compatible bucket" },
      { label: "ATLAS_STORAGE_API_URL", description: "Private S3-compatible upload API; omit for AWS S3" },
      { label: "ATLAS_STORAGE_KEY_PREFIX", description: "Optional object key namespace" },
      { label: "ATLAS_S3_REGION", description: "Storage signing region" },
      { label: "ATLAS_S3_FORCE_PATH_STYLE", description: "Enable path-style access for providers such as MinIO" },
      { label: "ATLAS_REGISTRY_URL", description: "Public download URL serving published objects" },
      { label: "ATLAS_STORAGE_ACCESS_KEY_ID", description: "Explicit storage access key; short-lived identity is preferred" },
      { label: "ATLAS_STORAGE_SECRET_ACCESS_KEY", description: "Explicit storage secret key" },
      { label: "ATLAS_STORAGE_SESSION_TOKEN", description: "Optional temporary storage session token" },
      { label: "ATLAS_RUNTIME_URLS", description: "Deployed runtime URLs verified after publication" },
      { label: "ATLAS_PR_NUMBER", description: "Custom pull-request number when provider variables are unavailable" },
      { label: "ATLAS_GIT_SHA", description: "Actual pull-request head SHA; must not be a synthetic merge SHA" },
      { label: "ATLAS_GIT_BRANCH", description: "Custom source branch name" },
      { label: "ATLAS_GIT_COMMIT_TITLE", description: "Commit title displayed by Columbus" },
      { label: "ATLAS_DEFAULT_BRANCH", description: "Production branch when CI does not expose one" },
      { label: "ATLAS_REQUIRE_PUBLICATION", description: "Set true to fail when no PR, tag, or production context exists" }
    ],
    examples: ["atlas publish orders", "atlas publish orders --from-build-output", "atlas publish orders --dry-run"]
  },
  "remove-pr": {
    summary: "Remove this workspace's stored builds for one closed or merged pull request.",
    usage: "atlas remove-pr --pr-number <number> [options]",
    options: [
      { label: "--pr-number <number>", description: "Closed or merged pull-request number" },
      { label: "--artifact-ids <ids>", description: "Comma-separated Atlas IDs; otherwise discover workspace configs" },
      { label: "--publish-config <path>", description: "Optional custom storage or invalidation config" },
      { label: "--skip-compile", description: "Read existing compiled Atlas configs during workspace discovery" },
      { label: "-h, --help", description: "Show help for this command" }
    ],
    examples: ["atlas remove-pr --pr-number 42", "atlas remove-pr --pr-number 42 --artifact-ids orders,login"]
  },
  "prune-prs": {
    summary: "Remove closed PR builds while preserving every open pull request.",
    usage: "atlas prune-prs [options]",
    options: [
      { label: "--state-file <path>", description: "Authoritative provider-neutral JSON list of all open PR numbers" },
      { label: "--artifact-ids <ids>", description: "Comma-separated Atlas IDs; otherwise discover workspace configs" },
      { label: "--publish-config <path>", description: "Custom storage and optional pull-request resolver" },
      { label: "--skip-compile", description: "Read existing compiled Atlas configs during workspace discovery" },
      { label: "-h, --help", description: "Show help for this command" }
    ],
    examples: ["atlas prune-prs", "atlas prune-prs --state-file .atlas/open-prs.json"]
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
