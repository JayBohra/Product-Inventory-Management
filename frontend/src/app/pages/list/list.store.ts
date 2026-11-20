import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';

import { ApiError } from '../../core/api-error';
import { ApiService } from '../../core/api.service';
import { IdentityStore } from '../../core/identity.store';
import { ItemInput, ListItem, ListView, UpdateListRequest } from '../../core/models';
import { ToastService } from '../../core/toast.service';

export type LoadStatus = 'loading' | 'ready' | 'not-found' | 'deleted' | 'error';
export type Connection = 'connecting' | 'live' | 'offline';

/** An item as shown to this person, including picks that are still being saved. */
export interface ItemState extends ListItem {
  /** Units this person holds, counting unsaved taps. */
  quantity: number;
  /** Units still free for everyone (null = unlimited), counting unsaved taps. */
  left: number | null;
  canAdd: boolean;
  canRemove: boolean;
  /** Why "+" is disabled, if it is. */
  blockedReason: string | null;
  saving: boolean;
  /** Someone else just changed this item. */
  flash: boolean;
}

const FLASH_MS = 1400;
const RECONNECT_DELAY_MS = 5000;

/**
 * State for one open list: loads it, keeps it live through Server-Sent Events, and applies
 * picks optimistically so the +/- buttons feel instant.
 *
 * Every change on the server bumps the list's revision and the stream announces it; the store
 * then re-fetches its own (personalised) view. Rapid taps on the same item are coalesced: while
 * a request is in flight, only the latest wanted quantity is sent next.
 */
@Injectable()
export class ListStore {
  private readonly api = inject(ApiService);
  private readonly identity = inject(IdentityStore);
  private readonly toast = inject(ToastService);

  readonly slug = signal('');
  readonly view = signal<ListView | null>(null);
  readonly status = signal<LoadStatus>('loading');
  readonly connection = signal<Connection>('connecting');

  /** itemId → quantity this person wants but the server hasn't confirmed yet. */
  private readonly wanted = signal<ReadonlyMap<number, number>>(new Map());
  private readonly flashing = signal<ReadonlySet<number>>(new Set());
  private readonly inFlight = new Set<number>();

  private events: EventSource | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private activeFetch: Promise<void> | null = null;
  private fetchAgain = false;
  /** Set while this person leaves on purpose, so we don't also say they were removed. */
  private leaving = false;

  readonly token = computed(() => this.identity.token(this.slug()));
  readonly me = computed(() => this.view()?.me ?? null);
  readonly isHost = computed(() => this.me()?.host ?? false);
  readonly joined = computed(() => this.me() !== null);

  /** Sum of unsaved changes, so totals and limits update with every tap. */
  private readonly pendingDelta = computed(() => {
    const view = this.view();
    if (!view) return 0;
    let delta = 0;
    for (const [itemId, quantity] of this.wanted()) {
      const item = view.items.find((candidate) => candidate.id === itemId);
      if (item) delta += quantity - item.myQuantity;
    }
    return delta;
  });

  readonly myTotal = computed(() => (this.me()?.total ?? 0) + this.pendingDelta());
  readonly myRemaining = computed(() => {
    const remaining = this.me()?.remaining;
    return remaining === null || remaining === undefined
      ? null
      : Math.max(0, remaining - this.pendingDelta());
  });

  readonly items = computed<ItemState[]>(() => {
    const view = this.view();
    if (!view) return [];
    const wanted = this.wanted();
    const flashing = this.flashing();
    const joined = view.me !== null;
    const remaining = this.myRemaining();
    return view.items.map((item) => {
      const quantity = wanted.get(item.id) ?? item.myQuantity;
      const left =
        item.available === null ? null : Math.max(0, item.available - (quantity - item.myQuantity));
      let blockedReason: string | null = null;
      if (!joined) blockedReason = 'Join to pick';
      else if (view.closed) blockedReason = 'List is closed';
      else if (left === 0) blockedReason = quantity > 0 ? 'No more left' : 'All taken';
      else if (!view.settings.allowMultiplePerItem && quantity >= 1) blockedReason = 'One each';
      else if (remaining !== null && remaining <= 0) blockedReason = 'Your limit is reached';
      return {
        ...item,
        quantity,
        left,
        canAdd: blockedReason === null,
        canRemove: joined && !view.closed && quantity > 0,
        blockedReason,
        saving: wanted.has(item.id),
        flash: flashing.has(item.id),
      };
    });
  });

  constructor() {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && this.status() === 'ready') {
        // Phones suspend background tabs; catch up as soon as the list is visible again.
        void this.refresh();
        if (!this.events || this.events.readyState === EventSource.CLOSED) this.connect();
      }
    };
    const onOnline = () => {
      if (this.status() === 'ready') this.connect();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      this.disconnect();
    });
  }

  /** Starts showing a list (or switches to another one). */
  open(slug: string): void {
    this.disconnect();
    this.slug.set(slug);
    this.view.set(null);
    this.wanted.set(new Map());
    this.inFlight.clear();
    this.activeFetch = null;
    this.fetchAgain = false;
    this.status.set('loading');
    void this.refresh().then(() => {
      if (this.status() === 'ready') this.connect();
    });
  }

  /** Re-fetches the list; calls made while a fetch is running are merged into one follow-up. */
  refresh(): Promise<void> {
    if (this.activeFetch) {
      this.fetchAgain = true;
      return this.activeFetch;
    }
    const fetch = this.fetchLoop(this.slug()).finally(() => {
      if (this.activeFetch === fetch) this.activeFetch = null;
    });
    this.activeFetch = fetch;
    return fetch;
  }

  private async fetchLoop(slug: string): Promise<void> {
    try {
      do {
        this.fetchAgain = false;
        const token = this.token();
        const view = await this.api.getList(slug, token);
        if (slug !== this.slug()) return;
        if (token !== this.token()) {
          // This person joined or left while the request was in flight; the response describes
          // the wrong identity, so ask again with the current one.
          this.fetchAgain = true;
          continue;
        }
        if (token && !view.me) {
          // The host removed this person (or the token is stale): start fresh.
          this.identity.forget(slug);
          if (this.view()?.me && !this.leaving) this.toast.info('You are no longer part of this list.');
        }
        this.apply(view);
        this.status.set('ready');
      } while (this.fetchAgain && slug === this.slug());
    } catch (error) {
      if (slug !== this.slug()) return;
      const apiError = ApiError.from(error);
      if (apiError.status === 404) {
        this.identity.forget(slug);
        this.status.set(this.view() ? 'deleted' : 'not-found');
        this.disconnect();
      } else if (!this.view()) {
        this.status.set('error');
      }
    }
  }

  // ------------------------------------------------------------------ picking

  increment(item: ItemState): void {
    if (item.canAdd) this.setQuantity(item.id, item.quantity + 1);
  }

  decrement(item: ItemState): void {
    if (item.canRemove) this.setQuantity(item.id, item.quantity - 1);
  }

  toggle(item: ItemState): void {
    if (item.quantity > 0) this.decrement(item);
    else this.increment(item);
  }

  setQuantity(itemId: number, quantity: number): void {
    this.wanted.update((wanted) => new Map(wanted).set(itemId, Math.max(0, quantity)));
    if (!this.inFlight.has(itemId)) void this.flush(itemId);
  }

  private async flush(itemId: number): Promise<void> {
    const slug = this.slug();
    const token = this.token();
    const quantity = this.wanted().get(itemId);
    if (quantity === undefined) return;
    if (!token) {
      this.forgetWanted(itemId);
      return;
    }
    this.inFlight.add(itemId);
    try {
      const view = await this.api.setClaim(slug, token, itemId, quantity);
      if (slug !== this.slug()) return;
      this.inFlight.delete(itemId);
      const latest = this.wanted().get(itemId);
      if (latest !== undefined && latest !== quantity) {
        this.apply(view);
        void this.flush(itemId);
        return;
      }
      this.forgetWanted(itemId);
      this.apply(view);
    } catch (error) {
      this.inFlight.delete(itemId);
      this.forgetWanted(itemId);
      this.toast.error(ApiError.from(error).message);
      void this.refresh();
    }
  }

  private forgetWanted(itemId: number): void {
    this.wanted.update((wanted) => {
      const next = new Map(wanted);
      next.delete(itemId);
      return next;
    });
  }

  // ------------------------------------------------------------------ joining

  async join(displayName: string): Promise<void> {
    const slug = this.slug();
    const result = await this.api.join(slug, displayName);
    this.identity.save({
      slug,
      token: result.token,
      title: result.list.title,
      name: result.list.me?.name ?? displayName,
      host: false,
    });
    this.apply(result.list);
  }

  async rename(displayName: string): Promise<void> {
    await this.run((slug, token) => this.api.rename(slug, token, displayName));
  }

  async leave(): Promise<void> {
    const slug = this.slug();
    const token = this.requireToken();
    this.leaving = true;
    try {
      await this.api.leave(slug, token);
      this.identity.forget(slug);
      await this.refresh();
    } finally {
      this.leaving = false;
    }
  }

  // ------------------------------------------------------------------ host tools

  updateList(request: UpdateListRequest): Promise<void> {
    return this.run((slug, token) => this.api.updateList(slug, token, request));
  }

  addItem(item: ItemInput): Promise<void> {
    return this.run((slug, token) => this.api.addItem(slug, token, item));
  }

  updateItem(itemId: number, item: ItemInput): Promise<void> {
    return this.run((slug, token) => this.api.updateItem(slug, token, itemId, item));
  }

  removeItem(itemId: number): Promise<void> {
    return this.run((slug, token) => this.api.removeItem(slug, token, itemId));
  }

  moveItem(itemId: number, offset: -1 | 1): Promise<void> {
    const ids = this.view()?.items.map((item) => item.id) ?? [];
    const from = ids.indexOf(itemId);
    const to = from + offset;
    if (from < 0 || to < 0 || to >= ids.length) return Promise.resolve();
    [ids[from], ids[to]] = [ids[to], ids[from]];
    return this.run((slug, token) => this.api.reorderItems(slug, token, ids));
  }

  removeParticipant(participantId: number): Promise<void> {
    return this.run((slug, token) => this.api.removeParticipant(slug, token, participantId));
  }

  async deleteList(): Promise<void> {
    const slug = this.slug();
    await this.api.deleteList(slug, this.requireToken());
    this.identity.forget(slug);
    this.disconnect();
    this.status.set('deleted');
  }

  // ------------------------------------------------------------------ internals

  /** Runs a mutation that returns the new view; errors are re-thrown for the caller to show. */
  private async run(call: (slug: string, token: string) => Promise<ListView>): Promise<void> {
    const slug = this.slug();
    const view = await call(slug, this.requireToken());
    if (slug === this.slug()) this.apply(view);
  }

  private requireToken(): string {
    const token = this.token();
    if (!token) throw new ApiError('Please join the list with your name first.', 401, 'NOT_JOINED', null);
    return token;
  }

  /** Accepts a view unless a newer one is already shown, and highlights others' changes. */
  private apply(view: ListView): void {
    const previous = this.view();
    if (previous && previous.slug === view.slug && view.revision < previous.revision) return;
    if (previous && previous.slug === view.slug) {
      const changed = view.items
        .filter((item) => {
          const before = previous.items.find((candidate) => candidate.id === item.id);
          return before && before.claimed - before.myQuantity !== item.claimed - item.myQuantity;
        })
        .map((item) => item.id);
      if (changed.length) this.flash(changed);
    }
    this.view.set(view);
    if (view.me) {
      this.identity.remember(view.slug, { title: view.title, name: view.me.name, host: view.me.host });
    }
  }

  private flash(itemIds: number[]): void {
    this.flashing.update((current) => new Set([...current, ...itemIds]));
    setTimeout(
      () =>
        this.flashing.update((current) => {
          const next = new Set(current);
          itemIds.forEach((id) => next.delete(id));
          return next;
        }),
      FLASH_MS,
    );
  }

  private connect(): void {
    if (typeof EventSource === 'undefined') return;
    this.disconnect();
    const slug = this.slug();
    const events = new EventSource(this.api.eventsUrl(slug));
    this.events = events;
    this.connection.set('connecting');

    events.addEventListener('open', () => this.connection.set('live'));
    events.addEventListener('revision', (event) => {
      this.connection.set('live');
      const revision = parseRevision((event as MessageEvent<string>).data);
      if (revision !== null && revision > (this.view()?.revision ?? -1)) void this.refresh();
    });
    events.addEventListener('deleted', () => {
      this.identity.forget(slug);
      this.status.set('deleted');
      this.disconnect();
    });
    events.addEventListener('error', () => {
      if (events.readyState === EventSource.CLOSED) {
        // The browser gave up (e.g. server restart returned an error). Try again shortly.
        this.connection.set('offline');
        this.reconnectTimer = setTimeout(() => {
          if (this.status() === 'ready' && this.slug() === slug) {
            void this.refresh();
            this.connect();
          }
        }, RECONNECT_DELAY_MS);
      } else {
        this.connection.set('connecting');
      }
    });
  }

  private disconnect(): void {
    clearTimeout(this.reconnectTimer);
    this.events?.close();
    this.events = null;
  }
}

function parseRevision(data: string): number | null {
  try {
    const parsed: unknown = JSON.parse(data);
    const revision = (parsed as { revision?: unknown })?.revision;
    return typeof revision === 'number' ? revision : null;
  } catch {
    return null;
  }
}
