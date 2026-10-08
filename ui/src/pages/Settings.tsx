import { useState, useEffect } from 'react';
import { enable, isEnabled, disable } from '@tauri-apps/plugin-autostart';
import { Power, MonitorPlay, EyeOff, Battery, Lock, Monitor } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { loadSettings, saveSettings, AppSettings, defaultSettings, resetToDefaults } from '../store';

export default function Settings() {
  const [autostart, setAutostart] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const auto = await isEnabled();
        setAutostart(auto);
      } catch (err) {
        console.warn("Autostart not supported/configured yet", err);
      }

      try {
        const s = await loadSettings();
        setSettings(s);
      } catch (err) {
        console.error("Settings init: loadSettings failed", err);
      }

      setLoading(false);
    }
    init();
  }, []);

  const toggleAutostart = async () => {
    try {
      if (autostart) {
        await disable();
      } else {
        await enable();
      }
      setAutostart(!autostart);
    } catch (err) {
      console.error(err);
    }
  };

  const updateSetting = async (key: keyof AppSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  const handleReset = async () => {
    if (confirm('Are you sure you want to reset all settings to defaults? This will restart the renderer.')) {
      await resetToDefaults();
      setSettings(defaultSettings);
    }
  };

  if (loading) {
    return <div style={{ padding: '32px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Loading settings...</div>;
  }

  const SettingRow = ({ icon: Icon, label, description, children }: {
    icon: LucideIcon;
    label: string;
    description: string;
    children: React.ReactNode;
  }) => (
    <div className="settings-row">
      <div className="settings-row-info">
        <Icon size={18} />
        <div>
          <strong>{label}</strong>
          <p>{description}</p>
        </div>
      </div>
      {children}
    </div>
  );

  return (
    <div style={{ maxWidth: '700px' }}>
      <div className="page-header">
        <h2 className="page-title">Settings</h2>
      </div>

      <div className="card">
        <div className="section-label" style={{ marginBottom: '14px' }}>System</div>

        <SettingRow
          icon={Power}
          label="Launch at Startup"
          description="Start Graffiti silently when you sign into Windows."
        >
          <button
            className={`toggle ${autostart ? 'on' : 'off'}`}
            onClick={toggleAutostart}
          >
            {autostart ? 'On' : 'Off'}
          </button>
        </SettingRow>
      </div>

      <div className="card">
        <div className="section-label" style={{ marginBottom: '14px' }}>Power & Performance</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <SettingRow
            icon={Monitor}
            label="Idle Timeout"
            description="Pause the engine if the mouse hasn't moved (seconds). 0 to disable."
          >
            <input
              type="number"
              min="0"
              step="0.1"
              value={settings.idleTimeout}
              onChange={(e) => updateSetting('idleTimeout', parseFloat(e.target.value) || 0)}
              style={{ width: '72px', textAlign: 'center' }}
            />
          </SettingRow>

          <SettingRow
            icon={EyeOff}
            label="Pause When Hidden"
            description="Pause when the desktop is fully covered by a window."
          >
            <button
              className={`toggle ${settings.pauseHidden ? 'on' : 'off'}`}
              onClick={() => updateSetting('pauseHidden', !settings.pauseHidden)}
            >
              {settings.pauseHidden ? 'On' : 'Off'}
            </button>
          </SettingRow>

          <SettingRow
            icon={MonitorPlay}
            label="Pause During Fullscreen"
            description="Pause during games or fullscreen video."
          >
            <button
              className={`toggle ${settings.pauseFullscreen ? 'on' : 'off'}`}
              onClick={() => updateSetting('pauseFullscreen', !settings.pauseFullscreen)}
            >
              {settings.pauseFullscreen ? 'On' : 'Off'}
            </button>
          </SettingRow>

          <SettingRow
            icon={Battery}
            label="Pause on Battery"
            description="Pause when unplugged or Battery Saver is active."
          >
            <button
              className={`toggle ${settings.pauseBattery ? 'on' : 'off'}`}
              onClick={() => updateSetting('pauseBattery', !settings.pauseBattery)}
            >
              {settings.pauseBattery ? 'On' : 'Off'}
            </button>
          </SettingRow>

          <SettingRow
            icon={Lock}
            label="Pause on Lock Screen"
            description="Pause when locked or on Remote Desktop."
          >
            <button
              className={`toggle ${settings.pauseSessionLocked ? 'on' : 'off'}`}
              onClick={() => updateSetting('pauseSessionLocked', !settings.pauseSessionLocked)}
            >
              {settings.pauseSessionLocked ? 'On' : 'Off'}
            </button>
          </SettingRow>
        </div>
      </div>

      <div className="card" style={{ borderColor: 'rgba(196, 92, 92, 0.15)' }}>
        <div className="section-label" style={{ color: 'var(--danger)', marginBottom: '10px' }}>Danger Zone</div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 14px 0' }}>
          Resets all settings and wallpaper pairings. The renderer will restart.
        </p>
        <button className="danger" onClick={handleReset}>
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}
