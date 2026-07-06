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
  { label: "generate, g", description: "Generate a host, microfrontend, or exported widget" },
  { label: "dev", description: "Run a microfrontend locally inside an Atlas host" },
  { label: "build", description: "Build a microfrontend for static deployment" },
  { label: "rollback", description: "Prepare a previous microfrontend version for deployment" },
  { label: "verify", description: "Verify a deployed Atlas host and its assets" }
];

export const ROOT_EXAMPLES = [
  "atlas g host customer-shell",
  "atlas g app orders",
  "atlas dev orders --host customer-shell",
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
    examples: ["atlas g host customer-shell", "atlas g app orders", "atlas g widget order-summary --app orders"]
  },
  "generate host": generationProjectHelp("host", "host application"),
  "generate app": generationProjectHelp("app", "microfrontend application"),
  "generate widget": {
    summary: "Generate an exported widget inside an existing microfrontend.",
    usage: "atlas generate widget <name> --app <project> [options]",
    arguments: [{ label: "name", description: "Widget name" }],
    options: [
      { label: "--app <project>", description: "Owning microfrontend name or directory" },
      { label: "--force", description: "Replace an existing widget with the same name" },
      { label: "-h, --help", description: "Show help for this command" }
    ],
    examples: ["atlas g widget order-summary --app orders"]
  },
  dev: {
    summary: "Run one microfrontend locally inside an Atlas host.",
    usage: "atlas dev <project> [options]",
    arguments: [{ label: "project", description: "Atlas project name or directory; prompted when omitted" }],
    options: [
      { label: "--host <host-id>", description: "Host receiving the local override" },
      { label: "--host-url <url>", description: "Host page opened with the override activated" },
      { label: "--port <number>", description: "Microfrontend dev-server port (default: 4201)" },
      { label: "--control-port <number>", description: "Atlas override-server port (default: 4400)" },
      { label: "--prepare-only", description: "Create the override without starting development servers" },
      { label: "-h, --help", description: "Show help for this command" }
    ],
    examples: [
      "atlas dev orders --host customer-shell",
      "atlas dev orders --host customer-shell --host-url https://customer.example/orders"
    ]
  },
  build: {
    summary: "Build a microfrontend and prepare files for static deployment.",
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
  rollback: {
    summary: "Prepare a previously published microfrontend version for redeployment.",
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
    usage: `atlas generate ${type} <name> [options]`,
    arguments: [{ label: "name", description: `Name of the ${resource}; prompted when omitted` }],
    options: [
      { label: "--framework <name>", description: "Framework: angular or react; prompted when omitted" },
      { label: "--framework-version <range>", description: "Framework semver range" },
      { label: "--directory <path>", description: "Target directory" },
      { label: "--allow-unsupported-version", description: "Generate outside Atlas's tested version range" },
      { label: "--force", description: "Write into an existing target directory" },
      { label: "-h, --help", description: "Show help for this command" }
    ],
    examples: [
      `atlas g ${type} ${type === "host" ? "customer-shell" : "orders"} --framework react`,
      `atlas g ${type} ${type === "host" ? "admin-shell" : "billing"} --framework angular`
    ]
  };
}
