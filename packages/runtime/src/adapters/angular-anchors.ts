import { NgComponentOutlet } from '@angular/common';
import {
  Component,
  Directive,
  ElementRef,
  inject,
  InjectionToken,
  Input,
  Injectable,
  OnDestroy,
  OnInit,
  signal,
  TemplateRef,
  Type,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AtlasHostAnchorRegistry } from '../dom-host/host-anchors.js';
import type {
  AtlasHostAnchorKind,
  UnsubscribeAnchorListener,
} from '../dom-host/host-anchors.types.js';

export const ATLAS_NOT_FOUND_COMPONENT = new InjectionToken<Type<unknown>>(
  'ATLAS_NOT_FOUND_COMPONENT',
);

@Injectable({ providedIn: 'root' })
export class AtlasAngularHostAnchors extends AtlasHostAnchorRegistry {}

@Directive()
abstract class AtlasAnchorComponent implements OnInit, OnDestroy {
  private release: (() => void) | undefined;
  protected readonly element = inject(ElementRef<HTMLElement>);
  protected readonly anchors = inject(AtlasAngularHostAnchors);

  protected abstract readonly kind: AtlasHostAnchorKind;
  protected anchorName(): string | undefined {
    return undefined;
  }

  protected anchorElement(): HTMLElement {
    return this.element.nativeElement;
  }

  ngOnInit(): void {
    this.release = this.anchors.register(
      this.kind,
      this.anchorElement(),
      this.anchorName(),
    );
  }

  ngOnDestroy(): void {
    this.release?.();
  }
}

@Component({ selector: 'atlas-host-status', standalone: true, template: '' })
export class AtlasHostStatus extends AtlasAnchorComponent {
  protected readonly kind = 'status' as const;
}

@Component({ selector: 'atlas-navigation', standalone: true, template: '' })
export class AtlasNavigation extends AtlasAnchorComponent {
  protected readonly kind = 'navigation' as const;
}

@Component({
  selector: 'atlas-default-not-found',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section data-atlas-not-found>
      <h1>Page not found</h1>
      <a routerLink="/">Go to the home page</a>
    </section>
  `,
})
export class AtlasDefaultNotFound {}

@Component({
  selector: 'atlas-route-outlet',
  standalone: true,
  imports: [NgComponentOutlet],
  template: `
    <div #mount style="display: contents"></div>
    @if (routeNotFound()) {
      <ng-container *ngComponentOutlet="notFoundComponent" />
    }
  `,
})
export class AtlasRouteOutlet extends AtlasAnchorComponent {
  protected readonly kind = 'route-outlet' as const;
  protected readonly notFoundComponent =
    inject(ATLAS_NOT_FOUND_COMPONENT, { optional: true }) ??
    AtlasDefaultNotFound;
  protected readonly routeNotFound = signal(this.anchors.isRouteNotFound());
  @ViewChild('mount', { static: true })
  private readonly mount!: ElementRef<HTMLElement>;
  private unsubscribeRouteNotFound: UnsubscribeAnchorListener | undefined;

  override ngOnInit(): void {
    super.ngOnInit();

    this.unsubscribeRouteNotFound = this.anchors.subscribeRouteNotFound(() =>
      this.routeNotFound.set(this.anchors.isRouteNotFound()),
    );
  }

  override ngOnDestroy(): void {
    this.unsubscribeRouteNotFound?.();

    super.ngOnDestroy();
  }

  protected override anchorElement(): HTMLElement {
    return this.mount.nativeElement;
  }
}

/** Structural layout boundary. Inactive layouts create no Atlas anchors. */
@Directive({ selector: '[atlasHostLayout]', standalone: true })
export class AtlasHostLayout implements OnInit, OnDestroy {
  private readonly template = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly anchors = inject(AtlasAngularHostAnchors);
  private unsubscribe: (() => void) | undefined;
  private layoutId: string | undefined;
  private initialized = false;

  @Input({ required: true })
  set atlasHostLayout(value: string) {
    this.layoutId = value;

    this.render();
  }

  ngOnInit(): void {
    this.initialized = true;
    this.unsubscribe = this.anchors.subscribeLayouts(() => this.render());

    this.render();
  }

  ngOnDestroy(): void {
    this.unsubscribe?.();

    this.viewContainer.clear();
  }

  private render(): void {
    if (!this.initialized) return;
    const isActive = this.anchors.getActiveLayout() === this.layoutId;

    if (isActive === this.viewContainer.length > 0) return;

    this.viewContainer.clear();

    if (isActive) this.viewContainer.createEmbeddedView(this.template);
  }
}

@Component({ selector: 'atlas-slot', standalone: true, template: '' })
export class AtlasSlot extends AtlasAnchorComponent {
  protected readonly kind = 'slot' as const;
  @Input({ required: true }) slotId!: string;
  protected anchorName(): string {
    return this.slotId;
  }
}
