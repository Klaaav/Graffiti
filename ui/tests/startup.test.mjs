import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Exercise the real store module against the same asynchronous store boundary,
// without a WebView, a running renderer or a new test-framework dependency.
function createStore(values = {}) {
  const data = new Map(Object.entries(values));
  const calls = { entries: 0, renderer: 0 };
  const fakeStore = {
    entries: async () => { calls.entries++; return structuredClone([...data.entries()]); },
    get: async key => structuredClone(data.get(key)),
    set: async (key, value) => { data.set(key, structuredClone(value)); },
    save: async () => {},
    clear: async () => data.clear(),
  };
  const code = ts.transpileModule(readFileSync(new URL('../src/store.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  runInNewContext(code, {
    exports,
    require: name => {
      if (name === '@tauri-apps/plugin-store') return { load: async () => fakeStore };
      if (name === './ipc') return {
        setSetting: () => { calls.renderer++; return new Promise(() => {}); },
        setSettingStr: () => { calls.renderer++; return new Promise(() => {}); },
      };
      throw new Error(`Unexpected module: ${name}`);
    },
  });
  return { store: exports, calls };
}

test('saved images and parameters hydrate in one local read without waiting for a renderer', async () => {
  const { store, calls } = createStore({
    effectSettings: {
      cursor_reveal: { layerA: 'A.png', layerB: 'B.png', brushSize: 170 },
      depth_parallax: { testWallpaper: 'mountain.jpg', depthMap: 'mountain_depth.png', parallaxStrength: 0.4 },
    },
    lastSelectedEffect: 'depth_parallax',
    activeSession: { effect: 'depth_parallax', layerA: 'mountain.jpg', layerB: 'mountain_depth.png' },
  });
  const state = await store.loadStartupState();
  assert.equal(state.effects.cursor_reveal.layerB, 'B.png');
  assert.equal(state.effects.depth_parallax.depthMap, 'mountain_depth.png');
  assert.equal(state.effects.depth_parallax.parallaxStrength, 0.4);
  assert.equal(state.selectedEffect, 'depth_parallax');
  assert.equal(state.session.effect, 'depth_parallax');
  assert.equal(calls.entries, 1);
  assert.equal(calls.renderer, 0);
});

test('startup preserves zero/false choices and supplies missing defaults', async () => {
  const { store } = createStore({ fpsCap: 0, idleTimeout: 0, pauseHidden: false, resolutionMode: 'auto' });
  const state = await store.loadStartupState();
  assert.equal(state.quality.fpsCap, 0);
  assert.equal(state.settings.idleTimeout, 0);
  assert.equal(state.settings.pauseHidden, false);
  assert.equal(state.settings.pauseFullscreen, true);
  assert.equal(state.quality.resolutionMode, 'auto');
  assert.equal(state.session, null);
});

test('startup snapshot waits for queued saves and preserves per-effect images', async () => {
  const { store } = createStore({ effectSettings: { cursor_reveal: { layerA: 'A.png', layerB: 'B.png' } } });
  const first = store.saveEffectSettings('cursor_reveal', { brushSize: 180 });
  const second = store.saveEffectSettings('cursor_reveal', { trailLength: 2 });
  const snapshot = store.loadStartupState();
  await Promise.all([first, second]);
  const state = await snapshot;
  assert.equal(state.effects.cursor_reveal.brushSize, 180);
  assert.equal(state.effects.cursor_reveal.trailLength, 2);
  assert.equal(state.effects.cursor_reveal.layerA, 'A.png');
});
