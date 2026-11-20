// End-to-end check of the ice cream scenario with three people on different devices.
const { chromium, devices } = require('playwright');
const path = require('path');

const BASE = process.env.BASE || 'http://localhost:8080';
const OUT = process.argv[2] || path.join(__dirname, 'screenshots');
require('fs').mkdirSync(OUT, { recursive: true });
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });

function row(page, name) {
  return page.locator('app-item-row', { has: page.locator(`h3.name:text-is("${name}")`) });
}

async function expectText(locator, text, timeout = 5000) {
  await locator.filter({ hasText: text }).first().waitFor({ timeout });
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const watch = (page, who) => {
    page.on('console', (msg) => msg.type() === 'error' && errors.push(`${who}: ${msg.text()}`));
    page.on('pageerror', (err) => errors.push(`${who}: ${err.message}`));
  };

  // ---------------- Host on a laptop creates the list
  const hostCtx = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 });
  const host = await hostCtx.newPage();
  watch(host, 'host');
  await host.goto(BASE + '/');
  await host.getByRole('link', { name: 'Create a list' }).click();
  await host.locator('#title').fill('Ice cream order');
  await host.locator('#description').fill('Friday treat — pick by 3pm!');
  await host.locator('#host-name').fill('Jay');
  const names = host.locator('.item-name');
  await names.nth(0).fill('Vanilla');
  await host.locator('input.qty').nth(0).fill('2');
  await names.nth(1).fill('Chocolate');
  await names.nth(2).fill('Strawberry');
  await names.nth(2).press('Enter'); // Enter adds a new row
  await names.nth(3).fill('Mango sorbet');
  await host.locator('input.qty').nth(3).fill('1');
  await host.locator('.segmented label', { hasText: 'Custom' }).click();
  await host.locator('.custom-limit input').fill('3');
  await shot(host, '01-create-desktop');
  await host.getByRole('button', { name: 'Create list & share' }).click();

  await host.waitForURL(/\/l\/[A-Za-z0-9]{10}$/);
  const listUrl = host.url();
  console.log('List URL:', listUrl);
  await host.locator('dialog.sheet[open]').waitFor();
  await shot(host, '02-share-dialog-desktop');
  await host.getByRole('button', { name: 'Close' }).first().click();
  await expectText(row(host, 'Vanilla').locator('.badge'), '2 of 2 left');

  // ---------------- Asha on an iPhone joins
  const ashaCtx = await browser.newContext({ ...devices['iPhone 13'] });
  const asha = await ashaCtx.newPage();
  watch(asha, 'asha');
  await asha.goto(listUrl);
  await asha.getByPlaceholder('Your name').fill('Asha');
  await shot(asha, '03-join-phone');
  await asha.getByRole('button', { name: 'Join', exact: true }).click();
  await asha.locator('app-join-card').waitFor({ state: 'detached' });
  await asha.getByRole('button', { name: 'Add one Vanilla' }).click();
  await expectText(row(asha, 'Vanilla').locator('.badge'), 'Only 1 left');

  // Host sees it live, without reloading
  await expectText(row(host, 'Vanilla').locator('.badge'), 'Only 1 left');
  await expectText(row(host, 'Vanilla').locator('.claimants'), 'Asha');

  // ---------------- Ravi on an Android phone joins and takes the last vanilla
  const raviCtx = await browser.newContext({ ...devices['Pixel 7'] });
  const ravi = await raviCtx.newPage();
  watch(ravi, 'ravi');
  await ravi.goto(listUrl);
  await ravi.getByPlaceholder('Your name').fill('Ravi');
  await ravi.getByRole('button', { name: 'Join', exact: true }).click();
  await ravi.locator('app-join-card').waitFor({ state: 'detached' });
  await expectText(row(ravi, 'Vanilla').locator('.badge'), 'Only 1 left');
  await ravi.getByRole('button', { name: 'Add one Vanilla' }).click();
  await expectText(row(ravi, 'Vanilla').locator('.badge'), 'All taken');

  // Asha's + for vanilla is now disabled, live
  await expectText(row(asha, 'Vanilla').locator('.badge'), 'All taken');
  const ashaPlusDisabled = await asha.getByRole('button', { name: 'Add one Vanilla' }).isDisabled();
  console.log('Asha + Vanilla disabled after Ravi took the last one:', ashaPlusDisabled);
  if (!ashaPlusDisabled) throw new Error('Expected vanilla + to be disabled for Asha');

  // Asha picks more things until her personal limit (3) is reached
  await asha.getByRole('button', { name: 'Add one Chocolate' }).click();
  await asha.getByRole('button', { name: 'Add one Chocolate' }).click();
  await expectText(asha.locator('.my-bar'), "You've reached the limit");
  const strawberryDisabled = await asha.getByRole('button', { name: 'Add one Strawberry' }).isDisabled();
  console.log('Asha blocked by per-person limit of 3:', strawberryDisabled);
  if (!strawberryDisabled) throw new Error('Expected per-person limit to disable +');
  await asha.waitForTimeout(1600); // let highlight animations settle
  await shot(asha, '04-guest-phone-limit-reached');
  await shot(ravi, '05-guest-android');

  // Ravi takes the only mango sorbet; then gives vanilla back -> Asha can take it
  await ravi.getByRole('button', { name: 'Add one Mango sorbet' }).click();
  await expectText(row(asha, 'Mango sorbet').locator('.badge'), 'All taken');
  await ravi.getByRole('button', { name: 'Remove one Vanilla' }).click();
  await expectText(row(asha, 'Vanilla').locator('.badge'), 'Only 1 left');

  // ---------------- Host checks the People tab
  await expectText(row(host, 'Chocolate').locator('.claimants'), 'Asha ×2');
  await host.waitForTimeout(1600);
  await shot(host, '06-host-items-desktop');
  await host.getByRole('tab', { name: /People/ }).click();
  await expectText(host.locator('.person'), 'Vanilla, Chocolate ×2');
  await shot(host, '07-host-people-desktop');

  // Host settings dialog
  await host.getByRole('button', { name: 'List settings' }).click();
  await host.locator('dialog.sheet[open]').waitFor();
  await shot(host, '08-settings-desktop');
  await host.getByRole('button', { name: 'Cancel' }).click();

  // ---------------- Tablet view of a guest
  const tabCtx = await browser.newContext({ ...devices['iPad Mini'] });
  const tab = await tabCtx.newPage();
  watch(tab, 'tablet');
  await tab.goto(listUrl);
  await row(tab, 'Vanilla').waitFor();
  await shot(tab, '09-visitor-tablet');

  // Home page with "Your lists" on the phone
  await asha.goto(BASE + '/');
  await asha.locator('.my-list').first().waitFor();
  await shot(asha, '10-home-phone');

  console.log('Console errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch((err) => {
  console.error('E2E FAILED:', err);
  process.exit(1);
});
