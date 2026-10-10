import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { Sparkles, SlidersHorizontal, Gem, Images, Box } from 'lucide-react';
import './index.css';

import Effects from './pages/Effects';
import Settings from './pages/Settings';
import { useEffect, useState } from 'react';
import About from './pages/About';
import Gallery from './pages/Gallery';
import WebWallpaper from './pages/WebWallpaper';
import { loadSettings, applySettingsToBackend, getActiveSession, loadEffectSettings, loadQualitySettings } from './store';
import { setSetting, isAutostart, startWebWallpaper, getWebConfig, setFpsCap, setResolutionScale } from './ipc';
import { applyWallpaper, setEffect } from './wallpaperManager';

function App() {
  const [showSplash, setShowSplash] = useState(false);
  const [splashExiting, setSplashExiting] = useState(false);

  useEffect(() => {
    isAutostart().then(async (isAuto) => {
      if (!isAuto) {
        // Fresh launch — apply engine settings, show welcome screen
        loadSettings().then(applySettingsToBackend).catch(console.error);
        setShowSplash(true);
        setTimeout(() => setSplashExiting(true), 2100);
        setTimeout(() => setShowSplash(false), 2900);
      } else {
        // Autostart (tray launch) — restore last session, then apply engine settings
        try {
          const session = await getActiveSession();
          if (session) {
            if (session.effect === 'web-wallpaper') {
              const config = await getWebConfig();
              if (config) {
                await startWebWallpaper(
                  config.model,
                  config.backgroundType,
                  config.backgroundColor,
                  config.backgroundImage || undefined,
                  config.rotationFactor,
                  config.zoomFactor,
                  config.offsetX,
                  config.offsetY,
                  config.enableVerticalRotation,
                  config.initialRotationX,
                  config.initialRotationY
                );
              }
            } else {
              await applyWallpaper(session.layerA, session.layerB);
              await setEffect(session.effect);
              const effectSettings = await loadEffectSettings(session.effect);
              if (effectSettings) {
                await new Promise(resolve => setTimeout(resolve, 500));
                for (const [k, v] of Object.entries(effectSettings)) {
                  await setSetting(k, v);
                }
              }
            }
          }
          // Restore quality settings regardless of active session
          const quality = await loadQualitySettings();
          if (quality.fpsCap !== null) await setFpsCap(quality.fpsCap);
          if (quality.resolutionScale !== null) await setResolutionScale(quality.resolutionScale);
          // Apply engine settings after session restore so they don't race
          const appSettings = await loadSettings();
          await applySettingsToBackend(appSettings);
        } catch (e) {
          console.error('[Autostart] Session restore failed:', e);
        }
      }
    }).catch(() => {
      loadSettings().then(applySettingsToBackend).catch(console.error);
      setShowSplash(true);
      setTimeout(() => setSplashExiting(true), 2100);
      setTimeout(() => setShowSplash(false), 2900);
    });
  }, []);

  return (
    <Router>
      {showSplash && (
        <div className={`splash-overlay${splashExiting ? ' exiting' : ''}`}>
          <img
            src="/logos/Graffiti_New_Logo_Transparent.png"
            alt="Graffiti"
            className="splash-logo"
          />
          <div className="splash-amber-bar" />
          <span className="splash-tagline">Desktop Wallpaper Effects</span>
        </div>
      )}

      <nav className="sidebar">
        <div className="sidebar-brand-area">
          <img
            src="/logos/Graffiti_New_Logo_Transparent.png"
            alt="Graffiti"
            className="sidebar-brand"
          />
        </div>

        <div className="sidebar-nav">
          <NavLink to="/effects" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
            <Sparkles />
            <span className="nav-label">Effects</span>
          </NavLink>
          <NavLink to="/gallery" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
            <Images />
            <span className="nav-label">Gallery</span>
          </NavLink>
          <NavLink to="/web-wallpaper" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
            <Box />
            <span className="nav-label">3D Web Wallpaper</span>
          </NavLink>
          <div className="sidebar-nav-divider" />
          <NavLink to="/settings" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
            <SlidersHorizontal />
            <span className="nav-label">Settings</span>
          </NavLink>
          <NavLink to="/about" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
            <Gem />
            <span className="nav-label">About</span>
          </NavLink>
        </div>

        <span className="sidebar-version">v1.0.0</span>
      </nav>

      <main className="content">
        <Routes>
          <Route path="/" element={<Navigate to="/effects" replace />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/effects" element={<Effects />} />
          <Route path="/web-wallpaper" element={<WebWallpaper />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </main>
    </Router>
  );
}

export default App;
