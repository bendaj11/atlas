import type { Page } from '@playwright/test';

type Framework = 'React' | 'Angular';

interface WidgetScenario {
  readonly hostFramework: Framework;
  readonly widgetFramework: Framework;
}

const reactHostPort = process.env.ATLAS_E2E_REACT_HOST_PORT ?? '4300';
const angularHostPort = process.env.ATLAS_E2E_ANGULAR_HOST_PORT ?? '4301';

export class HostWidgetsDriver {
  constructor(
    private readonly page: Page,
    private readonly scenario: WidgetScenario,
  ) {}

  readonly when = {
    openHost: async () => {
      this.page.setDefaultTimeout(15000);

      const port =
        this.scenario.hostFramework === 'React'
          ? reactHostPort
          : angularHostPort;
      await this.page.goto(`http://127.0.0.1:${port}/dashboard`);
      await this.get.gallery().waitFor({ state: 'visible' });
    },
    showWidget: async () => {
      await this.get
        .gallery()
        .getByRole('button', {
          name: `Show ${this.scenario.widgetFramework} widget`,
        })
        .click();
      await this.get
        .widget()
        .getByText(this.get.initialText(), { exact: true })
        .waitFor({ state: 'visible' });
    },
    updateWidget: async () => {
      await this.get
        .gallery()
        .getByRole('button', {
          name: `Update ${this.scenario.widgetFramework} widget`,
        })
        .click();
      await this.get
        .widget()
        .getByText(this.get.updatedText(), { exact: true })
        .waitFor({ state: 'visible' });
    },
    hideWidget: async () => {
      await this.get
        .gallery()
        .getByRole('button', {
          name: `Hide ${this.scenario.widgetFramework} widget`,
        })
        .click();
      await this.get.widget().waitFor({ state: 'detached' });
    },
  };

  readonly get = {
    gallery: () =>
      this.page.getByRole('region', {
        name: 'Host widgets',
        exact: true,
      }),
    widget: () =>
      this.get.gallery().getByRole('region', {
        name: `${this.scenario.widgetFramework} widget`,
        exact: true,
      }),
    initialText: () =>
      this.scenario.widgetFramework === 'React'
        ? 'Products: 12'
        : 'Status: pending',
    updatedText: () =>
      this.scenario.widgetFramework === 'React'
        ? 'Products: 24'
        : 'Status: paid',
    widgetText: () =>
      this.get
        .widget()
        .getByText(/^(Products: \d+|Status: \w+)$/)
        .textContent(),
    widgetCount: () => this.get.widget().count(),
  };
}
