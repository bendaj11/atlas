import {
  Directive,
  DestroyRef,
  effect,
  ElementRef,
  ErrorHandler,
  inject,
  input,
} from '@angular/core';
import { AngularWidgetOutletController } from './angular-widget-outlet-controller.js';
import type { AngularWidgetBinding } from './angular-widget.types.js';

@Directive({ selector: '[atlasWidget]', standalone: true })
export class WidgetOutlet<TInputs extends object> {
  readonly atlasWidget = input.required<AngularWidgetBinding<TInputs>>();

  private readonly container =
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly destroyRef = inject(DestroyRef);
  private readonly errorHandler = inject(ErrorHandler);
  private readonly controller = new AngularWidgetOutletController<TInputs>(
    this.container,
    (error) => this.errorHandler.handleError(error),
  );

  constructor() {
    effect(() => {
      void this.controller.render(this.atlasWidget());
    });

    this.destroyRef.onDestroy(() => {
      void this.controller.destroy();
    });
  }
}
