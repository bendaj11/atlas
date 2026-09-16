import { PortsDriver } from './ports.driver.js';

describe('suggestedDevServerPort', () => {
  let driver: PortsDriver;

  beforeEach(async () => {
    driver = new PortsDriver();

    await driver.given.workspace();
  });

  it('should suggest the default host port when no project uses it', async () => {
    expect(await driver.get.suggestedPort('host')).toBe(4200);
  });

  it('should skip ports declared in project.json targets when occupied', async () => {
    await driver.given.projectFile(
      'orders',
      'project.json',
      JSON.stringify({ targets: { serve: { options: { port: 4201 } } } }),
    );

    expect(await driver.get.suggestedPort('app')).toBe(4202);
  });

  it('should skip ports declared in angular.json projects when occupied', async () => {
    await driver.given.projectFile(
      'shell',
      'angular.json',
      JSON.stringify({
        projects: {
          shell: { architect: { serve: { options: { port: 4200 } } } },
        },
      }),
    );

    expect(await driver.get.suggestedPort('host')).toBe(4201);
  });

  it('should skip ports declared in vite.config.ts when occupied', async () => {
    await driver.given.projectFile(
      'orders',
      'vite.config.ts',
      'export default { server: { port: 4201 } };',
    );

    expect(await driver.get.suggestedPort('app')).toBe(4202);
  });

  it('should ignore malformed project.json when scanning', async () => {
    await driver.given.projectFile('orders', 'project.json', '{ nope');

    expect(await driver.get.suggestedPort('app')).toBe(4201);
  });
});
