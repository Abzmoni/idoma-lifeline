// Records a captioned walkthrough of the real app (DEMO.md script) to tools/artifacts/demo-video/.
// Usage: node tools/build-demo.cjs && node tools/record-demo.cjs
// Uses an isolated SQLite database; existing data is untouched. Road routing uses the live OSRM service.
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const outDir = path.join(__dirname, 'artifacts', 'demo-video');
const port = 3110, base = `http://127.0.0.1:${port}`;
const delay = ms => new Promise(r => setTimeout(r, ms));

async function caption(page, text, ms = 3200) {
  await page.evaluate(t => {
    let el = document.getElementById('demo-caption');
    if (!el) {
      el = document.createElement('div');
      el.id = 'demo-caption';
      el.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:99999;max-width:880px;padding:14px 22px;'
        + 'background:rgba(27,36,48,.94);color:#fff;font:600 21px/1.35 Segoe UI,Arial,sans-serif;border-radius:10px;'
        + 'box-shadow:0 8px 30px rgba(0,0,0,.35);text-align:center;pointer-events:none;border-left:6px solid #E8600C';
      document.body.appendChild(el);
    }
    el.textContent = t;
  }, text);
  await delay(ms);
}
async function card(page, title, subtitle, ms = 3500) {
  await page.evaluate(([t, s]) => {
    const el = document.createElement('div');
    el.id = 'demo-card';
    el.style.cssText = 'position:fixed;inset:0;z-index:100000;background:#1B2430;color:#fff;display:flex;flex-direction:column;'
      + 'justify-content:center;padding:0 110px;font-family:Segoe UI,Arial,sans-serif';
    el.innerHTML = `<div style="color:#E8600C;font:700 18px Segoe UI;letter-spacing:3px">IDOMA CENTENARY HACKATHON 2026</div>`
      + `<div style="font:800 64px Segoe UI;margin:14px 0">${t}</div><div style="font:400 26px Segoe UI;color:#d6dbe1">${s}</div>`;
    document.body.appendChild(el);
  }, [title, subtitle]);
  await delay(ms);
  await page.evaluate(() => document.getElementById('demo-card')?.remove());
}
async function press(locator, ms = 650) {
  await locator.scrollIntoViewIfNeeded();
  await locator.evaluate(el => { el.style.outline = '4px solid #E8600C'; el.style.outlineOffset = '2px'; });
  await delay(ms);
  await locator.evaluate(el => { el.style.outline = ''; });
  await locator.click();
}
const tilesReady = page => page.waitForFunction(() => document.querySelectorAll('.leaflet-tile-loaded').length >= 6, null, { timeout: 20000 }).catch(() => {});

(async () => {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const server = spawn(process.execPath, ['backend/server.js'], {
    cwd: root, windowsHide: true, stdio: 'ignore',
    env: { ...process.env, PORT: String(port), DATABASE_URL: '', SQLITE_PATH: path.join(outDir, 'demo.db'), JWT_SECRET: 'demo-recording' },
  });
  let browser;
  try {
    for (let i = 0; i < 60; i++) { try { await fetch(base + '/api/resources'); break; } catch { await delay(250); } }
    browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: outDir, size: { width: 1280, height: 720 } },
      geolocation: { latitude: 7.1935, longitude: 8.1372, accuracy: 12 }, permissions: ['geolocation'] });
    const page = await context.newPage();

    // Warm-up: install the service worker so the offline scene is real.
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await page.waitForFunction(() => document.querySelectorAll('.resource-pin').length >= 10);
    await tilesReady(page);

    await card(page, 'Idoma Lifeline', 'Live prototype walkthrough · sample data');
    await caption(page, 'A displaced family near Otukpo needs shelter. Local information changes fast, and the network can drop.', 4500);

    // 1. Find shelter
    await press(page.locator('.need-filters').getByRole('button', { name: 'Shelter' }));
    await caption(page, 'One tap on a need: the nearest verified shelters appear, closest first, with when each was last checked.', 4200);
    await press(page.locator('.resource-row').first());
    await page.locator('.resource-details').waitFor();
    await tilesReady(page);
    await caption(page, 'Capacity, last-verified time and a direct call button. Reporter phone numbers stay private.', 4200);

    // 2. Directions (live road-routing provider)
    await press(page.locator('.resource-details').getByRole('button', { name: 'Directions', exact: true }));
    await page.locator('.route-result').waitFor({ timeout: 20000 });
    await tilesReady(page);
    await caption(page, 'One tap on Directions: the way from where you are, walking time, and any reported dangers on the route.', 4800);
    await caption(page, 'Routes are saved on the phone, so directions still work when the network drops.', 3600);
    await press(page.locator('.route-result').getByRole('button', { name: 'Close route' }));

    // 3. Language
    await page.locator('.need-filters').getByRole('button', { name: 'All', exact: true }).click();
    await caption(page, 'One tap switches the interface to Pidgin. Idoma is next, written by native speakers.', 2600);
    await page.locator('.language-select').evaluate(el => { el.style.outline = '4px solid #E8600C'; });
    await delay(600);
    await page.selectOption('.language-select', 'pcm');
    await page.locator('.language-select').evaluate(el => { el.style.outline = ''; });
    await caption(page, '“Place to stay”, “Hospital”, “Danger”: the categories people actually say.', 3800);
    await page.selectOption('.language-select', 'en');
    await delay(800);

    // 4. Offline
    await caption(page, 'Now the network drops…', 2200);
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByText(/Offline · Saved information/).waitFor();
    await tilesReady(page);
    await caption(page, 'Reloaded with no connection: the app, saved places and the full street map of Idoma land all still work.', 4500);
    await press(page.locator('.need-filters').getByRole('button', { name: 'Medical' }));
    await press(page.locator('.resource-row').first());
    await press(page.locator('.resource-details').getByRole('button', { name: 'Directions', exact: true }));
    await page.locator('.route-result').waitFor({ timeout: 20000 });
    await caption(page, 'Directions with no internet: the road route saved on this phone, or a compass direction if none is saved.', 5000);
    await press(page.locator('.route-result').getByRole('button', { name: 'Close route' }));
    await page.locator('.need-filters').getByRole('button', { name: 'Medical' }).click();

    // 5. Report while offline
    await press(page.locator('.report-action'));
    await page.getByRole('heading', { name: 'What do you want to report?' }).waitFor();
    await caption(page, 'Reporting is three big steps, with no sign-up. Even offline. First: what is it?', 3200);
    await press(page.getByRole('button', { name: 'Water', exact: true }));
    await page.getByText(/The pin is on your location|last known location/).waitFor();
    await tilesReady(page);
    await caption(page, 'Where? The pin is placed automatically: phone GPS works without data, or the last known location is used.', 4800);
    await press(page.getByRole('button', { name: "Yes, it's here" }));
    await caption(page, 'Anything to add? All optional: a name, a note, a private phone number.', 3000);
    await page.getByPlaceholder("e.g. St. Mary's Church hall").pressSequentially('Water point near Otukpo market', { delay: 55 });
    await press(page.getByRole('button', { name: 'Save report', exact: true }));
    await page.getByRole('heading', { name: 'Saved on this device.' }).waitFor();
    await caption(page, 'Saved on this phone. It sends by itself when the network returns.', 3400);
    await press(page.getByRole('button', { name: 'Back to map' }));
    await page.getByText('1 report waiting to sync').waitFor();
    await caption(page, 'The map shows 1 report waiting to sync.', 3000);

    // 6. Reconnect
    await context.setOffline(false);
    await caption(page, 'Connection returns…', 1800);
    const syncButton = page.locator('.data-strip').getByRole('button', { name: 'Sync now' });
    if (await syncButton.count()) await press(syncButton);
    await page.getByText(/Report synced/).waitFor({ timeout: 15000 }).catch(() => {});
    await caption(page, 'Report synced. It now waits for a local coordinator to verify it.', 3800);

    // 7. Coordinator review
    const login = await (await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+2348012345678', password: '123456' }) })).json();
    await page.evaluate(data => { localStorage.setItem('idoma-lifeline_token', data.token); localStorage.setItem('idoma-lifeline_user', JSON.stringify(data.user)); }, login);
    await page.goto(base + '/#/admin', { waitUntil: 'domcontentloaded' });
    const reportCard = page.getByText('Water point near Otukpo market', { exact: true }).locator('xpath=ancestor::div[contains(@class,"p-4")][1]');
    await reportCard.waitFor();
    await caption(page, 'The coordinator dashboard: incoming reports from the app, SMS and USSD.', 3800);
    await press(reportCard.getByRole('button', { name: 'Approve (Verify)', exact: true }), 900);
    await page.getByText('Report approved. It is now available on the public map.').waitFor();
    await delay(1200);
    await caption(page, 'Verified and published. The impact row tracks review speed, SMS/USSD share and records needing re-check.', 5000);

    // 8. USSD on a basic phone (simulator)
    await press(page.getByRole('button', { name: /Simulator/ }));
    await press(page.getByRole('button', { name: 'USSD Session Mode' }));
    await caption(page, 'No smartphone? Dial a short code from any basic phone. (Gateway simulated in this prototype.)', 3600);
    await press(page.getByRole('button', { name: 'Dial *384#' }));
    for (const [input, note] of [['3', 'Option 3 switches the menu to Pidgin.'], ['1', 'Find help near you…'], ['2', 'Water.'], ['Otukpo market', 'Type the nearest place: no GPS needed.']]) {
      await page.getByPlaceholder('Reply...').waitFor();
      await caption(page, note, 1800);
      await page.getByPlaceholder('Reply...').pressSequentially(input, { delay: 90 });
      await press(page.getByRole('button', { name: 'Send', exact: true }), 450);
      await delay(1300);
    }
    await caption(page, 'The nearest verified water point comes back as a text reply, with no data used.', 4800);

    // 9. Back to the public map
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelectorAll('.resource-pin').length >= 11);
    await press(page.locator('.need-filters').getByRole('button', { name: 'Water' }));
    await page.getByPlaceholder('Name or landmark').pressSequentially('Water point', { delay: 60 });
    await caption(page, 'The newly verified water point is live on the public map for everyone.', 4200);

    await card(page, 'Help, found. On every phone.', 'Online · Offline · USSD  —  one verified directory', 4000);
    await page.close();
    await context.close();
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
  const video = fs.readdirSync(outDir).find(f => f.endsWith('.webm'));
  console.log(path.join(outDir, video));
})().catch(e => { console.error(e); process.exitCode = 1; });
