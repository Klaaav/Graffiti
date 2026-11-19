interface SignalLoaderProps {
  visible: boolean;
  mode?: 'effect' | 'model';
  title?: string;
  subtitle?: string;
}

export default function SignalLoader({
  visible,
  mode = 'effect',
  title = 'ACQUIRING SIGNAL',
  subtitle = 'BUFFERING FEED…',
}: SignalLoaderProps) {
  return (
    <div
      className={`signal-loader-overlay ${visible ? 'is-active' : 'is-faded'}`}
      aria-hidden={!visible}
    >
      <div className="signal-loader-hud">
        {/* Precision Viewfinder Reticle Brackets */}
        <span className="signal-bracket bracket-tl" aria-hidden="true" />
        <span className="signal-bracket bracket-tr" aria-hidden="true" />
        <span className="signal-bracket bracket-bl" aria-hidden="true" />
        <span className="signal-bracket bracket-br" aria-hidden="true" />

        {/* Central Radar Sweep & Target Reticle */}
        <div className="signal-reticle-wrap" aria-hidden="true">
          <div className="signal-reticle-ring" />
          <div className="signal-reticle-crosshair-h" />
          <div className="signal-reticle-crosshair-v" />
          <div className="signal-reticle-dot" />
        </div>

        {/* Equalizer Frequency Pulse Spectrum */}
        <div className="signal-spectrum" aria-hidden="true">
          <span className="signal-spectrum-bar bar-1" />
          <span className="signal-spectrum-bar bar-2" />
          <span className="signal-spectrum-bar bar-3" />
          <span className="signal-spectrum-bar bar-4" />
          <span className="signal-spectrum-bar bar-5" />
        </div>

        {/* Technical Telemetry Readout */}
        <div className="signal-loader-meta">
          <div className="signal-loader-kicker">
            <span className="signal-loader-pulse-dot" />
            <span>{mode === 'effect' ? 'OPTICAL FEED // REAL-TIME' : 'WEBVIEW 3D // GPU PIPELINE'}</span>
          </div>
          <strong className="signal-loader-title">{title}</strong>
          <span className="signal-loader-sub">{subtitle}</span>
        </div>
      </div>
      <div className="signal-scanline" aria-hidden="true" />
    </div>
  );
}
