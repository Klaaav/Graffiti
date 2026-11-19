interface SignalLoaderProps {
  visible: boolean;
  name: string;
}

export default function SignalLoader({ visible, name }: SignalLoaderProps) {
  return (
    <div
      className={`effect-loader-overlay ${visible ? 'is-active' : 'is-faded'}`}
      aria-hidden={!visible}
      role="status"
      aria-live="polite"
    >
      <div className="effect-loader-content">
        <span className="effect-loader-title">{name}</span>
        <span className="effect-loader-sub">Loading...</span>
      </div>
    </div>
  );
}
