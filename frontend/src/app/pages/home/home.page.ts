import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { IdentityStore } from '../../core/identity.store';
import { Icon } from '../../shared/icon';

@Component({
  selector: 'app-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage {
  protected readonly identity = inject(IdentityStore);

  protected forget(slug: string, title: string | null, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (confirm(`Remove "${title ?? 'this list'}" from this device? The list itself is not deleted.`)) {
      this.identity.forget(slug);
    }
  }
}
