import { Injectable, computed, signal } from '@angular/core';

/** What this device remembers about a list it created or joined. */
export interface SavedList {
  slug: string;
  /** Secret that identifies this person on the list. */
  token: string;
  title: string | null;
  name: string | null;
  host: boolean;
  lastOpened: string;
}

const STORAGE_KEY = 'sharelist.lists.v1';

/**
 * Remembers, per list, the secret token this device received when creating or joining it.
 * There are no accounts: the token is the identity, so it lives only in this browser.
 */
@Injectable({ providedIn: 'root' })
export class IdentityStore {
  private readonly lists = signal<Record<string, SavedList>>(readStorage());

  /** Lists this device knows about, most recently opened first. */
  readonly recent = computed(() =>
    Object.values(this.lists()).sort((a, b) => b.lastOpened.localeCompare(a.lastOpened)),
  );

  /** Set right after creating a list so the list page can open the share dialog once. */
  readonly justCreated = signal<string | null>(null);

  constructor() {
    // Keep several open tabs in sync (e.g. someone joins in one tab and switches to another).
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key === STORAGE_KEY) {
          this.lists.set(readStorage());
        }
      });
    }
  }

  get(slug: string): SavedList | undefined {
    return this.lists()[slug];
  }

  token(slug: string): string | null {
    return this.lists()[slug]?.token ?? null;
  }

  save(entry: Pick<SavedList, 'slug' | 'token'> & Partial<SavedList>): void {
    this.update((lists) => {
      const previous = lists[entry.slug];
      const keepDetails = previous?.token === entry.token;
      lists[entry.slug] = {
        title: keepDetails ? previous.title : null,
        name: keepDetails ? previous.name : null,
        host: keepDetails ? previous.host : false,
        ...entry,
        lastOpened: new Date().toISOString(),
      };
    });
  }

  /** Refreshes the remembered title/name after the list was loaded. */
  remember(slug: string, details: Pick<SavedList, 'title' | 'name' | 'host'>): void {
    const current = this.lists()[slug];
    if (!current) {
      return;
    }
    if (
      current.title === details.title &&
      current.name === details.name &&
      current.host === details.host
    ) {
      return;
    }
    this.update((lists) => {
      lists[slug] = { ...current, ...details, lastOpened: new Date().toISOString() };
    });
  }

  forget(slug: string): void {
    if (!this.lists()[slug]) {
      return;
    }
    this.update((lists) => {
      delete lists[slug];
    });
  }

  private update(mutate: (lists: Record<string, SavedList>) => void): void {
    const next = { ...this.lists() };
    mutate(next);
    this.lists.set(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Private mode or storage disabled: the identity still works until the tab is closed.
    }
  }
}

function readStorage(): Record<string, SavedList> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, SavedList>) : {};
  } catch {
    return {};
  }
}
