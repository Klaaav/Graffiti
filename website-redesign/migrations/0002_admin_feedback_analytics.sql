ALTER TABLE feedback ADD COLUMN category TEXT NOT NULL DEFAULT 'Thought' CHECK (category IN ('Thought', 'Bug', 'Question', 'Idea'));
ALTER TABLE feedback ADD COLUMN read_at TEXT;

CREATE INDEX idx_feedback_admin_queue ON feedback (read_at, category, id DESC);

CREATE TABLE feedback_votes (
  feedback_id INTEGER NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  voter_id TEXT NOT NULL,
  vote INTEGER NOT NULL CHECK (vote IN (-1, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (feedback_id, voter_id)
);

CREATE INDEX idx_feedback_votes_feedback ON feedback_votes (feedback_id, vote);

CREATE TABLE visitor_days (
  visitor_id TEXT NOT NULL,
  day TEXT NOT NULL,
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (visitor_id, day)
);

CREATE TABLE analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  event TEXT NOT NULL CHECK (event IN ('page_view', 'download_click')),
  visitor_id TEXT NOT NULL
);

CREATE INDEX idx_analytics_events_type_day ON analytics_events (event, created_at);
