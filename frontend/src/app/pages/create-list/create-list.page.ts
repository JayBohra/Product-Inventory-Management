import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  FieldTree,
  FormField,
  FormRoot,
  applyEach,
  form,
  max,
  maxLength,
  min,
  required,
  validate,
} from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';

import { ApiError } from '../../core/api-error';
import { ApiService } from '../../core/api.service';
import { IdentityStore } from '../../core/identity.store';
import { CreateListRequest } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { Icon } from '../../shared/icon';

interface ItemDraft {
  name: string;
  /** Total available; null means unlimited. */
  limit: number | null;
}

export type PerPerson = 'none' | 'one' | 'custom';

export interface ListDraft {
  title: string;
  description: string;
  hostName: string;
  items: ItemDraft[];
  allowMultiple: boolean;
  perPerson: PerPerson;
  customLimit: number | null;
  showClaimants: boolean;
}

const emptyItem = (): ItemDraft => ({ name: '', limit: null });

/** Turns the form draft into the API request, dropping empty item rows. */
export function toRequest(draft: ListDraft): CreateListRequest {
  return {
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    hostName: draft.hostName.trim(),
    settings: {
      allowMultiplePerItem: draft.allowMultiple,
      maxPerParticipant:
        draft.perPerson === 'one' ? 1 : draft.perPerson === 'custom' ? draft.customLimit : null,
      showClaimants: draft.showClaimants,
    },
    items: draft.items
      .filter((item) => item.name.trim())
      .map((item) => ({ name: item.name.trim(), note: null, quantityLimit: item.limit })),
  };
}

@Component({
  selector: 'app-create-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, FormRoot, RouterLink, Icon],
  templateUrl: './create-list.page.html',
  styleUrl: './create-list.page.scss',
})
export class CreateListPage {
  private readonly api = inject(ApiService);
  private readonly identity = inject(IdentityStore);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly model = signal<ListDraft>({
    title: '',
    description: '',
    hostName: this.identity.recent().find((list) => list.name)?.name ?? '',
    items: [emptyItem(), emptyItem(), emptyItem()],
    allowMultiple: true,
    perPerson: 'none',
    customLimit: 2,
    showClaimants: true,
  });

  protected readonly draftForm = form(
    this.model,
    (path) => {
      required(path.title, { message: 'Give your list a name.' });
      maxLength(path.title, 120, { message: 'Keep the name under 120 characters.' });
      maxLength(path.description, 1000, { message: 'Keep the description under 1000 characters.' });
      required(path.hostName, { message: 'Tell people who is hosting.' });
      maxLength(path.hostName, 40, { message: 'Keep your name under 40 characters.' });
      applyEach(path.items, (item) => {
        maxLength(item.name, 120, { message: 'Too long.' });
        min(item.limit, 0, { message: "Can't be negative." });
        max(item.limit, 100000, { message: 'That is a lot! Max 100000.' });
        validate(item.name, ({ value, valueOf }) => {
          const name = value().trim().toLowerCase();
          if (!name) return undefined;
          const same = valueOf(path.items).filter((other) => other.name.trim().toLowerCase() === name);
          return same.length > 1 ? { kind: 'duplicate', message: 'Already on the list.' } : undefined;
        });
      });
      validate(path.items, ({ value }) =>
        value().some((item) => item.name.trim())
          ? undefined
          : { kind: 'noItems', message: 'Add at least one item.' },
      );
      // The custom number only matters (and is only validated) when "Custom" is selected.
      required(path.customLimit, {
        when: ({ valueOf }) => valueOf(path.perPerson) === 'custom',
        message: 'Enter a number.',
      });
      min(path.customLimit, 1, {
        when: ({ valueOf }) => valueOf(path.perPerson) === 'custom',
        message: 'At least 1.',
      });
      max(path.customLimit, 1000, {
        when: ({ valueOf }) => valueOf(path.perPerson) === 'custom',
        message: 'At most 1000.',
      });
    },
    {
      submission: {
        action: async () => {
          await this.create();
          return undefined;
        },
        onInvalid: () => this.focusFirstInvalid(),
      },
    },
  );

  protected readonly namedItems = computed(
    () => this.model().items.filter((item) => item.name.trim()).length,
  );

  protected addItem(afterIndex = this.model().items.length - 1): void {
    this.model.update((draft) => {
      const items = [...draft.items];
      items.splice(afterIndex + 1, 0, emptyItem());
      return { ...draft, items };
    });
    this.focusItem(afterIndex + 1);
  }

  protected removeItem(index: number): void {
    this.model.update((draft) => {
      const items = draft.items.filter((_, i) => i !== index);
      return { ...draft, items: items.length ? items : [emptyItem()] };
    });
  }

  /** Enter in an item name jumps to a fresh row, like a checklist app. */
  protected onItemEnter(event: Event, index: number): void {
    event.preventDefault();
    const next = this.model().items[index + 1];
    if (next && !next.name.trim()) {
      this.focusItem(index + 1);
    } else {
      this.addItem(index);
    }
  }

  /** Pasting several lines creates one item per line. */
  protected onItemPaste(event: ClipboardEvent, index: number): void {
    const text = event.clipboardData?.getData('text') ?? '';
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
      .filter(Boolean);
    if (lines.length < 2) return;
    event.preventDefault();
    this.model.update((draft) => {
      const items = [...draft.items];
      const current = items[index];
      const prefix = current.name.trim() ? [current] : [];
      const pasted = lines.map((name) => ({ ...emptyItem(), name: name.slice(0, 120) }));
      items.splice(index, 1, ...prefix, ...pasted);
      return { ...draft, items };
    });
    this.toast.info(`Added ${lines.length} items`);
  }

  protected firstError(field: FieldTree<unknown>): string | null {
    const state = field();
    if (!state.touched() || !state.invalid()) return null;
    return state.errors()[0]?.message ?? 'Check this field.';
  }

  private async create(): Promise<void> {
    try {
      const request = toRequest(this.model());
      const created = await this.api.createList(request);
      const slug = created.list.slug;
      this.identity.save({
        slug,
        token: created.token,
        title: created.list.title,
        name: request.hostName,
        host: true,
      });
      this.identity.justCreated.set(slug);
      await this.router.navigate(['/l', slug]);
    } catch (error) {
      this.toast.error(ApiError.from(error).message);
    }
  }

  private focusItem(index: number): void {
    afterNextRender(
      () => this.host.nativeElement.querySelectorAll<HTMLInputElement>('.item-name')[index]?.focus(),
      { injector: this.injector },
    );
  }

  private focusFirstInvalid(): void {
    afterNextRender(
      () =>
        this.host.nativeElement
          .querySelector<HTMLElement>('[aria-invalid="true"], .items-error')
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
      { injector: this.injector },
    );
  }
}
