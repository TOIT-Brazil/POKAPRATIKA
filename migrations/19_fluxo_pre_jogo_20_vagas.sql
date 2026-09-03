ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS pregame_state TEXT,
  ADD COLUMN IF NOT EXISTS player_capacity INTEGER,
  ADD COLUMN IF NOT EXISTS roster_closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS roster_closed_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS drawn_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS drawn_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS draw_seed TEXT;

UPDATE matches
SET player_capacity = 20
WHERE pregame_state IS NOT NULL
  AND player_capacity IS NULL;

ALTER TABLE matches
  DROP CONSTRAINT IF EXISTS matches_pregame_state_check;

ALTER TABLE matches
  ADD CONSTRAINT matches_pregame_state_check
  CHECK (pregame_state IS NULL OR pregame_state IN ('CONFIRMING', 'COMPLETING', 'READY_TO_DRAW', 'DRAWN', 'NO_QUORUM'));

ALTER TABLE matches
  DROP CONSTRAINT IF EXISTS matches_player_capacity_check;

ALTER TABLE matches
  ADD CONSTRAINT matches_player_capacity_check
  CHECK (player_capacity IS NULL OR player_capacity = 20);

CREATE TABLE IF NOT EXISTS match_pregame_participants (
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  participant_key TEXT NOT NULL,
  user_id UUID REFERENCES users(id),
  guest_key TEXT,
  name_snapshot TEXT NOT NULL,
  position TEXT NOT NULL,
  source TEXT NOT NULL,
  participant_status TEXT NOT NULL,
  selection_order INTEGER,
  reserve_order INTEGER,
  team TEXT,
  replaced_by_key TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, participant_key),
  CONSTRAINT match_pregame_identity_check CHECK (
    (source = 'CLUB' AND user_id IS NOT NULL AND guest_key IS NULL AND participant_key = user_id::TEXT)
    OR
    (source = 'GUEST' AND user_id IS NULL AND guest_key IS NOT NULL AND participant_key = guest_key)
  ),
  CONSTRAINT match_pregame_position_check CHECK (position IN ('GO', 'ZG', 'LD', 'LE', 'MD', 'MC', 'MA', 'AT')),
  CONSTRAINT match_pregame_source_check CHECK (source IN ('CLUB', 'GUEST')),
  CONSTRAINT match_pregame_status_check CHECK (participant_status IN ('ELIGIBLE', 'SELECTED', 'RESERVE', 'REPLACED')),
  CONSTRAINT match_pregame_team_check CHECK (team IS NULL OR team IN ('A', 'B')),
  CONSTRAINT match_pregame_status_fields_check CHECK (
    (participant_status = 'ELIGIBLE' AND selection_order IS NULL AND reserve_order IS NULL AND team IS NULL)
    OR
    (participant_status = 'SELECTED' AND selection_order BETWEEN 1 AND 20 AND reserve_order IS NULL AND team IN ('A', 'B'))
    OR
    (participant_status = 'RESERVE' AND selection_order IS NULL AND reserve_order >= 1 AND team IS NULL)
    OR
    (participant_status = 'REPLACED' AND selection_order IS NULL AND reserve_order IS NULL AND team IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_match_pregame_guest
  ON match_pregame_participants (match_id, guest_key)
  WHERE guest_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_match_pregame_selection_order
  ON match_pregame_participants (match_id, selection_order)
  WHERE selection_order IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_match_pregame_reserve_order
  ON match_pregame_participants (match_id, reserve_order)
  WHERE reserve_order IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_match_pregame_status
  ON match_pregame_participants (match_id, participant_status);