// WNI database schema. Runs on every start: everything is "if not exists", so it is safe to repeat.
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  username      TEXT NOT NULL CHECK (char_length(username) BETWEEN 3 AND 20),
  email         TEXT NOT NULL CHECK (char_length(email) <= 254),
  -- scrypt$N$r$p$salt$hash, with a fresh random salt for every user
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_key ON users (lower(username));
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (lower(email));

CREATE TABLE IF NOT EXISTS sessions (
  -- SHA-256 of the cookie token, so a database leak does not leak live sessions
  token_hash TEXT PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS scores (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  game       TEXT NOT NULL,
  level      TEXT NOT NULL,
  score      INTEGER NOT NULL CHECK (score >= 0),
  detail     TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scores_game_idx ON scores (game, score DESC);
CREATE INDEX IF NOT EXISTS scores_game_level_idx ON scores (game, level, score DESC);
CREATE INDEX IF NOT EXISTS scores_user_idx ON scores (user_id, game);

-- Sneaky Hangman's online word lists, refreshed from the word service about once a week
CREATE TABLE IF NOT EXISTS word_lists (
  len        INTEGER PRIMARY KEY,
  words      TEXT NOT NULL,
  provider   TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- level 4 used to be called Bibi
UPDATE scores SET level = 'edith' WHERE level = 'bibi';
`;
