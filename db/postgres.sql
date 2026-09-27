CREATE TABLE IF NOT EXISTS rooms (
  id text PRIMARY KEY,
  state text NOT NULL,
  revision integer NOT NULL DEFAULT 0,
  mode text NOT NULL DEFAULT 'shared',
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS members (
  room_id text NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  last_seen bigint NOT NULL,
  PRIMARY KEY (room_id, token_hash)
);
CREATE INDEX IF NOT EXISTS members_presence ON members (room_id, last_seen);
