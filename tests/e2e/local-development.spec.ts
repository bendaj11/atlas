import { expect, test, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";

const PROCESS_START_TIMEOUT = 120_000;
const PROCESS_STOP_TIMEOUT = 15_000;
const MF_MOUNT_TIMEOUT = 15_000;

interface LocalDevelopmentCase {
  app: string;
  heading: string;
  hostId: string;
  hostUrl: string;
  remotePort: number;
  controlPort: number;
}

const cases: LocalDevelopmentCase[] = [
  {
    app: "dashboard-react",
    heading: "Dashboard React",
    hostId: "demo-react-host",
    hostUrl: "http://127.0.0.1:4300/dashboard",
    remotePort: 4211,
    controlPort: 4411
  },
  {
    app: "dashboard-angular",
    heading: "Dashboard Angular",
    hostId: "demo-angular-host",
    hostUrl: "http://127.0.0.1:4301/dashboard-angular",
    remotePort: 4212,
    controlPort: 4412
  }
];

test.describe("atlas dev", () => {
  test.describe.configure({ mode: "serial", timeout: PROCESS_START_TIMEOUT });

  for (const scenario of cases) {
    test(`renders the local ${scenario.app} inside its host and shuts down cleanly`, async ({ page }) => {
      const process = startAtlasDev(scenario);
      try {
        await waitForHealthyControlServer(scenario.controlPort, process);
        const remoteEntryRequest = waitForRemoteEntry(page, scenario.remotePort);
        await page.goto(activationUrl(scenario));
        await remoteEntryRequest;
        await expect(page.getByRole("heading", { name: scenario.heading })).toBeVisible({
          timeout: MF_MOUNT_TIMEOUT
        });
      } finally {
        await stopAtlasDev(process);
      }

      await expectPortReleased(scenario.controlPort);
      await expectPortReleased(scenario.remotePort);
    });
  }
});

function startAtlasDev(scenario: LocalDevelopmentCase): ChildProcess {
  return spawn(process.execPath, [
    "packages/cli/dist/index.js",
    "dev",
    scenario.app,
    `--host=${scenario.hostId}`,
    `--host-url=${scenario.hostUrl}`,
    `--port=${scenario.remotePort}`,
    `--control-port=${scenario.controlPort}`
  ], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });
}

async function waitForHealthyControlServer(port: number, process: ChildProcess): Promise<void> {
  const output: string[] = [];
  process.stdout?.on("data", (chunk: Buffer) => output.push(chunk.toString()));
  process.stderr?.on("data", (chunk: Buffer) => output.push(chunk.toString()));

  const deadline = Date.now() + PROCESS_START_TIMEOUT;
  while (Date.now() < deadline) {
    if (process.exitCode !== null) {
      throw new Error(`atlas dev exited before startup.\n${output.join("")}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return;
    } catch {
      await delay(200);
    }
  }
  throw new Error(`atlas dev did not become healthy.\n${output.join("")}`);
}

function waitForRemoteEntry(page: Page, port: number): Promise<void> {
  return page.waitForRequest(
    (request) => request.url() === `http://localhost:${port}/remoteEntry.json`,
    { timeout: PROCESS_START_TIMEOUT }
  ).then(() => undefined);
}

function activationUrl(scenario: LocalDevelopmentCase): string {
  const host = new URL(scenario.hostUrl);
  host.searchParams.set("atlas-override", `http://localhost:${scenario.controlPort}/atlas.local-overrides.json`);
  return host.toString();
}

async function stopAtlasDev(process: ChildProcess): Promise<void> {
  if (process.exitCode !== null || process.signalCode !== null) return;
  process.kill("SIGINT");
  await Promise.race([
    new Promise<void>((resolve, reject) => {
      process.once("exit", (code, signal) => {
        if (code === 0 || signal === "SIGINT" || signal === "SIGTERM") resolve();
        else reject(new Error(`atlas dev exited with code ${code ?? "unknown"}.`));
      });
    }),
    delay(PROCESS_STOP_TIMEOUT).then(() => {
      process.kill("SIGKILL");
      throw new Error("atlas dev did not stop within 15 seconds.");
    })
  ]);
}

async function expectPortReleased(port: number): Promise<void> {
  await expect.poll(async () => {
    try {
      await fetch(`http://127.0.0.1:${port}/health`);
      return false;
    } catch {
      return true;
    }
  }).toBe(true);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
