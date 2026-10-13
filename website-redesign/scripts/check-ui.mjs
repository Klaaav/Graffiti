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
const effectsIntro = 'Take your wallpaper to a whole new level with six cursor-reactive effects.';
const queueNote = 'Select a clip to preview it.\nOne effect loads at a time.';
const heroCopy = 'Bring the wallpaper you already own. Graffiti adds cursor-reactive effects, a shape-based Gallery, and 3D wallpapers—all running locally on Windows.';
const galleryCopy = 'Draw custom shapes and fill them with images or solid colors to create a wallpaper that’s entirely your own.';
const modelIntro = 'Import a GLB model and let it live behind the desktop.';
const modelCopy = 'Web Wallpaper renders 3D models in an embedded WebView, which can use more RAM and GPU resources than native image effects.';
const downloadCopy = 'A lightweight Windows app for turning the wallpaper you already own into a responsive desktop scene.';
const downloadNote = 'Version 1.0 is available now; planned upgrades are listed alongside the current installer.';
const installerURL = 'https://github.com/Klaaav/Graffiti/raw/refs/heads/master/downloads/Graffiti_1.0.0_x64-setup.exe';

try {
  for (const scenario of [
    { name: 'desktop', viewport: { width: 1440, height: 1000 } },
    { name: 'wide-desktop', viewport: { width: 1920, height: 1080 } },
    { name: 'compact-laptop', viewport: { width: 1280, height: 600 }, deviceScaleFactor: 1.5 },
    { name: 'short-wide-desktop', viewport: { width: 1920, height: 720 } },
    { name: 'tablet', viewport: { width: 768, height: 1024 } },
    { name: 'mobile', viewport: { width: 390, height: 844 } },
    { name: 'short-mobile', viewport: { width: 390, height: 640 } },
    { name: 'narrow-mobile', viewport: { width: 320, height: 568 } },
    { name: 'touch-mobile', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
    { name: 'reduced-motion', viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' },
  ]) {
    const context = await browser.newContext({ viewport: scenario.viewport, deviceScaleFactor: scenario.deviceScaleFactor, reducedMotion: scenario.reducedMotion, hasTouch: scenario.hasTouch, isMobile: scenario.isMobile, colorScheme: 'dark' });
    const page = await context.newPage();
    const errors = [];
    const failedAssets = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.url().startsWith(baseURL.origin) && response.status() >= 400) failedAssets.push(`${response.status()} ${response.url()}`);
    });
    await page.goto(baseURL.href, { waitUntil: 'networkidle' });
    await page.locator('.hero-alt-stage').waitFor();
    // Check actual text at scrollY=0, before any locator can scroll it into view.
    const entryGeometry = await page.evaluate(() => {
      const rect = bounds => ({ top: bounds.top, right: bounds.right, bottom: bounds.bottom, left: bounds.left });
      const headline = document.createRange();
      headline.selectNodeContents(document.querySelector('#hero-title'));
      const letters = [...document.querySelectorAll('.hero-alt-wordmark span')].flatMap(node => {
        const text = node.firstChild;
        return [...text.textContent].map((letter, index) => {
          const range = document.createRange();
          range.setStart(text, index);
          range.setEnd(text, index + 1);
          return { letter, ...rect(range.getBoundingClientRect()) };
        });
      });
      return { width: innerWidth, height: innerHeight, scrollY, headline: rect(headline.getBoundingClientRect()), stage: rect(document.querySelector('.hero-alt-stage').getBoundingClientRect()), letters };
    });
    assert.equal(entryGeometry.scrollY, 0, 'Entry visibility is tested without scrolling.');
    assert.ok(entryGeometry.headline.top >= 0 && entryGeometry.headline.bottom <= entryGeometry.height && entryGeometry.headline.left >= 0 && entryGeometry.headline.right <= entryGeometry.width, `The entire hero headline must fit the first viewport: ${JSON.stringify(entryGeometry.headline)}`);
    assert.equal(entryGeometry.letters.length, 16, 'Both outline layers contain all eight letters.');
    for (const letter of entryGeometry.letters) {
      assert.ok(letter.top >= 0 && letter.bottom <= entryGeometry.height && letter.left >= 0 && letter.right <= entryGeometry.width, `The ${letter.letter} must fit the first viewport: ${JSON.stringify(letter)}`);
      assert.ok(letter.top >= entryGeometry.stage.top + 1 && letter.bottom <= entryGeometry.stage.bottom - 1 && letter.left >= entryGeometry.stage.left + 1 && letter.right <= entryGeometry.stage.right - 1, `The ${letter.letter} must not be clipped by the hero stage: ${JSON.stringify(letter)}`);
    }
    assert.equal(await page.locator('.hero-transmission img').count(), 1, 'The exact logo is the only hero image.');
    assert.equal(await page.locator('.hero-transmission').getByText('NO IMAGE REQUIRED').count(), 0);
    assert.equal(await page.locator('.hero-alt-wordmark-main').innerText(), 'GRAFFITI', 'The landing poster has a large GRAFFITI wordmark.');
    assert.equal(await page.locator('.hero-copy').innerText(), heroCopy, 'Hero copy names effects, Gallery, and 3D wallpapers.');
    assert.equal(await page.locator('.hero-alt-wordmark-main').evaluate(node => getComputedStyle(node).color), 'rgba(0, 0, 0, 0)', 'The vertical wordmark has a hollow interior.');
    assert.match(await page.locator('.hero-alt-wordmark').evaluate(node => getComputedStyle(node).transform), /matrix\([^)]*0, -1, 1, 0/, 'The wordmark is rotated vertically to the left.');
    assert.equal(await page.locator('.hero-alt-pointer').count(), 0, 'The oversized pointer sculpture is removed.');
    assert.equal(await page.locator('.hero-alt-prompt, .hero-alt-caption').count(), 0, 'The extra hero prompt and caption are removed.');
    assert.equal(await page.locator('.hero-alt-node').count(), 4, 'The hero has four additional geometric markers.');
    assert.equal(await page.locator('.hero-alt-meta').getByText(/WALLPAPER/).count(), 0, 'The hero metadata no longer says Wallpaper.');
    assert.equal(await page.locator('.signal-status').count(), 0, 'The local account status is removed from the header.');
    assert.equal(await page.getByText('PLAYING LOCALLY', { exact: true }).count(), 0, 'The effect stage no longer uses the generic local playback label.');
    assert.equal(await page.locator('.feedback-decor .feedback-tile').count(), 3, 'Feedback has restrained hard-offset decorative tiles.');
    assert.equal(await page.locator('.hero-brand-zone').getByText('A product of Klaav', { exact: true }).count(), 1, 'Klaav attribution is visible in the hero.');
    const logo = await page.locator('.hero-logo').evaluate(image => ({ loaded: image.complete && image.naturalWidth > 0, width: image.getBoundingClientRect().width }));
    assert.ok(logo.loaded && logo.width >= 100, 'The original logo is loaded at a readable size.');

    const artwork = page.locator('.hero-alt-stage');
    const bounds = await artwork.boundingBox();
    await artwork.scrollIntoViewIfNeeded();
    const updatedBounds = await artwork.boundingBox();
    await page.mouse.move(updatedBounds.x + updatedBounds.width * .8, updatedBounds.y + updatedBounds.height * .4);
    await page.waitForTimeout(750);
    const pointerX = await artwork.evaluate(node => Number(getComputedStyle(node).getPropertyValue('--alt-x')));
    if (scenario.reducedMotion === 'reduce' || scenario.hasTouch) assert.equal(pointerX, 0, 'Reduced motion and touch keep the artwork static.');
    else assert.ok(pointerX > 0, 'The artwork responds to actual mouse movement.');
    const movedWordmark = await artwork.evaluate(stage => {
      const bounds = stage.getBoundingClientRect();
      return [...stage.querySelectorAll('.hero-alt-wordmark span')].every(node => {
        const range = document.createRange();
        range.selectNodeContents(node);
        const ink = range.getBoundingClientRect();
        return ink.top >= bounds.top + 1 && ink.bottom <= bounds.bottom - 1 && ink.left >= bounds.left + 1 && ink.right <= bounds.right - 1;
      });
    });
    assert.ok(movedWordmark, 'Pointer motion must keep both complete outline layers inside the stage.');
    await page.mouse.move(0, 0);
    await page.waitForTimeout(750);
    await artwork.screenshot({ path: capturePath(`${scenario.name}-hero-detail.png`) });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: capturePath(`${scenario.name}-hero.png`) });
    assert.ok(bounds && bounds.width >= 60 && bounds.height > 160, 'The artwork has room to read at this viewport.');

    await artwork.focus();
    const outline = await artwork.evaluate(node => getComputedStyle(node).outlineStyle);
    assert.equal(outline, 'solid', 'The artwork link has visible keyboard focus.');
    await page.keyboard.press('Enter');
    await page.waitForURL('**/#effects');
    assert.equal(await page.locator('#effects [role="tab"]').allTextContents().then(names => names.map(name => name.replace(/^0\d/, '').replace('↗', '').trim())).then(names => names.join(', ')), 'Cursor reveal, Glass lens, Depth parallax, Gravity lens, Brick outline, Space ball');
    assert.equal(await page.locator('.console-heading > p:last-child').innerText(), effectsIntro, 'Effects intro copy describes the value of the effect library.');
    assert.equal(await page.locator('.queue-note').innerText(), queueNote, 'Effect queue helper copy is visitor-relevant.');
    await page.locator('.stage-header').waitFor();
    assert.match(await page.locator('.stage-header').innerText(), /ACTIVE EFFECT \/ CURSOR REVEAL/, 'The stage header identifies the selected effect.');

    const galleryLink = page.locator('.signal-footer').getByRole('link', { name: 'Gallery', exact: true });
    await galleryLink.click();
    await page.waitForURL('**/#gallery');
    await page.waitForTimeout(900);
    await page.locator('.gallery-intro').getByText(galleryCopy, { exact: true }).waitFor();
    assert.equal(await page.getByText(/\bassembly\b/i).count(), 0, 'The visitor-facing feature is Gallery everywhere.');
    const galleryTravel = await page.evaluate(() => {
      const gallery = document.querySelector('#gallery');
      const travel = gallery.getBoundingClientRect().height - innerHeight;
      const originalTravel = innerHeight * (matchMedia('(max-width: 920px)').matches ? 1.8 : 2.5);
      return { start: gallery.getBoundingClientRect().top + scrollY, travel, ratio: travel / originalTravel };
    });
    if (scenario.reducedMotion !== 'reduce') {
      assert.ok(Math.abs(galleryTravel.ratio - .7) < .002, `Gallery must take 30% less scroll travel: ${JSON.stringify(galleryTravel)}`);
      await page.evaluate(({ start, travel }) => window.scrollTo({ top: start + travel * .5, behavior: 'instant' }), galleryTravel);
      await page.waitForFunction(() => Math.abs(new DOMMatrix(getComputedStyle(document.querySelector('.gallery-progress span')).transform).a - .5) < .02);
      assert.equal(await page.locator('.resolved-collage').evaluate(node => getComputedStyle(node).opacity), '0', 'The Gallery animation still has an intermediate assembly state.');
      await page.evaluate(({ start, travel }) => window.scrollTo({ top: start + travel * .8, behavior: 'instant' }), galleryTravel);
      await page.waitForFunction(() => getComputedStyle(document.querySelector('.resolved-collage')).opacity === '1');
    }
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
    assert.equal(await page.locator('.board-stamp').innerText(), 'GALLERY', 'Gallery collage label identifies the Gallery section.');
    await page.locator('.gallery-sticky').screenshot({ path: capturePath(`${scenario.name}-gallery.png`) });
    await page.locator('#model').scrollIntoViewIfNeeded();
    assert.equal(await page.locator('.model-copy > p:not(.signal-kicker)').innerText(), modelIntro, 'Web Wallpaper intro copy is concise and section-specific.');
    assert.equal(await page.locator('.model-copy small').innerText(), modelCopy);
    assert.equal(await page.getByText('Pointer changes orientation only.', { exact: false }).count(), 0);
    await page.locator('.model-copy').screenshot({ path: capturePath(`${scenario.name}-web-wallpaper-copy.png`) });
    await page.locator('#download').scrollIntoViewIfNeeded();
    assert.equal(await page.locator('#download .utility-detail > p').innerText(), downloadCopy, 'Download copy describes the Windows app.');
    assert.equal(await page.locator('#download .utility-detail small').innerText(), downloadNote, 'Download availability note is visitor-facing.');
    await page.getByRole('button', { name: /Browse versions/ }).click();
    await page.locator('#release-dialog[open]').waitFor();
    assert.equal(await page.locator('#release-dialog').getByText('VERSION 1.0 / CURRENT', { exact: true }).count(), 1, 'Version 1.0 is listed as current.');
    assert.equal(await page.locator('#release-dialog').getByText('VERSION 1.1 / PLANNED', { exact: true }).count(), 1, 'The planned next version is listed.');
    assert.equal(await page.locator('#release-dialog').getByText('Curved shapes in Gallery alongside straight-sided shapes', { exact: true }).count(), 1, 'Curved Gallery shapes are listed as planned.');
    assert.equal(await page.locator('#release-dialog').getByText('Optional native 3D rendering alongside Web Wallpaper', { exact: true }).count(), 1, 'Native 3D rendering is listed as planned.');
    assert.equal(await page.locator('#release-dialog').getByText('New cursor-reactive effects', { exact: true }).count(), 1, 'New effects are listed as planned.');
    assert.equal(await page.locator('#release-dialog a[download]').getAttribute('href'), installerURL, 'Version 1.0 points to the repository installer.');
    if (scenario.reducedMotion !== 'reduce' && !scenario.hasTouch) {
      const dialogBounds = await page.locator('#release-dialog').boundingBox();
      const pointerTarget = { x: dialogBounds.x + 80, y: dialogBounds.y + 170 };
      await page.mouse.move(pointerTarget.x, pointerTarget.y);
      await page.waitForTimeout(100);
      const cursorPosition = await page.locator('.site-cursor').evaluate(node => { const rect = node.getBoundingClientRect(); return { left: rect.left, top: rect.top }; });
      assert.ok(Math.abs(cursorPosition.left - pointerTarget.x) <= 1.5 && Math.abs(cursorPosition.top - pointerTarget.y) <= 1.5, `Custom cursor tracks the native pointer in the popup: ${JSON.stringify({ pointerTarget, cursorPosition })}`);
    }
    await page.getByRole('button', { name: 'Close version list' }).click();
    assert.equal(await page.locator('#release-dialog[open]').count(), 0, 'The version popup closes.');
    await page.locator('#download').screenshot({ path: capturePath(`${scenario.name}-download.png`) });
    await page.locator('#feedback').scrollIntoViewIfNeeded();
    await page.waitForTimeout(750);
    await page.getByRole('button', { name: /View feedback/ }).click();
    await page.locator('.feedback-list').waitFor();
    assert.equal(await page.getByText(/No saved notes yet|Saved in this browser/).count() > 0, true, 'Feedback viewer opens.');
    await page.locator('#feedback').screenshot({ path: capturePath(`${scenario.name}-feedback.png`) });
    const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    assert.ok(layout.scrollWidth <= layout.width + 1, `Horizontal overflow: ${JSON.stringify(layout)}`);
    assert.deepEqual(failedAssets, [], 'Local production assets resolve.');
    assert.deepEqual(errors, [], 'No page JavaScript errors.');
    assert.equal(await page.locator('.feedback-type-options [role="radio"]').count(), 4, 'Feedback categories use buttons.');
    assert.equal(await page.getByRole('button', { name: /View feedback|Hide feedback/ }).count(), 1, 'Feedback list toggle is available.');
    assert.equal(await page.locator('.site-cursor').count(), 1, 'Custom cursor is present.');
    const cursorImage = await page.locator('.site-cursor').evaluate(image => ({ src: image.getAttribute('src'), loaded: image.complete && image.naturalWidth > 0, width: parseFloat(getComputedStyle(image).width) }));
    assert.ok(cursorImage.loaded && cursorImage.src?.includes('/cursor/taming-arrow-cursor.png'), 'The supplied arrow cursor asset is loaded.');
    assert.ok(cursorImage.width <= 17, `The arrow cursor remains compact: ${cursorImage.width}px.`);
    assert.equal(await page.locator('#download').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(214, 170, 74)', 'Download uses logo gold background.');
    results.push({ viewport: scenario.name, status: 'passed', firstViewportHighlights: 'headline and all eight wordmark letters visible', artworkResponds: scenario.reducedMotion !== 'reduce' && !scenario.hasTouch, keyboardNavigation: 'passed', gallery: 'visible and non-overlapping', galleryScrollReduction: scenario.reducedMotion === 'reduce' ? 'static' : `${Math.round((1 - galleryTravel.ratio) * 100)}%`, horizontalOverflow: false, failedLocalAssets: failedAssets, pageErrors: errors });
    await context.close();
  }
  await writeFile(new URL('ui-check.json', output), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
