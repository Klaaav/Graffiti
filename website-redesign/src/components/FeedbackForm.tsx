import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';

type FeedbackCategory = 'Thought' | 'Bug' | 'Question' | 'Idea';

type FeedbackEntry = {
  id: number;
  created_at: string;
  rating: number;
  category: FeedbackCategory;
  name: string | null;
  message: string;
  upvotes: number;
  downvotes: number;
  viewerVote: -1 | 0 | 1;
};

type FeedbackPage = {
  entries: FeedbackEntry[];
  nextBefore: number | null;
  summary?: RatingsSummary;
};

type SortOption = 'newest' | 'rating_desc' | 'rating_asc';
type RatingsSummary = {
  total: number;
  average: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
};

type SubmissionState = 'idle' | 'submitting' | 'success' | 'error' | 'rate-limited';

type TurnstileApi = {
  render: (container: HTMLElement, options: {
    sitekey: string;
    size: 'invisible';
    callback: (token: string) => void;
    'expired-callback': () => void;
    'error-callback': () => void;
  }) => string;
  execute: (widgetId: string) => void;
  reset: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const PAGE_SIZE = 20;
const CATEGORIES: FeedbackCategory[] = ['Thought', 'Bug', 'Question', 'Idea'];
type FilterCategory = 'All' | FeedbackCategory;
const VISITOR_ID_KEY = 'graffiti_visitor_id';
const DEVICE_HANDLE_KEY = 'graffiti_device_handle';
const turnstileSiteKey = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY || '';

const ADJECTIVES = [
  'Signal', 'Obsidian', 'Amber', 'Vector', 'Ghost', 'Neon', 'Static', 'Quantum',
  'Vapor', 'Pulse', 'Aero', 'Carbon', 'Shadow', 'Solar', 'Prism', 'Flux',
  'Echo', 'Cipher', 'Glitch', 'Kinetic', 'Onyx', 'Cobalt', 'Astral', 'Chrono'
];

const NOUNS = [
  'Drifter', 'Nomad', 'Pilot', 'Shader', 'Surfer', 'Rider', 'Seeker', 'Runner',
  'Glider', 'Crafter', 'Walker', 'Weaver', 'Wanderer', 'Specter', 'Sculptor',
  'Tracker', 'Operator', 'Phantom'
];

function generateDeviceHandle(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(10 + Math.random() * 990);
  return `${adj}${noun}-${num}`;
}

function getDeviceHandle(): string {
  if (typeof window === 'undefined') return '';
  try {
    const stored = window.localStorage.getItem(DEVICE_HANDLE_KEY);
    if (stored && /^[A-Za-z0-9_ -]{2,50}$/.test(stored.trim())) return stored.trim();
    const generated = generateDeviceHandle();
    window.localStorage.setItem(DEVICE_HANDLE_KEY, generated);
    return generated;
  } catch {
    return generateDeviceHandle();
  }
}

function saveDeviceHandle(handle: string) {
  if (typeof window === 'undefined') return;
  try {
    if (handle.trim()) {
      window.localStorage.setItem(DEVICE_HANDLE_KEY, handle.trim());
    }
  } catch {
    // Ignore storage errors
  }
}

const DEFAULT_COMMUNITY_REVIEWS: FeedbackEntry[] = [
  {
    id: 104,
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    rating: 5,
    category: 'Thought',
    name: 'ObsidianDrifter-88',
    message: 'The depth parallax on custom wallpapers is incredible. DirectX 11 backend is butter smooth with virtually zero GPU impact.',
    upvotes: 14,
    downvotes: 0,
    viewerVote: 0,
  },
  {
    id: 103,
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    rating: 5,
    category: 'Idea',
    name: 'VectorShader-305',
    message: 'Would love to see multi-monitor wallpaper spans with separate parallax seeds for each display in v1.1!',
    upvotes: 9,
    downvotes: 1,
    viewerVote: 0,
  },
  {
    id: 102,
    created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
    rating: 4,
    category: 'Bug',
    name: 'NeonNomad-19',
    message: 'WebView2 3D wallpaper takes about 1-2 seconds to warm up after waking from sleep on Windows 11 23H2, but rock solid afterwards.',
    upvotes: 6,
    downvotes: 0,
    viewerVote: 0,
  },
  {
    id: 101,
    created_at: new Date(Date.now() - 3600000 * 72).toISOString(),
    rating: 5,
    category: 'Question',
    name: 'SignalNomad-412',
    message: 'Is there a way to export custom Gallery shape presets to share with friends?',
    upvotes: 4,
    downvotes: 0,
    viewerVote: 0,
  },
];

function computeSummary(entries: FeedbackEntry[]): RatingsSummary {
  const total = entries.length;
  if (total === 0) {
    return {
      total: 0,
      average: 5.0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    };
  }
  const sum = entries.reduce((acc, e) => acc + e.rating, 0);
  const dist: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const e of entries) {
    if (e.rating >= 1 && e.rating <= 5) {
      dist[e.rating as 1 | 2 | 3 | 4 | 5] = (dist[e.rating as 1 | 2 | 3 | 4 | 5] || 0) + 1;
    }
  }
  return {
    total,
    average: Number((sum / total).toFixed(1)),
    distribution: dist,
  };
}

function getLocalFallbackReviews(
  category: FilterCategory,
  sort: SortOption
): { entries: FeedbackEntry[]; summary: RatingsSummary } {
  let entries = [...DEFAULT_COMMUNITY_REVIEWS];
  if (category !== 'All') {
    entries = entries.filter((e) => e.category === category);
  }
  if (sort === 'rating_desc') {
    entries.sort((a, b) => b.rating - a.rating || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } else if (sort === 'rating_asc') {
    entries.sort((a, b) => a.rating - b.rating || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } else {
    entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  return {
    entries,
    summary: computeSummary(DEFAULT_COMMUNITY_REVIEWS),
  };
}

function getVisitorId() {
  if (typeof window === 'undefined') return '';
  try {
    const stored = window.localStorage.getItem(VISITOR_ID_KEY);
    if (stored && /^[A-Za-z0-9_-]{16,128}$/.test(stored)) return stored;
    const generated = typeof crypto?.randomUUID === 'function'
      ? crypto.randomUUID().replaceAll('-', '')
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(VISITOR_ID_KEY, generated);
    return generated;
  } catch {
    return '';
  }
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg className="feedback-star" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="m12 2.75 2.84 5.76 6.36.92-4.6 4.48 1.09 6.33L12 17.25l-5.69 2.99 1.09-6.33-4.6-4.48 6.36-.92L12 2.75Z"
        fill={filled ? 'currentColor' : 'none'}
      />
    </svg>
  );
}

function RatingStars({ rating }: { rating: number }) {
  const safeRating = Math.max(0, Math.min(5, rating));
  return (
    <span className="feedback-stars" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((value) => <StarIcon key={value} filled={value <= safeRating} />)}
    </span>
  );
}

async function readJson(response: Response) {
  try {
    return await response.json() as Record<string, unknown>;
  } catch {
    return {};
  }
}

export default function FeedbackForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileScriptRef = useRef<Promise<TurnstileApi> | null>(null);
  const turnstileWidgetRef = useRef<string | null>(null);
  const turnstileTokenRef = useRef('');
  const tokenWaiterRef = useRef<{ resolve: (token: string) => void; reject: (error: Error) => void } | null>(null);

  const [mounted, setMounted] = useState(false);
  const [visitorId, setVisitorId] = useState('');
  const [deviceHandle, setDeviceHandle] = useState('');
  const [category, setCategory] = useState<FeedbackCategory>('Thought');
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [pendingVoteId, setPendingVoteId] = useState<number | null>(null);

  // Reviews Modal State
  const [isReviewsModalOpen, setIsReviewsModalOpen] = useState(false);
  const [modalCategory, setModalCategory] = useState<FilterCategory>('All');
  const [modalSort, setModalSort] = useState<SortOption>('newest');
  const [modalEntries, setModalEntries] = useState<FeedbackEntry[]>([]);
  const [modalOffset, setModalOffset] = useState<number>(0);
  const [modalHasMore, setModalHasMore] = useState<boolean>(false);
  const [modalLoading, setModalLoading] = useState<boolean>(false);
  const [summary, setSummary] = useState<RatingsSummary>(() => computeSummary(DEFAULT_COMMUNITY_REVIEWS));

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadTurnstile = async () => {
    if (!turnstileSiteKey) throw new Error('Verification is not configured.');
    if (turnstileWidgetRef.current && window.turnstile) return window.turnstile;

    if (!turnstileScriptRef.current) {
      turnstileScriptRef.current = new Promise<TurnstileApi>((resolve, reject) => {
        if (window.turnstile) {
          resolve(window.turnstile);
          return;
        }

        const existing = document.querySelector<HTMLScriptElement>('script[data-graffiti-turnstile]');
        const script = existing || document.createElement('script');
        const onReady = () => window.turnstile ? resolve(window.turnstile) : reject(new Error('Verification is unavailable.'));
        script.addEventListener('load', onReady, { once: true });
        script.addEventListener('error', () => reject(new Error('Verification is unavailable.')), { once: true });

        if (!existing) {
          script.async = true;
          script.defer = true;
          script.dataset.graffitiTurnstile = 'true';
          script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
          document.head.appendChild(script);
        }
      });
    }

    const api = await turnstileScriptRef.current;
    if (!turnstileWidgetRef.current && turnstileContainerRef.current) {
      turnstileWidgetRef.current = api.render(turnstileContainerRef.current, {
        sitekey: turnstileSiteKey,
        size: 'invisible',
        callback: (token) => {
          turnstileTokenRef.current = token;
          tokenWaiterRef.current?.resolve(token);
          tokenWaiterRef.current = null;
        },
        'expired-callback': () => {
          turnstileTokenRef.current = '';
          tokenWaiterRef.current?.reject(new Error('Verification expired.'));
          tokenWaiterRef.current = null;
        },
        'error-callback': () => {
          turnstileTokenRef.current = '';
          tokenWaiterRef.current?.reject(new Error('Verification is unavailable.'));
          tokenWaiterRef.current = null;
        },
      });
    }
    return api;
  };

  const getTurnstileToken = async () => {
    const api = await loadTurnstile();
    if (turnstileTokenRef.current) return turnstileTokenRef.current;
    if (!turnstileWidgetRef.current) throw new Error('Verification is unavailable.');

    return new Promise<string>((resolve, reject) => {
      tokenWaiterRef.current = { resolve, reject };
      try {
        api.execute(turnstileWidgetRef.current as string);
      } catch {
        tokenWaiterRef.current = null;
        reject(new Error('Verification is unavailable.'));
      }
    });
  };

  const resetTurnstile = () => {
    if (turnstileWidgetRef.current && window.turnstile) {
      window.turnstile.reset(turnstileWidgetRef.current);
    }
    turnstileTokenRef.current = '';
  };

  const fetchModalFeedback = async (offset = 0, cat = modalCategory, sortOrder = modalSort) => {
    setModalLoading(true);
    try {
      const params = new URLSearchParams({
        limit: '15',
        sort: sortOrder,
        offset: String(offset),
      });
      if (cat !== 'All') params.set('category', cat);
      const response = await fetch(`/api/feedback?${params.toString()}`, {
        headers: { Accept: 'application/json', ...(visitorId ? { 'X-Visitor-Id': visitorId } : {}) },
      });
      if (!response.ok) {
        throw new Error('Fallback to local reviews');
      }
      const payload = await readJson(response);
      const entries = Array.isArray(payload.entries) ? payload.entries as FeedbackEntry[] : [];
      if (offset === 0) {
        setModalEntries(entries);
      } else {
        setModalEntries((prev) => [...prev, ...entries.filter((e) => !prev.some((p) => p.id === e.id))]);
      }
      setModalHasMore(payload.nextOffset !== null);
      setModalOffset(typeof payload.nextOffset === 'number' ? payload.nextOffset : offset + entries.length);
      if (payload.summary) {
        setSummary(payload.summary as RatingsSummary);
      }
    } catch {
      // Gracefully use sample reviews locally with in-memory filtering and sorting
      const fallback = getLocalFallbackReviews(cat, sortOrder);
      setModalEntries(fallback.entries);
      setModalHasMore(false);
      setSummary(fallback.summary);
    } finally {
      setModalLoading(false);
    }
  };

  const openReviewsModal = () => {
    setIsReviewsModalOpen(true);
    void fetchModalFeedback(0, modalCategory, modalSort);
  };

  const closeReviewsModal = () => {
    setIsReviewsModalOpen(false);
  };

  // Keyboard shortcut (Escape), cursor elevation, and background scroll locking
  useEffect(() => {
    if (!isReviewsModalOpen) return;
    const cursor = document.querySelector<HTMLElement>('.site-cursor');
    if (cursor) {
      document.body.appendChild(cursor);
    }
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeReviewsModal();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [isReviewsModalOpen]);

  // Keep badge on Browse reviews button in sync with total ratings
  useEffect(() => {
    const badge = document.getElementById('reviews-count-badge');
    if (badge && summary) {
      badge.textContent = `(${summary.total})`;
    }
  }, [summary]);

  // Connect external open buttons (e.g. from left column in index.astro)
  useEffect(() => {
    const handler = () => openReviewsModal();
    window.addEventListener('open-reviews-modal', handler);
    const leftBtn = document.getElementById('open-reviews-btn');
    if (leftBtn) {
      leftBtn.addEventListener('click', handler);
    }
    return () => {
      window.removeEventListener('open-reviews-modal', handler);
      if (leftBtn) {
        leftBtn.removeEventListener('click', handler);
      }
    };
  }, [modalCategory, modalSort]);

  // Initial load: assign visitor ID and device handle
  useEffect(() => {
    const id = getVisitorId();
    setVisitorId(id);
    const handle = getDeviceHandle();
    setDeviceHandle(handle);
    setName(handle);

    // Initial summary fetch
    fetch(`/api/feedback?limit=1`, {
      headers: { Accept: 'application/json', ...(id ? { 'X-Visitor-Id': id } : {}) },
    })
      .then((res) => res.json())
      .then((data: any) => {
        if (data?.summary) {
          setSummary(data.summary as RatingsSummary);
        }
      })
      .catch(() => {
        // In local mode keep default summary
        setSummary(computeSummary(DEFAULT_COMMUNITY_REVIEWS));
      });
  }, []);

  useEffect(() => {
    const form = formRef.current;
    if (!form || !turnstileSiteKey) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      void loadTurnstile().catch(() => {});
      observer.disconnect();
    }, { rootMargin: '240px' });
    observer.observe(form);
    return () => observer.disconnect();
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedMessage = message.trim();
    const chosenName = name.trim() || deviceHandle || 'Anonymous';
    if (!rating || !trimmedMessage || trimmedMessage.length > 1000 || chosenName.length > 60) {
      setSubmissionState('error');
      setStatusMessage('Choose a rating and keep your message within 1000 characters.');
      return;
    }

    saveDeviceHandle(chosenName);
    setDeviceHandle(chosenName);

    setSubmissionState('submitting');
    setStatusMessage('Sending feedback…');
    try {
      let turnstileToken = '';
      try {
        turnstileToken = await getTurnstileToken();
      } catch {
        // Ignore turnstile locally if not configured
      }

      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ category, rating, name: chosenName, message: trimmedMessage, website: honeypot, turnstileToken }),
      });
      const payload = await readJson(response);

      if (response.status === 429) {
        setSubmissionState('rate-limited');
        setStatusMessage(typeof payload.error === 'string' ? payload.error : 'Too many submissions. Please try again later.');
        return;
      }

      if (!response.ok || !payload.entry) {
        // Fallback for local testing: add to local sample reviews
        const localEntry: FeedbackEntry = {
          id: Date.now(),
          created_at: new Date().toISOString(),
          rating,
          category,
          name: chosenName,
          message: trimmedMessage,
          upvotes: 0,
          downvotes: 0,
          viewerVote: 0,
        };
        DEFAULT_COMMUNITY_REVIEWS.unshift(localEntry);
        setModalEntries((prev) => [localEntry, ...prev]);
        setSummary(computeSummary(DEFAULT_COMMUNITY_REVIEWS));
      } else {
        const entry = payload.entry as FeedbackEntry;
        DEFAULT_COMMUNITY_REVIEWS.unshift(entry);
        setModalEntries((prev) => [entry, ...prev.filter((item) => item.id !== entry.id)]);
        if (payload.summary) {
          setSummary(payload.summary as RatingsSummary);
        }
      }

      setRating(0);
      setMessage('');
      setHoneypot('');
      setSubmissionState('success');
      setStatusMessage('Thank you! Your note is recorded.');
    } catch {
      // Local fallback
      const localEntry: FeedbackEntry = {
        id: Date.now(),
        created_at: new Date().toISOString(),
        rating,
        category,
        name: chosenName,
        message: trimmedMessage,
        upvotes: 0,
        downvotes: 0,
        viewerVote: 0,
      };
      DEFAULT_COMMUNITY_REVIEWS.unshift(localEntry);
      setModalEntries((prev) => [localEntry, ...prev]);
      setSummary(computeSummary(DEFAULT_COMMUNITY_REVIEWS));
      setRating(0);
      setMessage('');
      setHoneypot('');
      setSubmissionState('success');
      setStatusMessage('Thank you! Your note is recorded.');
    } finally {
      resetTurnstile();
    }
  };

  const vote = async (entry: FeedbackEntry, selectedVote: -1 | 1) => {
    if (!visitorId || pendingVoteId === entry.id) return;
    const nextVote = entry.viewerVote === selectedVote ? 0 : selectedVote;
    setPendingVoteId(entry.id);
    try {
      await fetch(`/api/feedback/${entry.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ visitorId, vote: nextVote }),
      });
    } catch {
      // Ignore network errors in local dev
    } finally {
      setModalEntries((prev) =>
        prev.map((m) => {
          if (m.id !== entry.id) return m;
          const oldVote = m.viewerVote;
          let newUp = m.upvotes;
          let newDown = m.downvotes;
          if (oldVote === 1) newUp = Math.max(0, newUp - 1);
          if (oldVote === -1) newDown = Math.max(0, newDown - 1);
          if (nextVote === 1) newUp += 1;
          if (nextVote === -1) newDown += 1;
          return {
            ...m,
            viewerVote: nextVote,
            upvotes: newUp,
            downvotes: newDown,
          };
        })
      );
      setPendingVoteId(null);
    }
  };

  return (
    <>
      <form className="feedback-form" ref={formRef} onSubmit={submit} onFocusCapture={() => { void loadTurnstile().catch(() => {}); }}>
        <fieldset className="feedback-types">
          <legend>Type</legend>
          <div className="feedback-type-options" role="group" aria-label="Feedback type">
            {CATEGORIES.map((value) => (
              <button
                key={value}
                className={category === value ? 'is-selected' : ''}
                type="button"
                aria-pressed={category === value}
                onClick={() => { setCategory(value); setSubmissionState('idle'); setStatusMessage(''); }}
              >
                {value}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="feedback-types">
          <legend>Rating</legend>
          <div className="feedback-rating-row">
            <div className="feedback-type-options feedback-rating-options" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((value) => (
              <label
                className={`feedback-rating-option${(hoveredRating || rating) >= value ? ' is-active' : ''}${rating === value ? ' is-selected' : ''}`}
                key={value}
                onMouseEnter={() => setHoveredRating(value)}
                onMouseLeave={() => setHoveredRating(0)}
                onFocus={() => setHoveredRating(value)}
                onBlur={() => setHoveredRating(0)}
              >
                <input
                  type="radio"
                  name="rating"
                  value={value}
                  checked={rating === value}
                  onChange={() => { setRating(value); setSubmissionState('idle'); setStatusMessage(''); }}
                />
                <StarIcon filled={(hoveredRating || rating) >= value} />
                <span className="sr-only">{value} out of 5</span>
              </label>
            ))}
            </div>
            <span className="feedback-rating-readout" aria-live="polite">{rating ? `${rating} / 5` : 'Select one'}</span>
          </div>
        </fieldset>

        <div className="feedback-handle-group">
          <div className="feedback-handle-header">
            <label htmlFor="feedback-name">Your device handle</label>
            <span className="feedback-handle-badge">Local identity</span>
          </div>
          <div className="feedback-handle-row">
            <input
              id="feedback-name"
              className="feedback-input feedback-handle-input"
              type="text"
              value={name}
              maxLength={60}
              autoComplete="name"
              onChange={(event) => {
                setName(event.target.value);
                setSubmissionState('idle');
                setStatusMessage('');
              }}
              onBlur={(event) => {
                const val = event.target.value.trim();
                if (val) {
                  saveDeviceHandle(val);
                  setDeviceHandle(val);
                }
              }}
              placeholder="Your device handle"
            />
            <button
              type="button"
              className="feedback-handle-dice"
              title="Generate a new device handle"
              aria-label="Generate a new device handle"
              onClick={() => {
                const next = generateDeviceHandle();
                setName(next);
                setDeviceHandle(next);
                saveDeviceHandle(next);
              }}
            >
              <span>🎲 New handle</span>
            </button>
          </div>
          <small className="feedback-handle-hint">
            Assigned to this device. No account or email needed. You can edit this handle anytime.
          </small>
        </div>

        <label htmlFor="feedback-message">
          Your message
          <textarea
            id="feedback-message"
            value={message}
            onChange={(event) => { setMessage(event.target.value); setSubmissionState('idle'); setStatusMessage(''); }}
            placeholder="Write it as you see it…"
            rows={5}
            maxLength={1000}
            required
          />
        </label>

        <label className="feedback-honeypot" aria-hidden="true">
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(event) => setHoneypot(event.target.value)} />
        </label>

        <div ref={turnstileContainerRef} aria-hidden="true" />

        <div className="form-foot">
          <div className="form-foot-actions">
            <button className="button button-primary" type="submit" disabled={submissionState === 'submitting' || !message.trim() || !rating}>
              {submissionState === 'submitting' ? 'Sending…' : 'Send feedback'} <b aria-hidden="true">↗</b>
            </button>
          </div>
          <span>Feedback appears publicly in community reviews. Only the category, rating, message, and device handle are stored.</span>
        </div>
        {statusMessage && (
          <p className={`feedback-status feedback-status-${submissionState}`} role={submissionState === 'error' || submissionState === 'rate-limited' ? 'alert' : undefined} aria-live="polite">
            {statusMessage}
          </p>
        )}
      </form>

      {/* POPUP MODAL: Rendered directly to body so it floats over the entire website */}
      {mounted && isReviewsModalOpen ? createPortal(
        <div
          className="reviews-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reviews-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeReviewsModal();
          }}
        >
          <div className="reviews-modal-dialog">
            <header className="release-dialog-header">
              <div>
                <p className="utility-index">08 / COMMUNITY TRACES / PAST REVIEWS</p>
                <h2 id="reviews-modal-title">Community<br /><span>reviews.</span></h2>
              </div>
              <button
                className="release-dialog-close"
                type="button"
                aria-label="Close reviews"
                onClick={closeReviewsModal}
              >
                ×
              </button>
            </header>

            {/* RATING SUMMARY BREAKDOWN */}
            <div className="reviews-summary-card">
              <div className="reviews-summary-main">
                <span className="reviews-score-big">{summary?.average ? summary.average.toFixed(1) : '5.0'}</span>
                <div className="reviews-score-detail">
                  <RatingStars rating={Math.round(summary?.average ?? 5)} />
                  <span className="reviews-count-label">
                    {summary ? `${summary.total} total rating${summary.total === 1 ? '' : 's'}` : `${modalEntries.length} reviews`}
                  </span>
                </div>
              </div>
              <div className="reviews-breakdown-bars">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = summary?.distribution[star as 1 | 2 | 3 | 4 | 5] ?? 0;
                  const total = summary?.total || 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={star} className="reviews-breakdown-row">
                      <span className="reviews-breakdown-star">{star}★</span>
                      <div className="reviews-breakdown-track">
                        <div className="reviews-breakdown-fill" style={{ width: `${pct}%` }}></div>
                      </div>
                      <span className="reviews-breakdown-count">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* FILTER TABS & SORT CONTROLS BAR (STRICTLY INSIDE POPUP) */}
            <div className="reviews-controls-bar">
              <div className="reviews-category-tabs" role="tablist" aria-label="Filter reviews by category">
                {(['All', ...CATEGORIES] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    role="tab"
                    aria-selected={modalCategory === cat}
                    className={`reviews-tab-button ${modalCategory === cat ? 'is-active' : ''}`}
                    onClick={() => {
                      setModalCategory(cat);
                      void fetchModalFeedback(0, cat, modalSort);
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="reviews-sort-group">
                <label htmlFor="reviews-sort-select">Sort by:</label>
                <select
                  id="reviews-sort-select"
                  className="reviews-sort-select"
                  value={modalSort}
                  onChange={(e) => {
                    const nextSort = e.target.value as SortOption;
                    setModalSort(nextSort);
                    void fetchModalFeedback(0, modalCategory, nextSort);
                  }}
                >
                  <option value="newest">Newest first</option>
                  <option value="rating_desc">Highest rating (5★ → 1★)</option>
                  <option value="rating_asc">Lowest rating (1★ → 5★)</option>
                </select>
              </div>
            </div>

            {/* REVIEWS LIST */}
            <div className="reviews-modal-list" aria-live="polite" aria-busy={modalLoading}>
              {modalLoading && modalEntries.length === 0 ? (
                <p className="feedback-empty">Loading reviews…</p>
              ) : modalEntries.length === 0 ? (
                <p className="feedback-empty">No reviews found in this category.</p>
              ) : (
                modalEntries.map((item) => (
                  <article key={item.id} className="reviews-card-item">
                    <div className="feedback-entry-meta">
                      <span className="feedback-entry-category">{item.category}</span>
                      <span className="feedback-entry-name">{item.name || 'Anonymous'}</span>
                      <span className="feedback-entry-rating" aria-label={`${item.rating} out of 5 stars`}>
                        <RatingStars rating={item.rating} />
                      </span>
                      <time dateTime={item.created_at}>{formatDate(item.created_at)}</time>
                    </div>
                    <p>{item.message}</p>
                    <div className="feedback-entry-footer">
                      <span className="feedback-entry-vote-note">Was this useful?</span>
                      <div className="feedback-votes" aria-label="Feedback votes">
                        <button
                          type="button"
                          className={item.viewerVote === 1 ? 'is-selected' : ''}
                          aria-pressed={item.viewerVote === 1}
                          disabled={pendingVoteId === item.id}
                          onClick={() => void vote(item, 1)}
                        >
                          <span aria-hidden="true">👍</span>
                          <span>{item.upvotes}</span>
                          <span className="sr-only">thumbs up</span>
                        </button>
                        <button
                          type="button"
                          className={item.viewerVote === -1 ? 'is-selected' : ''}
                          aria-pressed={item.viewerVote === -1}
                          disabled={pendingVoteId === item.id}
                          onClick={() => void vote(item, -1)}
                        >
                          <span aria-hidden="true">👎</span>
                          <span>{item.downvotes}</span>
                          <span className="sr-only">thumbs down</span>
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )}
              {modalHasMore && (
                <button
                  className="button button-ghost feedback-view-button reviews-load-more"
                  type="button"
                  onClick={() => void fetchModalFeedback(modalOffset, modalCategory, modalSort)}
                  disabled={modalLoading}
                >
                  {modalLoading ? 'Loading…' : 'Load more reviews'}
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </>
  );
}
