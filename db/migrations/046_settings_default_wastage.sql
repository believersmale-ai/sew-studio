-- Studio-wide default fabric/material wastage for quote estimates.
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS default_wastage_percent numeric NOT NULL DEFAULT 0
  CHECK (default_wastage_percent >= 0 AND default_wastage_percent <= 100);
