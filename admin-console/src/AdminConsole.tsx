import { useEffect, useMemo, useState } from 'react';

type Category = 'All' | 'Thought' | 'Bug' | 'Question' | 'Idea';
type FeedbackCategory = Exclude<Category, 'All'>;

type FeedbackEntry = {
  id: number;
  created_at: string;
  rating: number;
  category: FeedbackCategory;
  name: string | null;
  message: string;
  hidden: boolean;
  upvotes: number;
  downvotes: number;
};

type DownloadDatePoint = {
  date: string;
  count: number;
};

type Metrics = {
  visitors: { total: number; today: number };
  downloads: { total: number; today: number; byDate?: DownloadDatePoint[] };
  feedback: { total: number; hidden: number; categories: Record<FeedbackCategory, number> };
  votes: { up: number; down: number };
};

const CATEGORIES: Category[] = ['All', 'Thought', 'Bug', 'Question', 'Idea'];
const DEFAULT_API_URL = import.meta.env.VITE_GRAFFITI_API_URL || 'https://app.graffiti-wall.workers.dev';
const API_URL_KEY = 'graffiti_admin_api_url';
const ADMIN_TOKEN_KEY = 'graffiti_admin_token_permanent';

function readStorage(storage: Storage, key: string, fallback: string) {
  try {
    return storage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value);
  } catch {
    // The console still works for the current session when storage is unavailable.
  }
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

type SortOption = 'newest' | 'rating_desc' | 'rating_asc';

function RatingStars({ rating }: { rating: number }) {
  const safeRating = Math.max(0, Math.min(5, rating));
  return (
    <span className="admin-rating-stars" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((value) => (
        <svg key={value} className={value <= safeRating ? 'is-filled' : ''} viewBox="0 0 24 24" focusable="false">
          <path d="m12 2.75 2.84 5.76 6.36.92-4.6 4.48 1.09 6.33L12 17.25l-5.69 2.99 1.09-6.33-4.6-4.48 6.36-.92L12 2.75Z" />
        </svg>
      ))}
      <span className="admin-rating-number">{safeRating}★</span>
    </span>
  );
}

function cleanApiUrl(value: string) {
  return value.trim().replace(/\/+$/, '');
}

async function readJson(response: Response) {
  try {
    return await response.json() as Record<string, unknown>;
  } catch {
    return {};
  }
}

function DownloadsChart({ data, total }: { data: DownloadDatePoint[]; total: number }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="admin-chart-shell">
      <div className="admin-chart-bars-wrap">
        <div className="admin-chart-bars">
          {data.map((item) => {
            const heightPct = Math.max(12, Math.round((item.count / maxCount) * 100));
            return (
              <div key={item.date} className="admin-chart-col" title={`${item.count} download${item.count === 1 ? '' : 's'} on ${item.date}`}>
                <span className="admin-chart-count">{item.count}</span>
                <div className="admin-chart-bar-track">
                  <div className="admin-chart-bar-fill" style={{ height: `${heightPct}%` }} />
                </div>
                <span className="admin-chart-date">{item.date.slice(5)}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="admin-chart-summary-list">
        <div className="admin-chart-stat">
          <span>Total Recorded</span>
          <strong>{total}</strong>
        </div>
        <div className="admin-chart-stat">
          <span>Active Days</span>
          <strong>{data.length}</strong>
        </div>
        <div className="admin-chart-stat">
          <span>Peak Daily Volume</span>
          <strong>{maxCount}</strong>
        </div>
      </div>
    </div>
  );
}

export default function AdminConsole() {
  const [apiUrl, setApiUrl] = useState(() => readStorage(window.localStorage, API_URL_KEY, DEFAULT_API_URL));
  const [token, setToken] = useState(() => readStorage(window.localStorage, ADMIN_TOKEN_KEY, ''));
  const [connected, setConnected] = useState(() => Boolean(readStorage(window.localStorage, ADMIN_TOKEN_KEY, '')));
  const [category, setCategory] = useState<Category>('All');
  const [sortOrder, setSortOrder] = useState<SortOption>('newest');
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [showDownloadsGraph, setShowDownloadsGraph] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');

  const endpoint = useMemo(() => cleanApiUrl(apiUrl), [apiUrl]);

  const request = async (path: string, init: RequestInit = {}) => {
    if (!endpoint) throw new Error('Enter the deployed Worker URL first.');
    if (!token) throw new Error('Enter the admin token first.');
    const response = await fetch(`${endpoint}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        'X-Admin-Token': token,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers || {}),
      },
    });
    const payload = await readJson(response);
    if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : `Request failed (${response.status}).`);
    return payload;
  };

  const loadData = async () => {
    if (!connected) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ category, limit: '200', includeHidden: '1' });
      const [metricsPayload, entriesPayload] = await Promise.all([
        request('/api/admin/metrics'),
        request(`/api/admin/feedback?${params.toString()}`),
      ]);
      setMetrics(metricsPayload as unknown as Metrics);
      setEntries(Array.isArray(entriesPayload.entries) ? entriesPayload.entries as FeedbackEntry[] : []);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load the admin dashboard.');
      if (/authorization|required|401/i.test(loadError instanceof Error ? loadError.message : '')) setConnected(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (connected) void loadData();
  }, [connected, category]);

  const connect = () => {
    const cleaned = cleanApiUrl(apiUrl);
    if (!cleaned || !token.trim()) {
      setError('Enter both the Worker URL and admin token.');
      return;
    }
    setApiUrl(cleaned);
    setToken(token.trim());
    writeStorage(window.localStorage, API_URL_KEY, cleaned);
    writeStorage(window.localStorage, ADMIN_TOKEN_KEY, token.trim());
    setConnected(true);
  };

  const disconnect = () => {
    try { window.localStorage.removeItem(ADMIN_TOKEN_KEY); } catch { /* no-op */ }
    setToken('');
    setConnected(false);
    setEntries([]);
    setMetrics(null);
    setError('');
  };

  const updateEntry = async (id: number, patch: Partial<{ category: FeedbackCategory; hidden: boolean }>) => {
    try {
      await request(`/api/admin/feedback/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      await loadData();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update feedback.');
    }
  };

  const renderEntry = (entry: FeedbackEntry) => (
    <article className={`admin-feedback-entry${entry.hidden ? ' is-hidden' : ''}`} key={entry.id}>
      <div className="admin-feedback-entry-topline">
        <span className="admin-feedback-id">#{entry.id}</span>
        <span className="admin-feedback-category">{entry.category}</span>
        <span className="admin-feedback-rating" aria-label={`${entry.rating} out of 5 stars`}><RatingStars rating={entry.rating} /></span>
        {entry.hidden && <span className="admin-hidden-badge">Hidden</span>}
      </div>
      <p className="admin-feedback-message">{entry.message}</p>
      <div className="admin-feedback-meta">
        <span className="admin-feedback-author">
          <span className="admin-handle-label">Device:</span> <strong>@{entry.name || 'Anonymous'}</strong>
        </span>
        <time dateTime={entry.created_at}>{formatDate(entry.created_at)}</time>
        <span>Up {entry.upvotes} · Down {entry.downvotes}</span>
      </div>
      <div className="admin-feedback-actions">
        <label>
          Category
          <select value={entry.category} onChange={(event) => { void updateEntry(entry.id, { category: event.target.value as FeedbackCategory }); }}>
            {CATEGORIES.filter((value): value is FeedbackCategory => value !== 'All').map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <button className="admin-action-button" type="button" onClick={() => { void updateEntry(entry.id, { hidden: !entry.hidden }); }}>
          {entry.hidden ? 'Restore' : 'Hide'}
        </button>
      </div>
    </article>
  );

  const sortedEntries = useMemo(() => {
    const list = [...entries];
    if (sortOrder === 'rating_desc') {
      return list.sort((a, b) => b.rating - a.rating || b.id - a.id);
    }
    if (sortOrder === 'rating_asc') {
      return list.sort((a, b) => a.rating - b.rating || b.id - a.id);
    }
    return list;
  }, [entries, sortOrder]);

  return (
    <main className="admin-app-shell">
      <header className="admin-app-header">
        <div className="admin-brand-lockup">
          <span className="admin-brand-mark" aria-hidden="true">G</span>
          <div>
            <span className="admin-kicker">GRAFFITI / ADMIN</span>
            <h1>Feedback control room</h1>
          </div>
        </div>
        <div className={`admin-app-status${connected ? ' is-connected' : ''}`}>
          <span className="admin-status-dot" aria-hidden="true" />
          {connected ? 'Connected' : 'Awaiting connection'}
        </div>
      </header>

      <section className="admin-app-content">
        <div className="admin-app-intro">
          <div>
            <span className="admin-kicker">REMOTE WORKER / D1</span>
            <p>Review the public signal, classify rough edges, and inspect download telemetry.</p>
          </div>
          <span className="admin-app-version">VERSION 1.0</span>
        </div>

        <div className="admin-connection-bar">
          <label>
            Worker URL
            <input type="url" value={apiUrl} onChange={(event) => setApiUrl(event.target.value)} placeholder="https://app.graffiti-wall.workers.dev" />
          </label>
          <label>
            Admin token (remembered on this device)
            <input type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Enter admin token" onKeyDown={(event) => { if (event.key === 'Enter') connect(); }} />
          </label>
          <div className="admin-connection-actions">
            <button className="admin-primary-button" type="button" onClick={connect}>{connected ? 'Reconnect' : 'Connect'}</button>
            {connected && <button className="admin-secondary-button" type="button" onClick={disconnect}>Disconnect</button>}
          </div>
        </div>

        {error && <p className="admin-error" role="alert">{error}</p>}

        {!connected ? (
          <div className="admin-connect-empty">
            <strong>Connect the standalone admin app.</strong>
            <p>Enter the deployed Worker URL and your private Cloudflare ADMIN_TOKEN. The token will be remembered on this device so you don't need to re-type it.</p>
          </div>
        ) : (
          <>
            <div className="admin-dashboard-heading">
              <div>
                <span className="admin-kicker">OVERVIEW</span>
                <p>Telemetry, downloads, ratings, and public feedback.</p>
              </div>
              <button className="admin-secondary-button" type="button" onClick={() => { void loadData(); }} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
            </div>

            <div className="admin-metric-grid">
              <div className="admin-metric">
                <span>Visitors</span>
                <strong>{metrics?.visitors.total ?? 0}</strong>
                <small>{metrics ? `${metrics.visitors.today} today` : 'Waiting for data'}</small>
              </div>
              <div
                className={`admin-metric admin-metric-clickable ${showDownloadsGraph ? 'is-active' : ''}`}
                onClick={() => setShowDownloadsGraph((prev) => !prev)}
                role="button"
                tabIndex={0}
                title="Click to view downloads by date graph"
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowDownloadsGraph((prev) => !prev); }}
              >
                <div className="admin-metric-top">
                  <span>Downloads</span>
                  <span className="admin-metric-pill">{showDownloadsGraph ? 'Hide graph ▴' : 'View graph ▾'}</span>
                </div>
                <strong>{metrics?.downloads.total ?? 0}</strong>
                <small>{metrics ? `${metrics.downloads.today} today · Click to toggle graph` : 'Waiting for data'}</small>
              </div>
              <div className="admin-metric">
                <span>Feedback</span>
                <strong>{metrics?.feedback.total ?? 0}</strong>
                <small>{metrics ? `${metrics.feedback.hidden} hidden` : 'Waiting for data'}</small>
              </div>
              <div className="admin-metric">
                <span>Votes</span>
                <strong>{metrics ? metrics.votes.up + metrics.votes.down : 0}</strong>
                <small>{metrics ? `Up ${metrics.votes.up} · Down ${metrics.votes.down}` : 'Waiting for data'}</small>
              </div>
            </div>

            {/* EXPANDABLE DOWNLOADS TIMELINE GRAPH */}
            {showDownloadsGraph && (
              <section className="admin-downloads-panel" aria-labelledby="admin-downloads-title">
                <div className="admin-section-heading">
                  <div>
                    <span className="admin-kicker">TELEMETRY / DOWNLOADS TIMELINE</span>
                    <h2 id="admin-downloads-title">Downloads by date</h2>
                  </div>
                  <button
                    type="button"
                    className="admin-secondary-button"
                    onClick={() => setShowDownloadsGraph(false)}
                  >
                    Close graph ×
                  </button>
                </div>

                <div className="admin-graph-container">
                  {(!metrics?.downloads.byDate || metrics.downloads.byDate.length === 0) ? (
                    <div className="admin-graph-empty">
                      <p>No downloads recorded yet. As visitors download Graffiti, daily counts will appear here.</p>
                    </div>
                  ) : (
                    <DownloadsChart data={metrics.downloads.byDate} total={metrics.downloads.total} />
                  )}
                </div>
              </section>
            )}

            <div className="admin-console-grid">
              <section className="admin-feed-panel" aria-labelledby="admin-feedback-heading">
                <div className="admin-section-heading">
                  <div>
                    <span className="admin-kicker">FEEDBACK QUEUE</span>
                    <h2 id="admin-feedback-heading">Review feedback</h2>
                  </div>
                </div>
                <div className="admin-filter-bar">
                  <div className="admin-category-tabs" role="tablist" aria-label="Feedback categories">
                    {CATEGORIES.map((value) => (
                      <button key={value} type="button" role="tab" aria-selected={category === value} className={category === value ? 'is-selected' : ''} onClick={() => setCategory(value)}>
                        {value}<span>{value === 'All' ? metrics?.feedback.total ?? 0 : metrics?.feedback.categories[value] ?? 0}</span>
                      </button>
                    ))}
                  </div>
                  <div className="admin-sort-select-wrapper">
                    <label htmlFor="admin-sort-select">Sort</label>
                    <select id="admin-sort-select" value={sortOrder} onChange={(e) => setSortOrder(e.target.value as SortOption)}>
                      <option value="newest">Newest first</option>
                      <option value="rating_desc">Highest rating (5★ → 1★)</option>
                      <option value="rating_asc">Lowest rating (1★ → 5★)</option>
                    </select>
                  </div>
                </div>
                <div className="admin-feedback-list">
                  {loading && sortedEntries.length === 0 ? <p className="admin-empty">Loading feedback…</p> : sortedEntries.length === 0 ? <p className="admin-empty">No feedback matches this view.</p> : sortedEntries.map((entry) => renderEntry(entry))}
                </div>
              </section>

              <aside className="admin-summary-sidebar" aria-labelledby="admin-summary-heading">
                <div className="admin-section-heading">
                  <div>
                    <span className="admin-kicker">CLASSIFICATION</span>
                    <h2 id="admin-summary-heading">Breakdown</h2>
                  </div>
                </div>
                <div className="admin-category-summary">
                  <span>Feedback Categories</span>
                  {CATEGORIES.filter((value): value is FeedbackCategory => value !== 'All').map((value) => (
                    <div key={value}>
                      <span>{value}</span>
                      <strong>{metrics?.feedback.categories[value] ?? 0}</strong>
                    </div>
                  ))}
                </div>
                <p className="admin-updated">{lastUpdated ? `Updated ${lastUpdated}` : 'Not updated yet'}</p>
              </aside>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
