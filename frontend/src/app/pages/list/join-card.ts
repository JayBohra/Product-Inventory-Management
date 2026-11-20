import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormField, FormRoot, form, maxLength, required } from '@angular/forms/signals';

import { ApiError } from '../../core/api-error';
import { IdentityStore } from '../../core/identity.store';
import { ToastService } from '../../core/toast.service';
import { ListStore } from './list.store';

/** Asks a visitor for their name before they can pick anything. */
@Component({
  selector: 'app-join-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, FormRoot],
  template: `
    <section class="join card" aria-labelledby="join-heading">
      @if (closed()) {
        <h2 id="join-heading">This list is closed</h2>
        <p class="muted">{{ hostName() }} has stopped changes for now, so you can't join yet.</p>
      } @else {
        <div class="join-text">
          <h2 id="join-heading">Join to pick</h2>
          <p class="muted">
            Enter your name so {{ hostName() }} knows what you picked. No sign-up needed.
          </p>
        </div>
        <form [formRoot]="joinForm" class="join-form">
          <input
            class="input"
            [formField]="joinForm.name"
            placeholder="Your name"
            aria-label="Your name"
            autocomplete="given-name"
            enterkeyhint="go"
          />
          <button type="submit" class="btn btn-primary" [disabled]="joinForm().submitting()">
            {{ joinForm().submitting() ? 'Joining…' : 'Join' }}
          </button>
        </form>
        @if (error(); as message) {
          <p class="error-text">{{ message }}</p>
        }
      }
    </section>
  `,
  styles: `
    .join {
      display: grid;
      gap: 14px;
      padding: 20px;
      border-color: color-mix(in srgb, var(--primary) 40%, var(--border));
      background: linear-gradient(
        135deg,
        var(--surface),
        color-mix(in srgb, var(--primary-soft) 70%, var(--surface))
      );

      @media (min-width: 760px) {
        grid-template-columns: 1fr minmax(320px, 420px);
        align-items: center;
        padding: 24px;
      }
    }
    .join-text {
      display: grid;
      gap: 4px;
    }
    .join-form {
      display: flex;
      gap: 8px;
    }
    .join-form .input {
      flex: 1;
      min-width: 0;
    }
    .error-text {
      grid-column: 1 / -1;
    }
  `,
})
export class JoinCard {
  private readonly store = inject(ListStore);
  private readonly toast = inject(ToastService);

  readonly hostName = input.required<string>();
  readonly closed = input(false);

  protected readonly model = signal({
    name: inject(IdentityStore).recent().find((list) => list.name)?.name ?? '',
  });
  protected readonly joinForm = form(
    this.model,
    (path) => {
      required(path.name, { message: 'Please enter your name.' });
      maxLength(path.name, 40, { message: 'Keep it under 40 characters.' });
    },
    {
      submission: {
        action: async () => {
          try {
            await this.store.join(this.model().name.trim());
            this.toast.success(`Welcome, ${this.model().name.trim()}! Pick what you'd like.`);
          } catch (error) {
            this.toast.error(ApiError.from(error).message);
          }
          return undefined;
        },
      },
    },
  );

  protected error(): string | null {
    const state = this.joinForm.name();
    return state.touched() && state.invalid() ? (state.errors()[0]?.message ?? null) : null;
  }
}
