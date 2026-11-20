import { ComponentRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { iceCream, item } from '../../../testing/fixtures';
import { ApiService } from '../../core/api.service';
import { ListView } from '../../core/models';
import { ItemRow } from './item-row';
import { ListStore } from './list.store';

describe('ItemRow', () => {
  let fixture: ComponentFixture<ItemRow>;
  let ref: ComponentRef<ItemRow>;
  let store: ListStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ItemRow],
      providers: [ListStore, { provide: ApiService, useValue: { eventsUrl: () => '' } }],
    });
    store = TestBed.inject(ListStore);
    fixture = TestBed.createComponent(ItemRow);
    ref = fixture.componentRef;
  });

  async function render(view: ListView, index = 0, multiple = true) {
    store.view.set(view);
    ref.setInput('item', store.items()[index]);
    ref.setInput('multiple', multiple);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  const button = (el: HTMLElement, label: string) =>
    el.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;

  it('counts down a limited item and warns when it is nearly gone', async () => {
    const el = await render(
      iceCream({
        items: [
          item({
            id: 1,
            name: 'Vanilla',
            quantityLimit: 2,
            claimed: 1,
            available: 1,
            claims: [{ participantId: 9, name: 'Ravi', quantity: 1 }],
          }),
        ],
      }),
    );
    expect(el.querySelector('.badge')?.textContent?.trim()).toBe('Only 1 left');
    expect(el.querySelector('.claimants')?.textContent?.trim()).toBe('Ravi');
    expect(button(el, 'Add one Vanilla').disabled).toBe(false);
    expect(button(el, 'Remove one Vanilla').disabled).toBe(true);
  });

  it('disables "+" and greys the row out when nothing is left', async () => {
    const el = await render(
      iceCream({ items: [item({ id: 1, name: 'Vanilla', quantityLimit: 2, claimed: 2, available: 0 })] }),
    );
    expect(el.querySelector('.badge')?.textContent?.trim()).toBe('All taken');
    expect(button(el, 'Add one Vanilla').disabled).toBe(true);
    expect(el.querySelector('.row')?.classList).toContain('sold-out');
  });

  it('labels the viewer as "You" and lets them give units back', async () => {
    const el = await render(
      iceCream({
        items: [
          item({
            id: 2,
            name: 'Chocolate',
            claimed: 3,
            myQuantity: 2,
            claims: [
              { participantId: 2, name: 'Asha', quantity: 2 },
              { participantId: 9, name: 'Ravi', quantity: 1 },
            ],
          }),
        ],
      }),
    );
    expect(el.querySelector('.claimants')?.textContent?.trim()).toBe('You ×2, Ravi');
    expect(el.querySelector('.count')?.textContent?.trim()).toBe('2');
    expect(button(el, 'Remove one Chocolate').disabled).toBe(false);
  });

  it('shows a Pick toggle instead of a stepper when counts are off', async () => {
    const el = await render(iceCream({ items: [item({ id: 2, name: 'Chocolate' })] }), 0, false);
    const pick = el.querySelector<HTMLButtonElement>('button.pick')!;
    expect(pick.textContent?.trim()).toBe('Pick');
    expect(pick.getAttribute('aria-pressed')).toBe('false');
    expect(el.querySelector('.stepper')).toBeNull();
  });
});
