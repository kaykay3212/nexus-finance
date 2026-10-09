-- Nexus Finance security constraints.
-- NOT VALID keeps legacy rows from breaking deployment while enforcing the
-- constraints on every new/updated row immediately.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_user_required_chk') THEN
    ALTER TABLE transactions
      ADD CONSTRAINT transactions_user_required_chk CHECK (user_id IS NOT NULL) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goals_user_required_chk') THEN
    ALTER TABLE goals
      ADD CONSTRAINT goals_user_required_chk CHECK (user_id IS NOT NULL) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_type_chk') THEN
    ALTER TABLE transactions
      ADD CONSTRAINT transactions_type_chk CHECK (type IN ('Entrada','Saída')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_mode_chk') THEN
    ALTER TABLE transactions
      ADD CONSTRAINT transactions_mode_chk CHECK (mode IN ('Movimentação','Compromisso','Renda Fixa','Assinatura')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_status_chk') THEN
    ALTER TABLE transactions
      ADD CONSTRAINT transactions_status_chk CHECK (status IN ('Realizado','Previsto','Pendente','Pago','Atrasado')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_recurrence_chk') THEN
    ALTER TABLE transactions
      ADD CONSTRAINT transactions_recurrence_chk CHECK (recurrence IN ('Único','Mensal','Semanal','Anual')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_description_len_chk') THEN
    ALTER TABLE transactions
      ADD CONSTRAINT transactions_description_len_chk CHECK (char_length(description) BETWEEN 1 AND 160) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_note_len_chk') THEN
    ALTER TABLE transactions
      ADD CONSTRAINT transactions_note_len_chk CHECK (char_length(note) <= 2000) NOT VALID;
  END IF;
END $$;
