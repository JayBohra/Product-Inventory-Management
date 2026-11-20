import { ListItem, ListView, Me } from '../app/core/models';

export function item(overrides: Partial<ListItem> & Pick<ListItem, 'id' | 'name'>): ListItem {
  return {
    note: null,
    quantityLimit: null,
    claimed: 0,
    available: null,
    myQuantity: 0,
    claims: [],
    ...overrides,
  };
}

export function me(overrides: Partial<Me> = {}): Me {
  return { id: 2, name: 'Asha', host: false, total: 0, remaining: null, ...overrides };
}

/** The brief's example: vanilla is limited to 2, the rest is unlimited. */
export function iceCream(overrides: Partial<ListView> = {}): ListView {
  return {
    slug: 'abcdefghij',
    title: 'Ice cream order',
    description: null,
    hostName: 'Jay',
    settings: { allowMultiplePerItem: true, maxPerParticipant: null, showClaimants: true },
    closed: false,
    revision: 1,
    createdAt: '2026-11-20T10:00:00Z',
    updatedAt: '2026-11-20T10:00:00Z',
    items: [
      item({ id: 1, name: 'Vanilla', quantityLimit: 2, available: 2 }),
      item({ id: 2, name: 'Chocolate' }),
    ],
    participantCount: 2,
    claimedTotal: 0,
    me: me(),
    participants: null,
    ...overrides,
  };
}

/** A promise that the test resolves or rejects by hand. */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export const flush = () => new Promise<void>((resolve) => setTimeout(resolve));
