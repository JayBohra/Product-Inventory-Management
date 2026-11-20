import { Injectable, signal } from '@angular/core';

export type ToastKind = 'info' | 'success' | 'error';

export interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

/** Short, non-blocking messages shown at the bottom of the screen. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 1;

  info(message: string): void {
    this.show(message, 'info');
  }

  success(message: string): void {
    this.show(message, 'success');
  }

  error(message: string): void {
    this.show(message, 'error', 5000);
  }

  dismiss(id: number): void {
    this.toasts.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }

  private show(message: string, kind: ToastKind, durationMs = 3200): void {
    const id = this.nextId++;
    // Replace an identical message instead of stacking duplicates (e.g. repeated taps).
    this.toasts.update((toasts) => [
      ...toasts.filter((toast) => toast.message !== message).slice(-2),
      { id, message, kind },
    ]);
    setTimeout(() => this.dismiss(id), durationMs);
  }
}
