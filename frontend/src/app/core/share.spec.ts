import { iceCream, item } from '../../testing/fixtures';
import {
  buildSummary,
  inviteText,
  personalUrl,
  shareUrl,
  tokenFromFragment,
  whatsappUrl,
} from './share';

describe('share helpers', () => {
  it('builds public and private links', () => {
    expect(shareUrl('abcdefghij', 'https://lists.example')).toBe('https://lists.example/l/abcdefghij');
    expect(personalUrl('abcdefghij', 'tok_en-123', 'https://lists.example')).toBe(
      'https://lists.example/l/abcdefghij#t=tok_en-123',
    );
  });

  it('reads tokens only from well-formed fragments', () => {
    const token = 'Zm9vYmFyYmF6cXV4cXV1eGNvcmdlZ3JhdWx0';
    expect(tokenFromFragment(`#t=${token}`)).toBe(token);
    expect(tokenFromFragment('#t=short')).toBeNull();
    expect(tokenFromFragment('#t=<script>alert(1)</script>')).toBeNull();
    expect(tokenFromFragment('')).toBeNull();
  });

  it('opens WhatsApp with the invitation text encoded', () => {
    const url = whatsappUrl(inviteText('Ice cream & cake', 'https://x.test/l/abc'));
    expect(url.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(url.split('text=')[1])).toBe(
      'Pick yours for "Ice cream & cake" 👉 https://x.test/l/abc',
    );
  });

  it('summarises who picked what for the host', () => {
    const summary = buildSummary(
      iceCream({
        items: [
          item({
            id: 1,
            name: 'Vanilla',
            quantityLimit: 2,
            claimed: 2,
            available: 0,
            claims: [
              { participantId: 2, name: 'Asha', quantity: 1 },
              { participantId: 3, name: 'Ravi', quantity: 1 },
            ],
          }),
          item({
            id: 2,
            name: 'Chocolate',
            claimed: 3,
            claims: [{ participantId: 2, name: 'Asha', quantity: 3 }],
          }),
        ],
        claimedTotal: 5,
        participants: [
          { id: 1, name: 'Jay', host: true, total: 0, joinedAt: '' },
          { id: 2, name: 'Asha', host: false, total: 4, joinedAt: '' },
          { id: 3, name: 'Ravi', host: false, total: 1, joinedAt: '' },
          { id: 4, name: 'Meera', host: false, total: 0, joinedAt: '' },
        ],
      }),
    );
    expect(summary).toBe(
      [
        '*Ice cream order*',
        '• Vanilla: 2 / 2 — Asha, Ravi',
        '• Chocolate: 3 — Asha ×3',
        '',
        '5 picked by 2 people',
        'Not picked yet: Meera',
      ].join('\n'),
    );
  });
});
