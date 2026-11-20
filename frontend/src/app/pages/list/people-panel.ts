import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { ApiError } from '../../core/api-error';
import { Person } from '../../core/models';
import { buildSummary, copyText, whatsappUrl } from '../../core/share';
import { ToastService } from '../../core/toast.service';
import { Icon } from '../../shared/icon';
import { ListStore } from './list.store';

interface PersonRow extends Person {
  initials: string;
  picks: string;
}

/** Host view of everyone who joined and what each person picked. */
@Component({
  selector: 'app-people-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    @let view = store.view();
    <section class="people" aria-labelledby="people-heading">
      <div class="people-head">
        <div>
          <h2 id="people-heading">Who picked what</h2>
          <p class="muted small">
            {{ view?.participantCount }} joined · {{ view?.claimedTotal }} picked in total
          </p>
        </div>
        <div class="people-actions">
          <button type="button" class="btn btn-sm btn-soft" (click)="copySummary()">
            <app-icon name="clipboard" [size]="18" /> Copy summary
          </button>
          <a class="btn btn-sm btn-whatsapp" [href]="whatsappSummary()" target="_blank" rel="noopener">
            <app-icon name="whatsapp" [size]="18" /> Send summary
          </a>
        </div>
      </div>

      <ul class="person-list">
        @for (person of people(); track person.id) {
          <li class="person">
            <span class="avatar" [class.host]="person.host" aria-hidden="true">{{ person.initials }}</span>
            <div class="person-info">
              <div class="person-name">
                <strong>{{ person.name }}</strong>
                @if (person.host) {
                  <span class="badge badge-primary">Host</span>
                }
                @if (person.id === store.me()?.id) {
                  <span class="badge">You</span>
                }
              </div>
              <span class="picks" [class.faint]="person.total === 0">{{ person.picks }}</span>
            </div>
            <span class="total" [attr.aria-label]="person.total + ' picked'">{{ person.total }}</span>
            @if (!person.host) {
              <button
                type="button"
                class="btn btn-ghost btn-icon btn-sm remove"
                (click)="remove(person)"
                [attr.aria-label]="'Remove ' + person.name + ' from the list'"
              >
                <app-icon name="x" [size]="18" />
              </button>
            } @else {
              <span class="remove-spacer"></span>
            }
          </li>
        }
      </ul>
      @if (people().length === 1) {
        <p class="muted small invite-hint">
          Nobody else has joined yet. Share the link to invite people.
        </p>
      }
    </section>
  `,
  styles: `
    .people {
      display: grid;
      gap: 16px;
    }
    .people-head {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: 12px;
    }
    .people-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .person-list {
      display: grid;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .person {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 8px 12px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
    }
    .avatar {
      display: inline-grid;
      place-items: center;
      flex-shrink: 0;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--surface-3);
      color: var(--text-muted);
      font-weight: 700;
      font-size: 0.9rem;
    }
    .avatar.host {
      background: var(--primary-soft);
      color: var(--primary-soft-text);
    }
    .person-info {
      display: grid;
      gap: 2px;
      flex: 1;
      min-width: 0;
    }
    .person-name {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
    }
    .picks {
      font-size: 0.9rem;
      color: var(--text-muted);
      overflow-wrap: anywhere;
    }
    .total {
      min-width: 32px;
      text-align: center;
      font-size: 1.15rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .remove {
      color: var(--text-faint);
    }
    .remove:hover {
      color: var(--danger);
    }
    .remove-spacer {
      width: 36px;
      flex-shrink: 0;
    }
  `,
})
export class PeoplePanel {
  protected readonly store = inject(ListStore);
  private readonly toast = inject(ToastService);

  protected readonly people = computed<PersonRow[]>(() => {
    const view = this.store.view();
    if (!view?.participants) return [];
    return view.participants.map((person) => {
      const picks = view.items
        .map((item) => ({
          name: item.name,
          quantity: item.claims?.find((claim) => claim.participantId === person.id)?.quantity ?? 0,
        }))
        .filter((pick) => pick.quantity > 0)
        .map((pick) => (pick.quantity > 1 ? `${pick.name} ×${pick.quantity}` : pick.name));
      return {
        ...person,
        initials: initials(person.name),
        picks: picks.length ? picks.join(', ') : 'Nothing picked yet',
      };
    });
  });

  protected readonly whatsappSummary = computed(() => {
    const view = this.store.view();
    return view ? whatsappUrl(buildSummary(view)) : '#';
  });

  protected async copySummary(): Promise<void> {
    const view = this.store.view();
    if (!view) return;
    if (await copyText(buildSummary(view))) {
      this.toast.success('Summary copied — paste it anywhere');
    } else {
      this.toast.error("Couldn't copy. Try again.");
    }
  }

  protected async remove(person: Person): Promise<void> {
    const note = person.total > 0 ? ` Their ${person.total} picked will be given back.` : '';
    if (!confirm(`Remove ${person.name} from this list?${note}`)) return;
    try {
      await this.store.removeParticipant(person.id);
      this.toast.success(`Removed ${person.name}`);
    } catch (error) {
      this.toast.error(ApiError.from(error).message);
    }
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}
