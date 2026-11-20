import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ToastService } from '../core/toast.service';
import { Icon } from './icon';

@Component({
  selector: 'app-toast-outlet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <div class="toasts" role="status" aria-live="polite">
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="toast" [class]="'toast toast-' + toast.kind">
          @if (toast.kind === 'success') {
            <app-icon name="check" [size]="18" />
          }
          <span>{{ toast.message }}</span>
          <button
            type="button"
            class="toast-close"
            (click)="toasts.dismiss(toast.id)"
            aria-label="Dismiss"
          >
            <app-icon name="x" [size]="16" />
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .toasts {
      position: fixed;
      inset-inline: 0;
      bottom: calc(16px + env(safe-area-inset-bottom) + var(--toast-offset, 0px));
      z-index: 1000;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding-inline: 16px;
      pointer-events: none;
    }
    .toast {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 10px;
      max-width: min(480px, 100%);
      padding: 10px 8px 10px 16px;
      border-radius: 12px;
      background: var(--toast-bg);
      color: var(--toast-text);
      box-shadow: var(--shadow-lg);
      font-size: 0.95rem;
      animation: toast-in 160ms ease-out;
    }
    .toast-error {
      background: var(--danger);
      color: #fff;
    }
    .toast-success app-icon {
      color: var(--success-on-dark);
    }
    .toast span {
      flex: 1;
    }
    .toast-close {
      display: inline-grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: inherit;
      opacity: 0.75;
      cursor: pointer;
    }
    .toast-close:hover {
      opacity: 1;
    }
    @keyframes toast-in {
      from {
        transform: translateY(8px);
        opacity: 0;
      }
    }
  `,
})
export class ToastOutlet {
  protected readonly toasts = inject(ToastService);
}
