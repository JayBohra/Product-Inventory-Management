import { TestBed } from '@angular/core/testing';

import { deferred, flush, iceCream, item, me } from '../../../testing/fixtures';
import { ApiError } from '../../core/api-error';
import { ApiService } from '../../core/api.service';
import { IdentityStore } from '../../core/identity.store';
import { ListView } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { ListStore } from './list.store';

const SLUG = 'abcdefghij';
const TOKEN = 'secret-token-for-asha-0123456789';

describe('ListStore', () => {
  let api: { getList: ReturnType<typeof vi.fn>; setClaim: ReturnType<typeof vi.fn>; eventsUrl: () => string };
  let store: ListStore;
  let identity: IdentityStore;
  let toast: ToastService;

  beforeEach(() => {
    localStorage.clear();
    api = { getList: vi.fn(), setClaim: vi.fn(), eventsUrl: () => '/events' };
    TestBed.configureTestingModule({
      providers: [ListStore, { provide: ApiService, useValue: api }],
    });
    store = TestBed.inject(ListStore);
    identity = TestBed.inject(IdentityStore);
    toast = TestBed.inject(ToastService);
  });

  async function openWith(view: ListView, token: string | null = TOKEN) {
    if (token) identity.save({ slug: SLUG, token });
    api.getList.mockResolvedValueOnce(view);
    store.open(SLUG);
    await flush();
  }

  it('loads the list for the saved identity', async () => {
    await openWith(iceCream());
    expect(api.getList).toHaveBeenCalledWith(SLUG, TOKEN);
    expect(store.status()).toBe('ready');
    expect(store.items().map((i) => i.name)).toEqual(['Vanilla', 'Chocolate']);
  });

  it('shows a tap immediately, before the server answers', async () => {
    await openWith(iceCream({ me: me({ remaining: 3 }), settings: { allowMultiplePerItem: true, maxPerParticipant: 3, showClaimants: true } }));
    const pending = deferred<ListView>();
    api.setClaim.mockReturnValueOnce(pending.promise);

    store.increment(store.items()[0]);

    const vanilla = store.items()[0];
    expect(vanilla.quantity).toBe(1);
    expect(vanilla.left).toBe(1);
    expect(vanilla.saving).toBe(true);
    expect(store.myTotal()).toBe(1);
    expect(store.myRemaining()).toBe(2);
  });

  it('coalesces rapid taps and only sends the latest quantity next', async () => {
    await openWith(iceCream());
    const first = deferred<ListView>();
    const second = deferred<ListView>();
    api.setClaim.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    store.increment(store.items()[1]);
    store.increment(store.items()[1]);
    store.increment(store.items()[1]);
    expect(api.setClaim).toHaveBeenCalledTimes(1);
    expect(api.setClaim).toHaveBeenLastCalledWith(SLUG, TOKEN, 2, 1);
    expect(store.items()[1].quantity).toBe(3);

    first.resolve(withMine(iceCream({ revision: 2 }), 2, 1));
    await flush();
    expect(api.setClaim).toHaveBeenCalledTimes(2);
    expect(api.setClaim).toHaveBeenLastCalledWith(SLUG, TOKEN, 2, 3);
    expect(store.items()[1].quantity).toBe(3);

    second.resolve(withMine(iceCream({ revision: 3 }), 2, 3));
    await flush();
    expect(store.items()[1].quantity).toBe(3);
    expect(store.items()[1].saving).toBe(false);
  });

  it('rolls back and explains when the server says no', async () => {
    await openWith(iceCream());
    const error = vi.spyOn(toast, 'error');
    api.setClaim.mockRejectedValueOnce(
      new ApiError('Sorry, "Vanilla" is all taken.', 409, 'NOT_ENOUGH_LEFT', null),
    );
    api.getList.mockResolvedValueOnce(
      iceCream({ revision: 5, items: [item({ id: 1, name: 'Vanilla', quantityLimit: 2, claimed: 2, available: 0 }), item({ id: 2, name: 'Chocolate' })] }),
    );

    store.increment(store.items()[0]);
    await flush();
    await flush();

    expect(error).toHaveBeenCalledWith('Sorry, "Vanilla" is all taken.');
    expect(store.items()[0].quantity).toBe(0);
    expect(store.items()[0].left).toBe(0);
    expect(store.items()[0].blockedReason).toBe('All taken');
  });

  it('ignores responses older than what is on screen', async () => {
    await openWith(iceCream({ revision: 7 }));
    api.getList.mockResolvedValueOnce(iceCream({ revision: 6, title: 'Stale' }));
    await store.refresh();
    expect(store.view()?.title).toBe('Ice cream order');
  });

  it('re-fetches when the identity changed while a request was in flight', async () => {
    await openWith(iceCream({ me: null }), null);
    const anonymous = deferred<ListView>();
    api.getList.mockReturnValueOnce(anonymous.promise).mockResolvedValueOnce(iceCream({ revision: 2 }));

    const refresh = store.refresh();
    identity.save({ slug: SLUG, token: TOKEN }); // the person joined meanwhile
    anonymous.resolve(iceCream({ revision: 2, me: null }));
    await refresh;

    expect(api.getList).toHaveBeenLastCalledWith(SLUG, TOKEN);
    expect(store.me()?.name).toBe('Asha');
  });

  it('forgets a token the server no longer recognises', async () => {
    await openWith(iceCream({ me: null }));
    expect(identity.token(SLUG)).toBeNull();
    expect(store.joined()).toBe(false);
  });

  it('explains why "+" is disabled', async () => {
    await openWith(iceCream({ me: null }), null);
    expect(store.items()[1].blockedReason).toBe('Join to pick');

    store.view.set(iceCream({ closed: true, revision: 2 }));
    expect(store.items()[1].blockedReason).toBe('List is closed');

    store.view.set(
      iceCream({
        revision: 3,
        settings: { allowMultiplePerItem: false, maxPerParticipant: null, showClaimants: true },
        items: [item({ id: 2, name: 'Chocolate', claimed: 1, myQuantity: 1 })],
      }),
    );
    expect(store.items()[0].blockedReason).toBe('One each');
    expect(store.items()[0].canRemove).toBe(true);

    store.view.set(iceCream({ revision: 4, me: me({ total: 2, remaining: 0 }) }));
    expect(store.items()[1].blockedReason).toBe('Your limit is reached');
    expect(store.items()[1].canAdd).toBe(false);
  });

  it('distinguishes a missing list from one deleted while open', async () => {
    api.getList.mockRejectedValueOnce(new ApiError('gone', 404, 'LIST_NOT_FOUND', null));
    store.open(SLUG);
    await flush();
    expect(store.status()).toBe('not-found');

    await openWith(iceCream());
    api.getList.mockRejectedValueOnce(new ApiError('gone', 404, 'LIST_NOT_FOUND', null));
    await store.refresh();
    expect(store.status()).toBe('deleted');
  });
});

function withMine(view: ListView, itemId: number, quantity: number): ListView {
  return {
    ...view,
    items: view.items.map((i) => (i.id === itemId ? { ...i, myQuantity: quantity, claimed: quantity } : i)),
    me: view.me ? { ...view.me, total: quantity } : null,
  };
}
