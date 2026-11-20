import { ListDraft, toRequest } from './create-list.page';

const draft = (overrides: Partial<ListDraft> = {}): ListDraft => ({
  title: '  Ice cream order ',
  description: '   ',
  hostName: ' Jay ',
  items: [
    { name: ' Vanilla ', limit: 2 },
    { name: '', limit: 5 },
    { name: 'Chocolate', limit: null },
  ],
  allowMultiple: true,
  perPerson: 'none',
  customLimit: 3,
  showClaimants: true,
  ...overrides,
});

describe('toRequest', () => {
  it('trims text and drops empty item rows', () => {
    expect(toRequest(draft())).toEqual({
      title: 'Ice cream order',
      description: null,
      hostName: 'Jay',
      settings: { allowMultiplePerItem: true, maxPerParticipant: null, showClaimants: true },
      items: [
        { name: 'Vanilla', note: null, quantityLimit: 2 },
        { name: 'Chocolate', note: null, quantityLimit: null },
      ],
    });
  });

  it('maps the per-person choice to a number', () => {
    expect(toRequest(draft({ perPerson: 'one' })).settings.maxPerParticipant).toBe(1);
    expect(toRequest(draft({ perPerson: 'custom', customLimit: 3 })).settings.maxPerParticipant).toBe(3);
    expect(toRequest(draft({ perPerson: 'none', customLimit: 3 })).settings.maxPerParticipant).toBeNull();
  });
});
