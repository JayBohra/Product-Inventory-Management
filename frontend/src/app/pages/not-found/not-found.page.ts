import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="container">
      <div class="empty-state">
        <span class="emoji" aria-hidden="true">🧭</span>
        <h1>Page not found</h1>
        <p class="muted">The link may be mistyped. Lists live at addresses like /l/abc123.</p>
        <a routerLink="/" class="btn btn-primary">Go home</a>
      </div>
    </div>
  `,
})
export class NotFoundPage {}
