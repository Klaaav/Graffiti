CREATE TABLE feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  name TEXT,
  message TEXT NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_feedback_visible ON feedback (hidden, id DESC);
