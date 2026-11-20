import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormField, FormRoot, form, max, maxLength, min, required } from '@angular/forms/signals';

import { ApiError } from '../../core/api-error';
import { ListItem } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { Icon } from '../../shared/icon';
import { ListStore } from './list.store';

interface ItemDraft {
  name: string;
  note: string;
  limit: number | null;
}

/** Host-only form to add a new item or edit an existing one in place. */
@Component({
  selector: 'app-item-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, FormRoot, Icon],
  templateUrl: './item-editor.html',
  styleUrl: './item-editor.scss',
})
export class ItemEditor implements OnInit {
  private readonly store = inject(ListStore);
  private readonly toast = inject(ToastService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** The item being edited; leave unset to add a new one. */
  readonly item = input<ListItem | null>(null);
  readonly done = output<void>();

  protected readonly editing = computed(() => this.item() !== null);
  protected readonly index = computed(() => {
    const item = this.item();
    return item ? (this.store.view()?.items.findIndex((other) => other.id === item.id) ?? -1) : -1;
  });
  protected readonly count = computed(() => this.store.view()?.items.length ?? 0);
  protected readonly busy = signal(false);

  protected readonly model = signal<ItemDraft>({ name: '', note: '', limit: null });

  protected readonly itemForm = form(
    this.model,
    (path) => {
      required(path.name, { message: 'Give the item a name.' });
      maxLength(path.name, 120, { message: 'Too long.' });
      maxLength(path.note, 300, { message: 'Keep the note under 300 characters.' });
      min(path.limit, 0, { message: "Can't be negative." });
      max(path.limit, 100000, { message: 'Max 100000.' });
    },
    {
      submission: {
        action: async () => {
          await this.save();
          return undefined;
        },
      },
    },
  );

  constructor() {
    afterNextRender(() => {
      if (this.item()) this.host.nativeElement.querySelector<HTMLInputElement>('input')?.focus();
    });
  }

  /** Copies the item once: later live updates must not overwrite what the host is typing. */
  ngOnInit(): void {
    const item = this.item();
    if (item) {
      this.model.set({ name: item.name, note: item.note ?? '', limit: item.quantityLimit });
    }
  }

  protected error(): string | null {
    for (const field of [this.itemForm.name, this.itemForm.limit, this.itemForm.note]) {
      const state = field();
      if (state.touched() && state.invalid()) {
        return state.errors()[0]?.message ?? null;
      }
    }
    return null;
  }

  protected async move(offset: -1 | 1): Promise<void> {
    const item = this.item();
    if (!item) return;
    await this.attempt(() => this.store.moveItem(item.id, offset));
  }

  protected async remove(): Promise<void> {
    const item = this.item();
    if (!item) return;
    const taken = item.claimed > 0 ? ` ${item.claimed} picked will be given back.` : '';
    if (!confirm(`Remove "${item.name}" from the list?${taken}`)) return;
    if (await this.attempt(() => this.store.removeItem(item.id))) {
      this.toast.success(`Removed "${item.name}"`);
      this.done.emit();
    }
  }

  private async save(): Promise<void> {
    const draft = this.model();
    const input = {
      name: draft.name.trim(),
      note: draft.note.trim() || null,
      quantityLimit: draft.limit,
    };
    const item = this.item();
    const saved = await this.attempt(() =>
      item ? this.store.updateItem(item.id, input) : this.store.addItem(input),
    );
    if (!saved) return;
    if (item) {
      this.done.emit();
    } else {
      this.itemForm().reset({ name: '', note: '', limit: null });
      this.host.nativeElement.querySelector<HTMLInputElement>('input')?.focus();
    }
  }

  private async attempt(action: () => Promise<void>): Promise<boolean> {
    this.busy.set(true);
    try {
      await action();
      return true;
    } catch (error) {
      this.toast.error(ApiError.from(error).message);
      return false;
    } finally {
      this.busy.set(false);
    }
  }
}
