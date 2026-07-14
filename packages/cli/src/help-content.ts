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
  { label: "publish", description: "Publish a prepared deployment safely" },
  { label: "release", description: "Build and publish a host client or app" },
  { label: "rollback", description: "Select and publish a previous host or app version" },
  { label: "verify", description: "Verify a deployed Atlas host and its assets" }
];

export const ROOT_EXAMPLES = [
  "atlas g host customer-host",
  "atlas g app orders",
  "atlas dev customer-host",
  "atlas dev orders",
  "atlas build customer-host",
  "atlas build orders"
] as const;

export const COMMAND_HELP: Readonly<Record<string, CommandHelp>> = {
  generate: {
    summary: "Generate an Atlas project, exported widget, or publication adapter config.",
    usage: "atlas generate <type> [name] [options]",
    arguments: [
      { label: "type", description: "Resource to generate: host, app, widget, or publish-config" },
      { label: "name", description: "Resource name; prompted when omitted" }
    ],
    options: [{ label: "-h, --help", description: "Show help for this command" }],
    examples: ["atlas g host customer-host", "atlas g app orders", "atlas g widget order-summary --app orders", "atlas generate publish-config"]
  },
  "generate host": generationProjectHelp("host", "host client and server projects"),
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
  "generate publish-config": {
    summary: "Generate explicit S3 publication adapter configuration.",
    usage: "atlas generate publish-config [options]",
    options: [
      { label: "--directory <path>", description: "Target directory; defaults to workspace root" },
      { label: "--force", description: "Replace an existing atlas.publish.ts" }
    ],
    examples: ["atlas generate publish-config"]
  },
  dev: {
    summary: "Run a host, or run one app locally inside an Atlas host.",
    usage: "atlas dev [project] [options]",
    arguments: [{ label: "project", description: "Atlas project name or directory; defaults to the current directory" }],
    options: [
      { label: "--host <host-id>", description: "Host receiving the local override" },
      { label: "--host-url <url>", description: "Host page opened with the override activated" },
      { label: "--port <number>", description: "Framework dev-server port (host: 4200, app: 4201)" },
      { label: "--control-port <number>", description: "Atlas override-server port (default: 4400)" },
      { label: "--host-server-port <number>", description: "Local stable host-server port (default: 4300)" },
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
    summary: "Build a host or app and prepare its deployment artifacts.",
    usage: "atlas build <project> [options]",
    arguments: [{ label: "project", description: "Atlas project name or directory; prompted when omitted" }],
    options: [
      { label: "--registry-base-url <url>", description: "Public base URL of the static registry" },
      { label: "--registry-snapshot <path>", description: "Existing registry snapshot to update" },
      { label: "--expected-registry-revision <hash>", description: "Reject conflicting registry updates" },
      { label: "--include-source-maps", description: "Include source maps in the publication" },
      { label: "--version <version>", description: "Version assigned to the build" },
      { label: "--build-id <id>", description: "Unique build identifier" },
      { label: "--channel <channel>", description: "production, pr, or local" },
      { label: "--pr-number <number>", description: "Pull request number for a PR artifact" },
      { label: "-h, --help", description: "Show help for this command" }
    ],
    advancedOptions: [
      { label: "--entry <path>", description: "Override the generated remote entry path" },
      { label: "--publication-directory <path>", description: "Override the publication output directory" },
      { label: "--publication-plan <path>", description: "Override the publication plan output path" },
      { label: "--skip-compile", description: "Prepare metadata from an existing framework build" }
    ],
    environment: [
      { label: "ATLAS_VERSION", description: "Default build version" },
      { label: "ATLAS_BUILD_ID", description: "Default unique build identifier" },
      { label: "ATLAS_CREATED_AT", description: "Build creation timestamp" },
      { label: "ATLAS_REGISTRY_BASE_URL", description: "Default static-registry base URL" }
    ],
    examples: [
      "atlas build orders --registry-base-url https://cdn.example.com/atlas",
      "ATLAS_VERSION=1.4.0 atlas build orders --registry-base-url https://cdn.example.com/atlas"
    ]
  },
  publish: {
    summary: "Publish a prepared Atlas publication with locking and safe activation order.",
    usage: "atlas publish --plan <path> [options]",
    options: [
      { label: "--plan <path>", description: "Publication plan (default: dist/atlas-publication.json)" },
      { label: "--runtime-url <url>", description: "Verify after activation and restore mutable files on failure" },
      { label: "--runtime-urls <urls>", description: "Comma-separated deployed hosts to verify" },
      { label: "--publish-config <path>", description: "Publication adapter config (default: atlas.publish.ts)" },
      { label: "--dry-run", description: "Validate and print publication order without writes" },
      { label: "-h, --help", description: "Show help for this command" }
    ],
    examples: ["atlas publish --plan dist/atlas-publication.json --dry-run", "atlas publish --plan dist/atlas-publication.json"]
  },
  release: {
    summary: "Build and publish one versioned host client or app.",
    usage: "atlas release <project> [build and publish options]",
    arguments: [{ label: "project", description: "Host or app project name" }],
    options: [
      { label: "--version <version>", description: "Human release version" },
      { label: "--build-id <id>", description: "Exact immutable build identifier" },
      { label: "--channel <channel>", description: "production or pr" },
      { label: "--pr-number <number>", description: "Pull request number for a PR release" },
      { label: "--runtime-url <url>", description: "Verify after activation and restore mutable files on failure" },
      { label: "--dry-run", description: "Build and preview publication without upload" }
    ],
    examples: ["atlas release customer-host", "atlas release orders --channel pr"]
  },
  rollback: {
    summary: "Select and publish a previously released host-client or app build.",
    usage: "atlas rollback <artifact-id> --version <version> [options]",
    arguments: [{ label: "artifact-id", description: "Stable host or app ID from atlas.config.ts; prompted when omitted" }],
    options: [
      { label: "--version <version>", description: "Production version to restore; prompted when omitted" },
      { label: "--build-id <id>", description: "Specific build of the selected version" },
      { label: "--registry-base-url <url>", description: "Public base URL of the static registry" },
      { label: "--registry-snapshot <path>", description: "Existing registry snapshot to update" },
      { label: "--expected-registry-revision <hash>", description: "Reject conflicting registry updates" },
      { label: "--dry-run", description: "Preview selected files without mutation" },
      { label: "--prepare-only", description: "Write rollback files and plan without publishing" },
      { label: "--runtime-url <url>", description: "Verify rollback and restore the prior selection on failure" },
      { label: "-h, --help", description: "Show help for this command" }
    ],
    advancedOptions: [
      { label: "--publication-directory <path>", description: "Override the publication output directory" },
      { label: "--publication-plan <path>", description: "Override the publication plan output path" }
    ],
    examples: [
      "atlas rollback 2bea9c13-4899-4f93-9211-cd8c55e9c529 --version 1.3.2 --registry-base-url https://cdn.example.com/atlas",
      "atlas rollback 2bea9c13-4899-4f93-9211-cd8c55e9c529 --version 1.3.2 --build-id 1.3.2-a81f29c204e1"
    ]
  },
  verify: {
    summary: "Verify a deployed Atlas host, catalog, manifests, and assets.",
    usage: "atlas verify --runtime-url <url> [options]",
    options: [
      { label: "--runtime-url <url>", description: "Deployed atlas.runtime.json URL (required)" },
      { label: "--host-origin <url>", description: "Expected host origin used for policy checks" },
      { label: "-h, --help", description: "Show help for this command" }
    ],
    examples: [
      "atlas verify --runtime-url https://customer.example/atlas.runtime.json",
      "atlas verify --runtime-url https://customer.example/atlas.runtime.json --host-origin https://customer.example"
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
      { label: "--directory <path>", description: type === "host" ? "Host-client target; server uses sibling <path>-server" : "Target directory" },
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
