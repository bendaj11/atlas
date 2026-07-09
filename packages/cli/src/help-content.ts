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
  { label: "build", description: "Build an app for static deployment" },
  { label: "runtime-config", description: "Generate atlas.runtime.json from atlas.config.ts" },
  { label: "rollback", description: "Prepare a previous app version for deployment" },
  { label: "verify", description: "Verify a deployed Atlas host and its assets" }
];

export const ROOT_EXAMPLES = [
  "atlas g host customer-host",
  "atlas g app orders",
  "atlas dev customer-host",
  "atlas dev orders --host customer-host",
  "atlas runtime-config customer-host",
  "atlas build orders"
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
  "generate host": generationProjectHelp("host", "host application"),
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
      { label: "--port <number>", description: "App dev-server port (default: 4201)" },
      { label: "--control-port <number>", description: "Atlas override-server port (default: 4400)" },
      { label: "--no-open", description: "Do not open the resolved host URL automatically" },
      { label: "--prepare-only", description: "Create the override without starting development servers" },
      { label: "-h, --help", description: "Show help for this command" }
    ],
    environment: [
      { label: "ATLAS_HOST", description: "Default host id when an app supports multiple hosts" },
      { label: "ATLAS_HOST_URL", description: "Exact host page URL opened with the override activated" },
      { label: "ATLAS_HOST_ORIGIN", description: "Host origin; Atlas appends the configured route base path" }
    ],
    examples: [
      "atlas dev customer-host",
      "atlas dev orders",
      "atlas dev",
      "ATLAS_HOST_ORIGIN=http://localhost:4200 atlas dev orders",
      "atlas dev orders --host customer-host --host-url https://customer.example/orders"
    ]
  },
  build: {
    summary: "Build an app and prepare files for static deployment.",
    usage: "atlas build <project> [options]",
    arguments: [{ label: "project", description: "Atlas project name or directory; prompted when omitted" }],
    options: [
      { label: "--registry-base-url <url>", description: "Public base URL of the static registry" },
      { label: "--registry-snapshot <path>", description: "Existing registry snapshot to update" },
      { label: "--expected-registry-revision <hash>", description: "Reject conflicting registry updates" },
      { label: "--include-source-maps", description: "Include source maps in the publication" },
      { label: "--version <version>", description: "Version assigned to the build" },
      { label: "--build-id <id>", description: "Unique build identifier" },
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
  "runtime-config": {
    summary: "Generate a host atlas.runtime.json from atlas.config.ts.",
    usage: "atlas runtime-config <host> [options]",
    arguments: [{ label: "host", description: "Atlas host project name or directory; prompted when omitted" }],
    options: [
      { label: "--out <path>", description: "Runtime JSON output path (default: <host>/public/atlas.runtime.json)" },
      { label: "--registry-base-url <url>", description: "Public base URL used to derive the host catalog URL" },
      { label: "--skip-compile", description: "Read an existing compiled atlas.config.js" },
      { label: "-h, --help", description: "Show help for this command" }
    ],
    examples: [
      "atlas runtime-config customer-host --registry-base-url https://cdn.example.com/atlas",
      "atlas runtime-config customer-host --registry-base-url https://cdn.example.com/atlas --out dist/customer-host/atlas.runtime.json"
    ]
  },
  rollback: {
    summary: "Prepare a previously published app version for redeployment.",
    usage: "atlas rollback <project> --version <version> [options]",
    arguments: [{ label: "project", description: "Atlas project name; prompted when omitted" }],
    options: [
      { label: "--version <version>", description: "Production version to restore; prompted when omitted" },
      { label: "--build-id <id>", description: "Specific build of the selected version" },
      { label: "--registry-base-url <url>", description: "Public base URL of the static registry" },
      { label: "--registry-snapshot <path>", description: "Existing registry snapshot to update" },
      { label: "--expected-registry-revision <hash>", description: "Reject conflicting registry updates" },
      { label: "-h, --help", description: "Show help for this command" }
    ],
    advancedOptions: [
      { label: "--publication-directory <path>", description: "Override the publication output directory" },
      { label: "--publication-plan <path>", description: "Override the publication plan output path" }
    ],
    examples: [
      "atlas rollback orders --version 1.3.2 --registry-base-url https://cdn.example.com/atlas",
      "atlas rollback orders --version 1.3.2 --build-id 1.3.2-a81f29c204e1"
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
      ...(type === "app" ? [{ label: "--host <host-id>", description: "Host id used for the generated route" }] : []),
      ...(type === "app" ? [{ label: "--routing, --no-routing", description: "Create Atlas inner route files or a single-page app; prompted when omitted in interactive mode" }] : []),
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
