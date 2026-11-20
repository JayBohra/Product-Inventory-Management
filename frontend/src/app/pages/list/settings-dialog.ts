import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormField, FormRoot, form, max, maxLength, min, required } from '@angular/forms/signals';

import { ApiError } from '../../core/api-error';
import { ListView } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { Icon } from '../../shared/icon';
import { PerPerson } from '../create-list/create-list.page';
import { ListStore } from './list.store';

interface SettingsDraft {
  title: string;
  description: string;
  allowMultiple: boolean;
  perPerson: PerPerson;
  customLimit: number | null;
  showClaimants: boolean;
  closed: boolean;
}

function toDraft(view: ListView): SettingsDraft {
  const limit = view.settings.maxPerParticipant;
  return {
    title: view.title,
    description: view.description ?? '',
    allowMultiple: view.settings.allowMultiplePerItem,
    perPerson: limit === null ? 'none' : limit === 1 ? 'one' : 'custom',
    customLimit: limit !== null && limit > 1 ? limit : 2,
    showClaimants: view.settings.showClaimants,
    closed: view.closed,
  };
}

/** Host-only: rename the list, change its rules, close or delete it. */
@Component({
  selector: 'app-settings-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, FormRoot, Icon],
  templateUrl: './settings-dialog.html',
  styles: `
    .danger-zone {
      display: grid;
      gap: 10px;
      padding: 16px;
      border: 1px solid color-mix(in srgb, var(--danger) 35%, var(--border));
      border-radius: var(--radius);
      background: var(--danger-soft);
    }
    .danger-zone .btn {
      justify-self: start;
    }
    .switches {
      display: grid;
    }
    .per-person {
      flex-wrap: wrap;
      cursor: default;
    }
    .custom-limit {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 8px;
    }
    .custom-limit .input {
      width: 96px;
      text-align: center;
    }
  `,
})
export class SettingsDialog {
  private readonly store = inject(ListStore);
  private readonly toast = inject(ToastService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly model = signal<SettingsDraft>({
    title: '',
    description: '',
    allowMultiple: true,
    perPerson: 'none',
    customLimit: 2,
    showClaimants: true,
    closed: false,
  });

  protected readonly settingsForm = form(
    this.model,
    (path) => {
      required(path.title, { message: 'The list needs a name.' });
      maxLength(path.title, 120, { message: 'Keep the name under 120 characters.' });
      maxLength(path.description, 1000, { message: 'Keep it under 1000 characters.' });
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
          await this.save();
          return undefined;
        },
      },
    },
  );

  open(): void {
    const view = this.store.view();
    if (!view) return;
    this.settingsForm().reset(toDraft(view));
    const dialog = this.dialog().nativeElement;
    if (!dialog.open) dialog.showModal();
  }

  close(): void {
    this.dialog().nativeElement.close();
  }

  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.close();
  }

  protected firstError(field: 'title' | 'description' | 'customLimit'): string | null {
    const state = this.settingsForm[field]();
    return state.touched() && state.invalid() ? (state.errors()[0]?.message ?? null) : null;
  }

  protected async deleteList(): Promise<void> {
    const title = this.store.view()?.title ?? 'this list';
    if (!confirm(`Delete "${title}" for everyone? This can't be undone.`)) return;
    try {
      await this.store.deleteList();
      this.close();
      this.toast.success('List deleted');
    } catch (error) {
      this.toast.error(ApiError.from(error).message);
    }
  }

  private async save(): Promise<void> {
    const draft = this.model();
    try {
      await this.store.updateList({
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        settings: {
          allowMultiplePerItem: draft.allowMultiple,
          maxPerParticipant:
            draft.perPerson === 'one' ? 1 : draft.perPerson === 'custom' ? draft.customLimit : null,
          showClaimants: draft.showClaimants,
        },
        closed: draft.closed,
      });
      this.close();
      this.toast.success('Settings saved');
    } catch (error) {
      this.toast.error(ApiError.from(error).message);
    }
  }
}
