import { Location } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

import { ApiError } from '../../core/api-error';
import { IdentityStore } from '../../core/identity.store';
import { copyText, inviteText, shareUrl, tokenFromFragment, whatsappUrl } from '../../core/share';
import { ToastService } from '../../core/toast.service';
import { Icon } from '../../shared/icon';
import { QrCode } from '../../shared/qr-code';
import { ItemEditor } from './item-editor';
import { ItemRow } from './item-row';
import { JoinCard } from './join-card';
import { ListStore } from './list.store';
import { PeoplePanel } from './people-panel';
import { SettingsDialog } from './settings-dialog';
import { ShareDialog } from './share-dialog';

type Tab = 'items' | 'people';

@Component({
  selector: 'app-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ListStore],
  host: { '[class.has-bar]': 'store.joined()' },
  imports: [
    RouterLink,
    Icon,
    QrCode,
    ItemRow,
    ItemEditor,
    JoinCard,
    PeoplePanel,
    ShareDialog,
    SettingsDialog,
  ],
  templateUrl: './list.page.html',
  styleUrl: './list.page.scss',
})
export class ListPage {
  protected readonly store = inject(ListStore);
  private readonly identity = inject(IdentityStore);
  private readonly toast = inject(ToastService);
  private readonly title = inject(Title);
  private readonly location = inject(Location);

  /** From the route: /l/:slug */
  readonly slug = input.required<string>();

  protected readonly tab = signal<Tab>('items');
  protected readonly editingId = signal<number | null>(null);

  private readonly shareDialog = viewChild(ShareDialog);
  private readonly settingsDialog = viewChild(SettingsDialog);

  protected readonly shareLink = computed(() => shareUrl(this.slug()));
  protected readonly whatsapp = computed(() =>
    whatsappUrl(inviteText(this.store.view()?.title ?? 'our list', this.shareLink())),
  );

  /** Short descriptions of the host's rules, shown as chips under the title. */
  protected readonly rules = computed(() => {
    const view = this.store.view();
    if (!view) return [];
    const rules: string[] = [];
    const max = view.settings.maxPerParticipant;
    if (max !== null) rules.push(max === 1 ? '1 item per person' : `Up to ${max} items per person`);
    if (!view.settings.allowMultiplePerItem) rules.push('One of each item');
    if (!view.settings.showClaimants) rules.push('Picks are private');
    if (view.items.some((item) => item.quantityLimit !== null)) rules.push('Limited quantities');
    return rules;
  });

  protected readonly myPicks = computed(() =>
    this.store
      .items()
      .filter((item) => item.quantity > 0)
      .map((item) => ({ id: item.id, name: item.name, quantity: item.quantity })),
  );

  protected readonly remainingText = computed(() => {
    const remaining = this.store.myRemaining();
    if (remaining === null) return null;
    if (remaining === 0) return "You've reached the limit";
    return `${remaining} more allowed`;
  });

  constructor() {
    effect(() => {
      const slug = this.slug();
      untracked(() => {
        // A private "use on another device" link carries the token in the URL fragment.
        const token = tokenFromFragment(location.hash);
        if (token) {
          this.identity.save({ slug, token });
          this.location.replaceState(`/l/${slug}`);
        }
        this.editingId.set(null);
        this.tab.set('items');
        this.store.open(slug);
      });
    });

    effect(() => {
      const view = this.store.view();
      if (view) this.title.setTitle(`${view.title} · ShareList`);
    });

    // Right after creating a list, open the share options once.
    effect(() => {
      const view = this.store.view();
      if (!view || untracked(() => this.identity.justCreated()) !== view.slug) return;
      untracked(() => {
        this.identity.justCreated.set(null);
        setTimeout(() => this.shareDialog()?.open());
      });
    });
  }

  protected openShare(): void {
    this.shareDialog()?.open();
  }

  protected openSettings(): void {
    this.settingsDialog()?.open();
  }

  protected async copyLink(): Promise<void> {
    if (await copyText(this.shareLink())) {
      this.toast.success('Link copied');
    }
  }

  protected async rename(): Promise<void> {
    const current = this.store.me()?.name ?? '';
    const name = prompt('Change your name', current)?.trim();
    if (!name || name === current) return;
    try {
      await this.store.rename(name.slice(0, 40));
      this.toast.success('Name updated');
    } catch (error) {
      this.toast.error(ApiError.from(error).message);
    }
  }

  protected async leave(): Promise<void> {
    if (!confirm('Leave this list? Everything you picked will be given back.')) return;
    try {
      await this.store.leave();
      this.toast.info('You left the list');
    } catch (error) {
      this.toast.error(ApiError.from(error).message);
    }
  }

  protected retry(): void {
    this.store.open(this.slug());
  }
}
