import { Component, Directive, ElementRef, inject, Input, Injectable, OnDestroy, OnInit } from "@angular/core";
import { AtlasHostAnchorRegistry, type AtlasHostAnchorKind } from "./host-anchors.js";

@Injectable({ providedIn: "root" })
export class AtlasAngularHostAnchors extends AtlasHostAnchorRegistry {}

@Directive()
abstract class AtlasAnchorComponent implements OnInit, OnDestroy {
  private release: (() => void) | undefined;
  protected readonly element = inject(ElementRef<HTMLElement>);
  protected readonly anchors = inject(AtlasAngularHostAnchors);

  protected abstract readonly kind: AtlasHostAnchorKind;
  protected anchorName(): string | undefined { return undefined; }

  ngOnInit(): void {
    this.release = this.anchors.register(this.kind, this.element.nativeElement, this.anchorName());
  }

  ngOnDestroy(): void { this.release?.(); }
}

@Component({ selector: "atlas-host-status", standalone: true, template: "" })
export class AtlasHostStatus extends AtlasAnchorComponent { protected readonly kind = "status" as const; }

@Component({ selector: "atlas-navigation", standalone: true, template: "" })
export class AtlasNavigation extends AtlasAnchorComponent { protected readonly kind = "navigation" as const; }

@Component({ selector: "atlas-route-outlet", standalone: true, template: "" })
export class AtlasRouteOutlet extends AtlasAnchorComponent { protected readonly kind = "route-outlet" as const; }

@Component({ selector: "atlas-slot", standalone: true, template: "" })
export class AtlasSlot extends AtlasAnchorComponent {
  protected readonly kind = "slot" as const;
  @Input({ required: true }) slotId!: string;
  protected anchorName(): string { return this.slotId; }
}
