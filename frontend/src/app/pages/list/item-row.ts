import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { Icon } from '../../shared/icon';
import { ItemState, ListStore } from './list.store';

type Tone = 'neutral' | 'ok' | 'low' | 'out';

/** One item with its availability and the +/− (or Pick) control. */
@Component({
  selector: 'app-item-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  templateUrl: './item-row.html',
  styleUrl: './item-row.scss',
})
export class ItemRow {
  protected readonly store = inject(ListStore);

  readonly item = input.required<ItemState>();
  /** People can take several of this item (shows a stepper instead of a Pick button). */
  readonly multiple = input(true);
  readonly editable = input(false);
  readonly edit = output<void>();

  /** Units taken by everyone, including this person's unsaved taps. */
  protected readonly claimedNow = computed(() => {
    const item = this.item();
    return item.claimed + item.quantity - item.myQuantity;
  });

  protected readonly tone = computed<Tone>(() => {
    const { left, quantityLimit } = this.item();
    if (left === null || quantityLimit === null) return 'neutral';
    if (left === 0) return 'out';
    return left <= Math.max(1, Math.ceil(quantityLimit * 0.2)) ? 'low' : 'ok';
  });

  protected readonly availability = computed(() => {
    const { left, quantityLimit } = this.item();
    if (left === null || quantityLimit === null) {
      const claimed = this.claimedNow();
      return claimed > 0 ? `${claimed} picked` : 'No limit';
    }
    if (left === 0) return 'All taken';
    if (this.tone() === 'low') return `Only ${left} left`;
    return `${left} of ${quantityLimit} left`;
  });

  /** "You ×2, Asha, Ravi ×3" — only when the viewer may see who took what. */
  protected readonly claimants = computed(() => {
    const item = this.item();
    if (!item.claims?.length) return null;
    const myId = this.store.me()?.id;
    return item.claims
      .map((claim) => {
        const name = claim.participantId === myId ? 'You' : claim.name;
        return claim.quantity > 1 ? `${name} ×${claim.quantity}` : name;
      })
      .join(', ');
  });

  protected readonly soldOut = computed(() => this.item().left === 0 && this.item().quantity === 0);
}
