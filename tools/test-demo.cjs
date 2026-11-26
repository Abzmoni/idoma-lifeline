const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const base = 'http://127.0.0.1:3107';
const delay = ms => new Promise(r => setTimeout(r, ms));
let server, browser;
async function api(endpoint, data, token) {
  const response = await fetch(base + endpoint, { method: data ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
  const result = await response.json();
  if (!response.ok) throw new Error(response.status + ' ' + JSON.stringify(result));
  return result;
}
(async () => {
  const { suggestedRoute, routeHazards } = await import(pathToFileURL(path.join(root, 'frontend/src/routing.js')));
  const a = { lat: 0, lng: 0 }, b = { lat: 0, lng: 1 }, hazard = { lat: 0, lng: .5 };
  const direct = { points: [a, b], distance: 111 };
  const blocked = await suggestedRoute(a, b, [hazard], async () => direct);
  assert.equal(blocked.avoided, 0); assert.equal(blocked.remaining, 1);
  const clear = await suggestedRoute(a, b, [hazard], async points => points.length === 2 ? direct : ({ points: [a, { lat: .2, lng: .2 }, { lat: .2, lng: .8 }, b], distance: 140 }));
  assert.equal(clear.avoided, 1); assert.equal(clear.remaining, 0);
  const failedDetours = await suggestedRoute(a, b, [hazard], async points => { if (points.length > 2) throw new Error('timeout'); return direct; });
  assert.equal(failedDetours.avoided, 0); assert.equal(failedDetours.remaining, 1);
  assert.equal(routeHazards([a, b], [hazard, { lat: 1, lng: 1 }]).length, 1);
  console.log('PASS route safety: blocked detours, clear detours, failures and hazard counts');

  fs.mkdirSync(path.join(__dirname, 'artifacts'), { recursive: true });
  server = spawn(process.execPath, ['backend/server.js'], { cwd: root, windowsHide: true, env: { ...process.env, PORT: '3107', DATABASE_URL: '', SQLITE_PATH: path.join(__dirname, 'artifacts', `demo-${Date.now()}.db`), JWT_SECRET: 'isolated-test-secret' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = ''; server.stdout.on('data', b => logs += b); server.stderr.on('data', b => logs += b);
  for (let i = 0; i < 60; i++) { try { await api('/api/resources'); break; } catch { if (i === 59) throw new Error(logs); await delay(250); } }
  const login = await api('/api/auth/login', { phone: '+2348012345678', password: '123456' });
  const privateNumber = '+2348000000011', publicNumber = '+2348000000022';
  const payload = { type: 'water', name: 'Privacy regression fixture', location: { lat: 7.19, lng: 8.13 }, reporter_contact: privateNumber, public_contact: publicNumber, client_request_id: crypto.randomUUID() };
  const reports = await Promise.all(Array.from({ length: 5 }, () => api('/api/reports', payload)));
  assert.equal(new Set(reports.map(r => r.id)).size, 1);
  const approved = await api(`/api/reports/${reports[0].id}/approve`, {}, login.token);
  assert.equal(approved.resource.contact_phone, publicNumber);
  const publicRecord = await api(`/api/resources/${approved.resource.id}`);
  assert.ok(!JSON.stringify(publicRecord).includes(privateNumber));
  const privateOnly = await api('/api/reports', { ...payload, name: 'Private-only fixture', public_contact: '', client_request_id: crypto.randomUUID() });
  const privateApproval = await api(`/api/reports/${privateOnly.id}/approve`, {}, login.token);
  assert.equal(privateApproval.resource.contact_phone, null);
  const unauthorized = await fetch(base + '/api/resources?status=all'); assert.equal(unauthorized.status, 401);
  const invalid = await fetch(base + '/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, location: { lat: 200, lng: 8 } }) }); assert.equal(invalid.status, 400);
  console.log('PASS API: concurrent report deduplication, public/private contacts, coordinate validation, access control');

  const ussd = async text => (await fetch(base + '/api/sms/ussd', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 's1', phoneNumber: '+2348000000033', serviceCode: '*384#', text }) })).text();
  assert.match(await ussd(''), /3\. Pidgin/);
  assert.match(await ussd('3'), /Find help near you[\s\S]*3\. English/);
  assert.match(await ussd('3*1'), /Wetin you need\?/);
  assert.match(await ussd('3*1*2*Otukpo market'), /^END Water wey near pass: /);
  assert.match(await ussd('3*3*1'), /Select resource type/);
  assert.match(await ussd('1*3*near Igumale please'), /^END Nearest MEDICAL: /);
  assert.match(await ussd('1*1*Lagos'), /^END Place not recognised\. Try a town such as Otukpo/);
  assert.match(await ussd('1*1*o'), /^END Place not recognised/);
  const stats = await api('/api/admin/stats', null, login.token);
  assert.equal(stats.impact.reviewed_total, 2);
  assert.equal(stats.impact.reviewed_within_24h_pct, 100);
  assert.ok(Number.isInteger(stats.impact.median_review_minutes));
  assert.ok(stats.impact.basic_phone_share_pct >= 0 && stats.impact.stale_resources >= 0);
  console.log('PASS USSD/SMS: Pidgin menus, LGA towns, unknown places; impact stats');

  browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, geolocation: { latitude: 6.45, longitude: 3.39, accuracy: 25000 }, permissions: ['geolocation'] });
  const page = await context.newPage(); const errors = []; page.on('pageerror', e => { errors.push(e.message); console.log('BROWSER ERROR', e.message); });
  page.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') console.log('BROWSER', m.text()); });
  page.on('response', r => { if (r.url().includes('/api/resources')) console.log('Resources response:', r.status(), r.url()); });
  await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.getByRole('heading', { name: 'What do you need?' }).waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.resource-pin').length >= 10);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await page.waitForFunction(async () => (await (await caches.open('lifeline-visited-tiles-v2')).keys()).length > 0);
  // Location should not have been requested automatically.
  await page.screenshot({ path: path.join(__dirname, 'artifacts/map-home.png') });
  assert.equal(await page.locator('.location-notice').count(), 0);
  await page.getByRole('button', { name: 'Use my location', exact: true }).click();
  await page.getByText(/Browser accuracy: about 25.0 km/).waitFor().catch(async e => { console.log('Location UI:', await page.locator('.location-notice').innerText()); await page.screenshot({ path: path.join(__dirname, 'artifacts/location-error.png') }); throw e; });
  await page.screenshot({ path: path.join(__dirname, 'artifacts/laptop-location.png') });
  await page.getByRole('button', { name: 'Use this estimate' }).click();
  await page.getByRole('button', { name: 'More options' }).click();
  await page.getByRole('button', { name: 'Otukpo demo' }).click();
  await context.setGeolocation({ latitude: 7.19, longitude: 8.13, accuracy: 8 });
  await page.getByRole('button', { name: 'Use my location', exact: true }).click();
  await page.getByText(/Browser accuracy: about 8 m/).waitFor();
  await page.getByRole('button', { name: 'More options' }).click();
  await page.getByRole('button', { name: 'Otukpo demo' }).click();
  await page.getByRole('button', { name: 'Dismiss location message' }).click();
  await page.getByRole('button', { name: 'List view', exact: true }).click();
  await page.locator('.resource-row').first().click();
  await page.locator('.resource-details').waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('.leaflet-tile')].some(img => img.complete && img.naturalWidth === 256));
  await page.screenshot({ path: path.join(__dirname, 'artifacts/desktop.png') });
  const destinationName = await page.locator('.resource-details h2').innerText();
  // Deterministic road provider: this geometry passes a verified hazard and cannot avoid it.
  await page.route('https://router.project-osrm.org/**', route => route.fulfill({ json: { routes: [{ distance: 65000, geometry: { coordinates: [[8.1345, 7.1904], [8.05, 7.35], [7.8333, 7.5833]] } }] } }));
  await page.locator('.resource-details').getByRole('button', { name: 'Directions', exact: true }).click();
  await page.locator('.route-result').getByText(/^Road route ·/).waitFor();
  assert.ok((await page.locator('.route-result').innerText()).includes(destinationName));
  assert.equal(await page.locator('.route-panel').count(), 0);
  console.log('PASS one-tap directions: a place card shows the route straight away');
  await page.getByRole('button', { name: 'Close route', exact: true }).click();

  await page.getByRole('button', { name: 'Directions', exact: true }).click();
  await page.getByRole('button', { name: 'Place a pin', exact: true }).click();
  await page.locator('.map-surface').click({ position: { x: 1000, y: 500 } });
  await page.getByRole('heading', { name: 'Plan your journey' }).waitFor();
  assert.equal(await page.locator('.route-panel select').first().inputValue(), 'location');
  assert.equal(await page.getByRole('button', { name: 'Show the way' }).isEnabled(), true);
  assert.equal(await page.locator('.location-notice').count(), 0);
  console.log('PASS pin placement: route form reopens with the chosen pin as the start');
  await page.getByRole('button', { name: 'More options' }).click();
  await page.getByRole('button', { name: 'Otukpo demo', exact: true }).click();
  await page.getByRole('button', { name: 'Dismiss location message' }).click();
  await page.getByRole('button', { name: 'Directions', exact: true }).click();
  await page.getByRole('button', { name: 'Show the way' }).click();
  await page.locator('.route-result').getByText(/reported danger\(s\) near this way/).waitFor();
  assert.equal(await page.locator('.route-result').getByText(/Went around/).count(), 0);
  await page.screenshot({ path: path.join(__dirname, 'artifacts/route-warning.png') });
  console.log('PASS browser: approximate laptop fix, precise phone fix, explicit confirmation, resource cards, hazard warning');

  await context.setOffline(true);
  await page.locator('.route-result').getByText(/reported danger/).waitFor();
  // Offline, the same journey uses the road route saved on this phone.
  await page.getByRole('button', { name: 'Directions', exact: true }).click();
  await page.getByRole('button', { name: 'Show the way' }).click();
  await page.locator('.route-result').getByText(/^Saved road route ·/).waitFor();
  await page.locator('.route-result').getByText(/No internet, so this is a route saved on this phone/).waitFor();
  // A journey never fetched before still gets a compass direction and distance.
  await page.getByRole('button', { name: 'Directions', exact: true }).click();
  await page.locator('.route-panel select').nth(1).selectOption('market');
  await page.getByRole('button', { name: 'Show the way' }).click();
  await page.locator('.route-result').getByText(/^Go (north|south|east|west|north-east|north-west|south-east|south-west) · /).waitFor();
  await page.locator('.route-result .route-compass').waitFor();
  await page.screenshot({ path: path.join(__dirname, 'artifacts/route-offline-compass.png') });
  console.log('PASS offline directions: saved road route, then compass direction when nothing is saved');
  await page.reload();
  await page.getByText(/Offline · Saved information/).waitFor();
  await page.getByRole('button', { name: '+ Report a resource or hazard', exact: true }).click();
  const reportName = 'Offline browser fixture';
  await page.getByRole('button', { name: 'Water', exact: true }).click();
  // GPS works offline: the pin is placed automatically, no manual confirmation step.
  await page.getByText(/The pin is on your location/).waitFor();
  await page.getByRole('button', { name: "Yes, it's here" }).click();
  await page.getByPlaceholder("e.g. St. Mary's Church hall").fill(reportName);
  await page.getByRole('button', { name: 'Save report', exact: true }).click();
  await page.getByRole('heading', { name: 'Saved on this device.' }).waitFor();
  await page.getByRole('button', { name: 'Back to map' }).click();
  await page.getByText('1 report waiting to sync').waitFor();
  await page.screenshot({ path: path.join(__dirname, 'artifacts/offline.png') });
  // Reopen while online: startup sync must work without an online event in the old tab.
  await page.close(); await context.setOffline(false);
  const reopened = await context.newPage(); await reopened.goto(base);
  for (let i = 0; i < 40; i++) {
    const rows = await api('/api/reports?status=pending', null, login.token);
    const matches = rows.filter(r => r.name === reportName);
    if (matches.length) { assert.equal(matches.length, 1); break; }
    if (i === 39) throw new Error('Startup sync failed'); await delay(250);
  }
  await reopened.getByRole('button', { name: 'More options' }).click();
  await reopened.getByRole('button', { name: 'Sync now', exact: true }).click();
  assert.equal((await api('/api/reports?status=pending', null, login.token)).filter(r => r.name === reportName).length, 1);
  console.log('PASS browser: offline reload, offline report queue, startup sync and repeated sync');
  const admin = await context.newPage();
  await admin.goto(base, { waitUntil: 'domcontentloaded' });
  await admin.evaluate(data => { localStorage.setItem('idoma-lifeline_token', data.token); localStorage.setItem('idoma-lifeline_user', JSON.stringify(data.user)); }, login);
  await admin.goto(base + '/#/admin', { waitUntil: 'domcontentloaded' });
  await admin.getByText(reportName, { exact: true }).waitFor();
  await admin.waitForFunction(() => document.querySelectorAll('.custom-admin-marker').length > 0);
  await admin.getByText(reportName, { exact: true }).locator('xpath=ancestor::div[contains(@class,"p-4")][1]').getByRole('button', { name: 'Approve (Verify)', exact: true }).click();
  await admin.getByText('Report approved. It is now available on the public map.').waitFor();
  await reopened.bringToFront();
  await reopened.reload({ waitUntil: 'domcontentloaded' });
  await reopened.getByRole('button', { name: 'List view', exact: true }).click();
  await reopened.locator('.resource-list').getByRole('button', { name: new RegExp(reportName) }).waitFor();
  await reopened.getByRole('button', { name: 'Map view', exact: true }).click();
  await admin.close();
  console.log('PASS coordinator browser: map initialization, report approval, public resource visibility');
  await reopened.setViewportSize({ width: 390, height: 844 });
  if (await reopened.getByRole('button', { name: 'Dismiss notification' }).count()) await reopened.getByRole('button', { name: 'Dismiss notification' }).click();
  await reopened.waitForFunction(() => [...document.querySelectorAll('.leaflet-tile')].filter(img => img.complete && img.naturalWidth === 256 && Number(getComputedStyle(img).opacity) === 1).length >= 4);
  await reopened.screenshot({ path: path.join(__dirname, 'artifacts/mobile.png') });
  await reopened.getByRole('button', { name: 'List view', exact: true }).click();
  await reopened.locator('.resource-row').first().click();
  await reopened.waitForFunction(() => !document.querySelector('.leaflet-zoom-anim') && [...document.querySelectorAll('.leaflet-tile')].filter(img => img.complete && img.naturalWidth === 256 && Number(getComputedStyle(img).opacity) === 1).length >= 4);
  await reopened.screenshot({ path: path.join(__dirname, 'artifacts/mobile-card.png') });
  assert.equal(await reopened.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errors, []);
  console.log('PASS mobile layout width and browser runtime errors');

  // No GPS available: the report pin falls back to the last known location saved on this phone,
  // and with nothing saved the person is asked to tap the map or choose a town.
  const noGps = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const lastPage = await noGps.newPage(); lastPage.on('pageerror', e => errors.push(e.message));
  await lastPage.goto(base + '/#/report', { waitUntil: 'domcontentloaded' });
  await lastPage.getByRole('button', { name: 'Shelter', exact: true }).click();
  await lastPage.getByText(/couldn't find your location/).waitFor();
  assert.equal(await lastPage.getByRole('button', { name: "Yes, it's here" }).isDisabled(), true);
  await lastPage.getByRole('combobox', { name: 'Or choose a town' }).selectOption('Adoka');
  await lastPage.getByText('Pin placed at Adoka.').waitFor();
  await lastPage.evaluate(() => localStorage.setItem('lifeline-last-location', JSON.stringify({ lat: 7.19, lng: 8.13, accuracy: 15, at: Date.now() - 2 * 3600000 })));
  await lastPage.reload({ waitUntil: 'domcontentloaded' });
  await lastPage.getByRole('button', { name: 'Shelter', exact: true }).click();
  await lastPage.getByText(/last known location \(2 h ago\)/).waitFor();
  await lastPage.getByRole('button', { name: "Yes, it's here" }).click();
  await lastPage.getByRole('heading', { name: 'Anything to add?' }).waitFor();
  assert.equal(await lastPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await noGps.close();
  assert.deepEqual(errors, []);
  console.log('PASS report location: last known fallback, town choice, no manual confirmation');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  if (server) server.kill();
});
