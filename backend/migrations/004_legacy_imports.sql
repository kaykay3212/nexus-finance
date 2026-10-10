CREATE TABLE IF NOT EXISTS legacy_imports (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    import_id UUID NOT NULL,
    payload_hash CHAR(64) NOT NULL,
    transaction_count INTEGER NOT NULL CHECK (transaction_count >= 0),
    goal_count INTEGER NOT NULL CHECK (goal_count >= 0),
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, import_id)
);
