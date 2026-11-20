// Second scenario: pick mode, closing, inline edits, removal, private link, deletion, dark mode.
const { chromium, devices } = require('playwright');
const path = require('path');

const BASE = process.env.BASE || 'http://localhost:8080';
const OUT = process.argv[2] || path.join(__dirname, 'screenshots');
require('fs').mkdirSync(OUT, { recursive: true });
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });
const row = (page, name) =>
  page.locator('app-item-row', { has: page.locator(`h3.name:text-is("${name}")`) });
const expectText = (locator, text, timeout = 5000) =>
  locator.filter({ hasText: text }).first().waitFor({ timeout });
const assert = (condition, message) => {
  if (!condition) throw new Error('Assertion failed: ' + message);
};

async function api(method, url, body, token) {
  const response = await fetch(BASE + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Participant-Token': token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return response.status === 204 ? null : response.json();
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const watch = (page, who) => {
    page.on('console', (msg) => msg.type() === 'error' && errors.push(`${who}: ${msg.text()}`));
    page.on('pageerror', (err) => errors.push(`${who}: ${err.message}`));
  };

  // A potluck: one dish per person, each dish can only be brought once.
  const created = await api('POST', '/api/lists', {
    title: 'Potluck Saturday',
    description: 'Bring one dish. Tap to claim it.',
    hostName: 'Meera',
    settings: { allowMultiplePerItem: false, maxPerParticipant: 1, showClaimants: true },
    items: [
      { name: 'Salad', note: null, quantityLimit: 1 },
      { name: 'Dessert', note: 'Something sweet', quantityLimit: 1 },
      { name: 'Drinks', note: null, quantityLimit: 2 },
    ],
  });
  const slug = created.list.slug;
  const hostToken = created.token;
  const listUrl = `${BASE}/l/${slug}`;

  // Host signs in on this browser through the private link (token in the URL fragment).
  const hostCtx = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 });
  const host = await hostCtx.newPage();
  watch(host, 'host');
  await host.goto(`${listUrl}#t=${encodeURIComponent(hostToken)}`);
  await host.getByRole('button', { name: 'List settings' }).waitFor();
  assert(!host.url().includes('#t='), 'token fragment should be removed from the address bar');

  // Guest in dark mode on a phone.
  const guestCtx = await browser.newContext({ ...devices['iPhone 13'], colorScheme: 'dark' });
  const guest = await guestCtx.newPage();
  watch(guest, 'guest');
  await guest.goto(listUrl);
  await guest.getByPlaceholder('Your name').fill('Kabir');
  await guest.getByRole('button', { name: 'Join', exact: true }).click();
  await guest.locator('app-join-card').waitFor({ state: 'detached' });

  await row(guest, 'Salad').getByRole('button', { name: 'Pick' }).click();
  await expectText(row(guest, 'Salad').locator('.pick'), 'Picked');
  const dessertDisabled = await row(guest, 'Dessert').getByRole('button', { name: 'Pick' }).isDisabled();
  assert(dessertDisabled, 'max 1 per person should disable other items');
  await expectText(row(host, 'Salad').locator('.badge'), 'All taken');
  await guest.waitForTimeout(3500); // let the welcome toast fade
  await shot(guest, '11-pick-mode-dark-phone');

  // Host edits an item inline; the guest sees it live.
  await host.getByRole('button', { name: 'Edit Drinks' }).click();
  const editor = host.locator('app-item-editor form.editing');
  await editor.getByLabel('Item name').fill('Cold drinks');
  await editor.getByLabel(/Quantity available/).fill('3');
  await editor.getByLabel('Note').fill('Juice or soda');
  await editor.getByRole('button', { name: 'Save' }).click();
  await row(guest, 'Cold drinks').waitFor();
  await expectText(row(guest, 'Cold drinks').locator('.badge'), '3 of 3 left');

  // Host adds an item from the bottom form.
  await host.getByPlaceholder('Add an item…').fill('Bread');
  await host.getByRole('button', { name: /Add/ }).last().click();
  await row(guest, 'Bread').waitFor();

  // Host closes the list; the guest is frozen live.
  await host.getByRole('button', { name: 'List settings' }).click();
  await host.locator('label.switch-row', { hasText: 'Close the list' }).locator('input').check();
  await host.getByRole('button', { name: 'Save' }).click();
  await expectText(guest.locator('.banner'), 'closed this list');
  const pickedDisabled = await row(guest, 'Salad').locator('.pick').isDisabled();
  assert(pickedDisabled, 'closed list should freeze picks');
  await guest.waitForTimeout(400);
  await shot(guest, '12-closed-dark-phone');

  // Reopen, then the host removes the guest; the guest is sent back to the join card.
  await host.getByRole('button', { name: 'List settings' }).click();
  await host.locator('label.switch-row', { hasText: 'Close the list' }).locator('input').uncheck();
  await host.getByRole('button', { name: 'Save' }).click();
  await host.getByRole('tab', { name: /People/ }).click();
  host.once('dialog', (dialog) => dialog.accept());
  await host.getByRole('button', { name: 'Remove Kabir from the list' }).click();
  await guest.locator('app-join-card').waitFor();
  await expectText(row(guest, 'Salad').locator('.badge'), 'Only 1 left');

  // Deleting the list shows everyone the deleted state.
  await host.getByRole('button', { name: 'List settings' }).click();
  host.once('dialog', (dialog) => dialog.accept());
  await host.getByRole('button', { name: 'Delete list' }).click();
  await guest.getByRole('heading', { name: 'This list was deleted' }).waitFor();
  await host.getByRole('heading', { name: 'This list was deleted' }).waitFor();

  // Unknown list and unknown page.
  await guest.goto(`${BASE}/l/zzzzzzzzzz`);
  await guest.getByRole('heading', { name: 'List not found' }).waitFor();
  await guest.goto(`${BASE}/nope`);
  await guest.getByRole('heading', { name: 'Page not found' }).waitFor();

  // Dark-mode home page and create form on a phone.
  await guest.goto(`${BASE}/`);
  await guest.getByRole('heading', { name: /Make a list/ }).waitFor();
  await shot(guest, '13-home-dark-phone');
  await guest.goto(`${BASE}/new`);
  await guest.locator('#title').waitFor();
  await shot(guest, '14-create-dark-phone');

  // Light home page on a phone, fresh visitor.
  const fresh = await (await browser.newContext({ ...devices['Pixel 7'] })).newPage();
  watch(fresh, 'fresh');
  await fresh.goto(`${BASE}/`);
  await fresh.getByRole('heading', { name: /Make a list/ }).waitFor();
  await shot(fresh, '15-home-light-phone');

  // Validation messages on an empty create form.
  await fresh.goto(`${BASE}/new`);
  await fresh.getByRole('button', { name: 'Create list & share' }).click();
  await fresh.getByText('Give your list a name.').waitFor();
  await fresh.getByText('Add at least one item.').waitFor();

  // Header layout on a phone (host view with Share + settings beside the meta line).
  const second = await api('POST', '/api/lists', {
    title: 'Team kit sizes', description: null, hostName: 'Jay',
    settings: { allowMultiplePerItem: true, maxPerParticipant: null, showClaimants: true },
    items: [{ name: 'T-shirt M', note: null, quantityLimit: 4 }],
  });
  const phoneHost = await (await browser.newContext({ ...devices['iPhone SE'] })).newPage();
  watch(phoneHost, 'phone-host');
  await phoneHost.goto(`${BASE}/l/${second.list.slug}#t=${encodeURIComponent(second.token)}`);
  await phoneHost.getByRole('button', { name: 'List settings' }).waitFor();
  await phoneHost.waitForTimeout(300);
  await shot(phoneHost, '16-host-small-phone');

  // No horizontal scrolling at any of the tested sizes.
  for (const [who, page] of [['fresh', fresh], ['phone-host', phoneHost], ['host', host]]) {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(overflow <= 0, `${who} page scrolls horizontally by ${overflow}px`);
  }

  // Errors from deliberately-missing lists (404 responses) are expected; anything else is not.
  const unexpected = errors.filter((e) => !/404|Not Found/i.test(e));
  console.log('Unexpected console errors:', unexpected.length ? unexpected : 'none');
  await browser.close();
  if (unexpected.length) process.exit(1);
  console.log('E2E-2 PASSED');
})().catch((err) => {
  console.error('E2E-2 FAILED:', err);
  process.exit(1);
});
