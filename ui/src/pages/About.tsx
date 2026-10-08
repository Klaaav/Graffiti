import { Code, Globe, HeartHandshake } from 'lucide-react';

export default function About() {
  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', paddingTop: '48px' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <img
          src="/logos/Graffiti_New_Logo_Transparent.png"
          alt="Graffiti"
          style={{ height: 'auto', width: '200px', objectFit: 'contain', marginBottom: '16px', filter: 'drop-shadow(0 2px 12px rgba(212,165,116,0.2))' }}
        />
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '0 0 12px 0' }}>
          A Klaaav product
        </p>
        <span style={{
          display: 'inline-block',
          padding: '3px 12px',
          background: 'var(--accent-muted)',
          color: 'var(--accent)',
          borderRadius: '4px',
          fontWeight: 600,
          fontSize: '0.7rem',
          letterSpacing: '0.04em',
        }}>
          v1.0.0
        </span>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="section-label">Philosophy</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6, margin: '8px 0 0 0' }}>
          <strong style={{ color: 'var(--accent)' }}>Privacy first. Everything local.</strong>
          <br /><br />
          Your desktop is your personal space. Graffiti is built from the ground up as a completely offline, high-performance engine. No accounts, no telemetry, no data leaving your machine.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
        <button className="secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
          <Globe size={16} /> Website
        </button>
        <button className="secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
          <Code size={16} /> Source
        </button>
        <button className="secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
          <HeartHandshake size={16} /> Support
        </button>
      </div>
    </div>
  );
}
