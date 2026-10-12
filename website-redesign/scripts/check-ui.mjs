import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

// A separate headless browser for the local build; no user browser profile or CDP connection.
const baseURL = new URL(process.env.UI_TEST_URL ?? 'http://127.0.0.1:4335/');
assert.ok(['127.0.0.1', 'localhost'].includes(baseURL.hostname), 'This smoke check is local-only.');
const output = new URL('../docs/verification/', import.meta.url);
const capturePath = (name) => fileURLToPath(new URL(name, output));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.UI_TEST_BROWSER ?? 'msedge', headless: true });
const results = [];
const galleryCopy = 'Draw custom shapes and fill them with images or solid colors to create a wallpaper that’s entirely your own.';
const modelCopy = 'Web Wallpaper renders 3D models in an embedded WebView, which can use more RAM and GPU resources than native image effects.';

try {
  for (const scenario of [
    { name: 'desktop', viewport: { width: 1440, height: 1000 } },
    { name: 'wide-desktop', viewport: { width: 1920, height: 1080 } },
    { name: 'tablet', viewport: { width: 768, height: 1024 } },
    { name: 'mobile', viewport: { width: 390, height: 844 } },
    { name: 'touch-mobile', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
    { name: 'reduced-motion', viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' },
  ]) {
    const context = await browser.newContext({ viewport: scenario.viewport, reducedMotion: scenario.reducedMotion, hasTouch: scenario.hasTouch, isMobile: scenario.isMobile, colorScheme: 'dark' });
    const page = await context.newPage();
    const errors = [];
    const failedAssets = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.url().startsWith(baseURL.origin) && response.status() >= 400) failedAssets.push(`${response.status()} ${response.url()}`);
    });
    await page.goto(baseURL.href, { waitUntil: 'networkidle' });
    await page.locator('.hero-motion-stage').waitFor();
    assert.equal(await page.locator('.hero-transmission img').count(), 1, 'The exact logo is the only hero image.');
    assert.equal(await page.locator('.hero-transmission').getByText('NO IMAGE REQUIRED').count(), 0);
    const logo = await page.locator('.hero-logo').evaluate(image => ({ loaded: image.complete && image.naturalWidth > 0, width: image.getBoundingClientRect().width }));
    assert.ok(logo.loaded && logo.width >= 240, 'Large original logo is loaded.');

    const sculpture = page.locator('.hero-motion-stage');
    const bounds = await sculpture.boundingBox();
    await sculpture.scrollIntoViewIfNeeded();
    const updatedBounds = await sculpture.boundingBox();
    await page.mouse.move(updatedBounds.x + updatedBounds.width * .8, updatedBounds.y + updatedBounds.height * .4);
    await page.waitForTimeout(750);
    const pointerX = await sculpture.evaluate(node => Number(getComputedStyle(node).getPropertyValue('--pointer-x')));
    if (scenario.reducedMotion === 'reduce' || scenario.hasTouch) assert.equal(pointerX, 0, 'Reduced motion and touch keep the sculpture static.');
    else assert.ok(pointerX > 0, 'The sculpture responds to actual mouse movement.');
    await page.mouse.move(0, 0);
    await page.waitForTimeout(750);
    await sculpture.screenshot({ path: capturePath(`${scenario.name}-hero-detail.png`) });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: capturePath(`${scenario.name}-hero.png`) });
    assert.ok(bounds && bounds.width > 250, 'The artwork has room to read at this viewport.');

    await sculpture.focus();
    const outline = await sculpture.evaluate(node => getComputedStyle(node).outlineStyle);
    assert.equal(outline, 'solid', 'The artwork link has visible keyboard focus.');
    await page.keyboard.press('Enter');
    await page.waitForURL('**/#effects');
    assert.equal(await page.locator('#effects [role="tab"]').allTextContents().then(names => names.map(name => name.replace(/^0\d/, '').replace('↗', '').trim())).then(names => names.join(', ')), 'Cursor reveal, Glass lens, Depth parallax, Gravity lens, Brick outline, Space ball');

    const galleryLink = page.locator('.signal-footer').getByRole('link', { name: 'Gallery', exact: true });
    await galleryLink.click();
    await page.waitForURL('**/#gallery');
    await page.waitForTimeout(900);
    await page.locator('.gallery-intro').getByText(galleryCopy, { exact: true }).waitFor();
    assert.equal(await page.getByText(/\bassembly\b/i).count(), 0, 'The visitor-facing feature is Gallery everywhere.');
    await page.evaluate(() => {
      const gallery = document.querySelector('#gallery');
      const top = gallery.getBoundingClientRect().top + scrollY;
      window.scrollTo({ top: top + Math.max(0, gallery.offsetHeight - innerHeight) * .9, behavior: 'instant' });
    });
    await page.waitForTimeout(750);
    const galleryBoxes = await page.evaluate(() => {
      const copy = document.querySelector('.gallery-intro').getBoundingClientRect();
      const board = document.querySelector('.gallery-board').getBoundingClientRect();
      const overlap = Math.max(0, Math.min(copy.right, board.right) - Math.max(copy.left, board.left)) * Math.max(0, Math.min(copy.bottom, board.bottom) - Math.max(copy.top, board.top));
      return { overlap, collageOpacity: getComputedStyle(document.querySelector('.resolved-collage')).opacity };
    });
    assert.equal(galleryBoxes.overlap, 0, 'Gallery description and composition do not overlap.');
    assert.equal(galleryBoxes.collageOpacity, '1', 'The completed collage remains visible.');
    await page.locator('.gallery-sticky').screenshot({ path: capturePath(`${scenario.name}-gallery.png`) });
    await page.locator('#model').scrollIntoViewIfNeeded();
    assert.equal(await page.locator('.model-copy small').innerText(), modelCopy);
    assert.equal(await page.getByText('Pointer changes orientation only.', { exact: false }).count(), 0);
    await page.locator('.model-copy').screenshot({ path: capturePath(`${scenario.name}-web-wallpaper-copy.png`) });
    const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    assert.ok(layout.scrollWidth <= layout.width + 1, `Horizontal overflow: ${JSON.stringify(layout)}`);
    assert.deepEqual(failedAssets, [], 'Local production assets resolve.');
    assert.deepEqual(errors, [], 'No page JavaScript errors.');
    results.push({ viewport: scenario.name, status: 'passed', sculptureResponds: scenario.reducedMotion !== 'reduce' && !scenario.hasTouch, keyboardNavigation: 'passed', gallery: 'visible and non-overlapping', horizontalOverflow: false, failedLocalAssets: failedAssets, pageErrors: errors });
    await context.close();
  }
  await writeFile(new URL('ui-check.json', output), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
